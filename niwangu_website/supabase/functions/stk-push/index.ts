import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StkPushPayload {
  phoneNumber: string;
  planId: string;
  amount: number;
  profileId: string;
}

const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "254" + cleaned.slice(1);
  } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
    cleaned = "254" + cleaned;
  } else if (cleaned.startsWith("+254")) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: StkPushPayload = await req.json();
    const { phoneNumber, planId, amount, profileId } = payload;
    const denoEnv = Deno.env;

    if (!phoneNumber || !amount || !profileId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: phoneNumber, amount, or profileId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    const env = denoEnv?.get("MPESA_ENVIRONMENT") || "sandbox";
    const consumerKey = denoEnv?.get("MPESA_CONSUMER_KEY");
    const consumerSecret = denoEnv?.get("MPESA_CONSUMER_SECRET");
    const passkey = denoEnv?.get("MPESA_PASSKEY");
    const shortcode = denoEnv?.get("MPESA_SHORTCODE") || "174379"; // Safaricom default sandbox shortcode
    const callbackUrl = denoEnv?.get("MPESA_CALLBACK_URL") || `${denoEnv?.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;

    const supabaseUrl = denoEnv?.get("SUPABASE_URL");
    const supabaseServiceKey = denoEnv?.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

    const allowSimulated = denoEnv?.get("MPESA_SIMULATE") === "true";

    // Check if live M-Pesa credentials exist
    if (!consumerKey || !consumerSecret || !passkey) {
      if (allowSimulated) {
        console.log("M-Pesa credentials not fully configured. Running STK Push in simulated mode.");

        const fakeCheckoutId = `ws_CO_SIM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        if (supabase) {
          await supabase.from("payments").insert({
            profile_id: profileId,
            checkout_request_id: fakeCheckoutId,
            merchant_request_id: `MR_${Date.now()}`,
            phone_number: formattedPhone,
            amount: amount,
            plan_id: planId,
            status: "pending",
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            simulated: true,
            checkoutRequestId: fakeCheckoutId,
            message: `Simulated STK Push sent to ${formattedPhone} for KSh ${amount}.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error("M-Pesa credentials not configured. STK push cannot be sent.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "M-Pesa STK Push is not configured for this environment. Set the M-Pesa credentials in Supabase secrets before attempting payment.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Obtain Daraja OAuth Token
    const authUrl = env === "production"
      ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
      : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

    const authHeader = `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`;
    const tokenRes = await fetch(authUrl, {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Daraja token request failed', { status: tokenRes.status, body: errText });
      throw new Error(`Failed to fetch Daraja access token: ${errText}`);
    }

    const tokenJson = await tokenRes.json();
    const { access_token } = tokenJson;

    // 2. Generate Timestamp & Password
    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // 3. Trigger STK Push
    const stkUrl = env === "production"
      ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
      : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: "NIWANGU",
      TransactionDesc: `Niwangu Premium Access (${planId})`,
    };

    const stkRes = await fetch(stkUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkBody),
    });

    let stkData: any = null;
    try {
      stkData = await stkRes.json();
    } catch (parseErr) {
      const raw = await stkRes.text();
      console.error('Unable to parse STK response JSON', { status: stkRes.status, raw });
      throw new Error(`Unable to parse STK response: ${raw}`);
    }

    console.log('STK push response', { status: stkRes.status, body: stkData });

    if (stkData.ResponseCode === "0") {
      if (supabase) {
        await supabase.from("payments").insert({
          profile_id: profileId,
          checkout_request_id: stkData.CheckoutRequestID,
          merchant_request_id: stkData.MerchantRequestID,
          phone_number: formattedPhone,
          amount: amount,
          plan_id: planId,
          status: "pending",
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          checkoutRequestId: stkData.CheckoutRequestID,
          merchantRequestId: stkData.MerchantRequestID,
          message: "STK Push sent to phone. Enter your M-Pesa PIN to complete payment.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const darajaMessage = stkData.CustomerMessage || stkData.errorMessage || "STK Push request failed.";
      return new Response(
        JSON.stringify({
          success: false,
          error: stkData.errorCode ? `${darajaMessage} (Daraja ${stkData.errorCode})` : darajaMessage,
          darajaErrorCode: stkData.errorCode ?? null,
          requestId: stkData.requestId ?? null,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
