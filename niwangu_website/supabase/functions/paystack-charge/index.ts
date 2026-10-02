import { createClient } from "jsr:@supabase/supabase-js@2.112.0";

// The caller supplies only a plan id and a phone number. Identity comes from the
// JWT and the price comes from public.pricing_plans, so neither can be forged by
// editing the request body.
//
// Paystack's Charge API sends the M-Pesa STK push on our behalf, so the member
// experience is unchanged: they type a phone number here and approve a prompt on
// their handset.
interface ChargePayload {
  phoneNumber?: string;
  planId?: string;
}

const PAYSTACK_API = "https://api.paystack.co";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const corsHeaders = (origin: string | null) => {
  const allowOrigin = allowedOrigins.length === 0
    ? "*"
    : origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
};

const formatPhoneNumber = (phone: string): string => {
  // Strip the leading "+" and any spacing first, then normalise to 254XXXXXXXXX.
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("254")) {
    return cleaned;
  }

  if (cleaned.startsWith("0")) {
    return `254${cleaned.slice(1)}`;
  }

  if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
    return `254${cleaned}`;
  }

  return cleaned;
};

const isValidSafaricomNumber = (formatted: string) => /^254[17]\d{8}$/.test(formatted);

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

  const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ success: false, error, ...extra }), { status, headers });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return fail(405, "Method not allowed.");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase environment variables are missing.");
      return fail(500, "Payment backend is not configured.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 1. Identify the caller from their access token, never from the body.
    const accessToken = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");

    if (!accessToken) {
      return fail(401, "You must be signed in to start a payment.");
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !userData?.user) {
      return fail(401, "Your session has expired. Sign in again to continue.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .single();

    if (profileError || !profile) {
      return fail(403, "No profile is linked to this account.");
    }

    // 2. Validate the request body.
    let payload: ChargePayload;
    try {
      payload = await req.json();
    } catch {
      return fail(400, "Invalid request body.");
    }

    const { phoneNumber, planId } = payload;

    if (typeof phoneNumber !== "string" || typeof planId !== "string" || !phoneNumber || !planId) {
      return fail(400, "A phone number and a plan are required.");
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);

    if (!isValidSafaricomNumber(formattedPhone)) {
      return fail(400, "Enter a valid Safaricom number, for example 0712345678.");
    }

    // 3. The price is whatever the database says it is.
    const { data: plan, error: planError } = await supabase
      .from("pricing_plans")
      .select("plan_id, label, price_ksh, duration_days")
      .eq("plan_id", planId)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return fail(400, "That plan is not available.");
    }

    const amount = plan.price_ksh;

    // 4. Don't let a member stack duplicate prompts on the same phone.
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentPending } = await supabase
      .from("payments")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("status", "pending")
      .gte("created_at", oneMinuteAgo)
      .limit(1);

    if (recentPending && recentPending.length > 0) {
      return fail(429, "An M-Pesa prompt was just sent. Check your phone before trying again.");
    }

    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!secretKey) {
      console.error("PAYSTACK_SECRET_KEY is not set. Charges cannot be created.");
      return fail(
        503,
        "Payments are not configured for this environment. Set PAYSTACK_SECRET_KEY in Supabase secrets before attempting payment.",
      );
    }

    // Paystack needs an email to attach the customer record to. The member's
    // sign-in address is the right one, and it is not caller-supplied.
    const email = userData.user.email;

    if (!email) {
      return fail(400, "Your account has no email address, which Paystack requires to bill you.");
    }

    // 5. Record the pending payment BEFORE charging.
    //
    // We own the reference, and Paystack's charge.success webhook can land while
    // the charge call is still returning. Inserting first means the webhook
    // always finds a row to reconcile against.
    const reference = `nwg_${crypto.randomUUID().replace(/-/g, "")}`;

    const { error: insertError } = await supabase.from("payments").insert({
      profile_id: profile.id,
      reference,
      phone_number: formattedPhone,
      amount,
      plan_id: plan.plan_id,
      status: "pending",
    });

    if (insertError) {
      // Without this row the webhook has nothing to reconcile against, so the
      // member would pay and never be activated. Surface it instead of hiding it.
      console.error("Failed to record pending payment", insertError);
      return fail(500, "Payment could not be recorded. Please try again before paying.");
    }

    const abandon = async (reason: string) => {
      const { error } = await supabase.rpc("fail_payment", {
        p_reference: reference,
        p_result_desc: reason,
      });

      if (error) {
        console.error("Could not mark the payment failed", { reference, error });
      }
    };

    // 6. Ask Paystack to send the STK push.
    let chargeRes: Response;
    try {
      chargeRes = await fetch(`${PAYSTACK_API}/charge`, {
        signal: AbortSignal.timeout(15000),
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          // Paystack bills in the currency's subunit, so KES 199 is 19900.
          amount: Math.round(amount * 100),
          currency: "KES",
          reference,
          mobile_money: {
            // Paystack asks for the international form here.
            phone: `+${formattedPhone}`,
            provider: "mpesa",
          },
          metadata: {
            plan_id: plan.plan_id,
            profile_id: profile.id,
          },
        }),
      });
    } catch (error) {
      console.error("Paystack charge request failed", error);
      await abandon("Could not reach Paystack.");
      return fail(502, "Could not reach the payment provider. Please try again in a moment.");
    }

    let chargeBody: {
      status?: boolean;
      message?: string;
      data?: {
        status?: string;
        display_text?: string;
        message?: string;
        gateway_response?: string;
        id?: number | string;
      };
    };

    try {
      chargeBody = await chargeRes.json();
    } catch {
      console.error("Unable to parse Paystack charge response", { status: chargeRes.status });
      await abandon("Paystack returned an unreadable response.");
      return fail(502, "The payment provider returned an unreadable response. Please try again.");
    }

    // Paystack's top-level `message` is generic ("Charge attempted") even when
    // the charge did not go through. The real reason is in data.gateway_response
    // or data.message, so prefer those and fall back to the generic one last.
    const paystackReason = () =>
      chargeBody.data?.gateway_response ||
      chargeBody.data?.message ||
      chargeBody.data?.display_text ||
      chargeBody.message ||
      "The payment could not be started.";

    // Always log the decisive fields; the top-level message alone is useless
    // when diagnosing a rejected charge.
    console.log("Paystack charge response", {
      reference,
      httpStatus: chargeRes.status,
      ok: chargeBody.status,
      message: chargeBody.message,
      dataStatus: chargeBody.data?.status,
      gatewayResponse: chargeBody.data?.gateway_response,
      dataMessage: chargeBody.data?.message,
    });

    if (!chargeRes.ok || chargeBody.status !== true) {
      const message = paystackReason();
      console.error("Paystack rejected the charge", {
        reference,
        httpStatus: chargeRes.status,
        message,
      });
      await abandon(message);
      return fail(400, message, { providerStatus: chargeBody.data?.status ?? null });
    }

    const chargeStatus = chargeBody.data?.status ?? "pending";
    const providerTransactionId = chargeBody.data?.id != null ? String(chargeBody.data.id) : null;

    if (providerTransactionId) {
      await supabase
        .from("payments")
        .update({ provider_transaction_id: providerTransactionId })
        .eq("reference", reference);
    }

    console.log("Paystack charge created", { reference, chargeStatus });

    // 7. Translate Paystack's charge state into something the client can act on.
    //
    // Activation itself is never done here: only the webhook, after verifying
    // the transaction, may call complete_payment(). A "success" at this stage
    // just means the member does not need to do anything else on their phone.
    if (chargeStatus === "failed") {
      const message = paystackReason();
      console.error("Paystack charge failed at initiation", { reference, message });
      await abandon(message);
      return fail(400, message, { providerStatus: chargeStatus });
    }

    if (chargeStatus === "send_otp" || chargeStatus === "open_url") {
      // M-Pesa charges should never take these branches. If one does, the member
      // cannot finish here, so stop rather than leave them waiting on a prompt
      // that will not arrive.
      const message = "This payment needs a verification step Niwangu does not support yet.";
      await abandon(`Unsupported Paystack charge status: ${chargeStatus}`);
      return fail(400, message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reference,
        amount,
        status: chargeStatus,
        message: chargeBody.data?.display_text ||
          "STK Push sent to your phone. Enter your M-Pesa PIN to complete payment.",
      }),
      { headers },
    );
  } catch (error) {
    console.error("Unhandled paystack-charge error", error);
    return fail(500, "Something went wrong starting the payment. Please try again.");
  }
});
