import { createClient } from "jsr:@supabase/supabase-js@2.112.0";

// Paystack calls this endpoint server-to-server, so it cannot present a JWT.
// Three things stand in for that:
//   1. an HMAC SHA-512 signature over the raw body, keyed with the secret key,
//   2. a verification call back to Paystack for the same reference,
//   3. amount + idempotency checks inside complete_payment().
// No browser ever calls this, so it sends no CORS headers.
const jsonHeaders = { "Content-Type": "application/json" };

const PAYSTACK_API = "https://api.paystack.co";

// Acknowledge anything we have finished handling. Paystack retries for 72 hours
// on a non-200, and a retry of an already-applied payment is pointless.
const acknowledge = () => new Response(JSON.stringify({ received: true }), { headers: jsonHeaders });

const timingSafeEqual = (a: string, b: string) => {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  // Compare every byte regardless of length so the loop cannot leak the prefix.
  let mismatch = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);

  for (let i = 0; i < length; i += 1) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return mismatch === 0;
};

// The signature is taken over the exact bytes Paystack sent, so this has to run
// against the raw body string and never a re-serialised object.
const signBody = async (rawBody: string, secretKey: string): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

type Verification =
  | { outcome: "confirmed"; paidKsh: number; receipt: string | null; transactionId: string | null }
  | { outcome: "rejected"; reason: string }
  | { outcome: "unavailable" };

// Ask Paystack what it thinks happened. The signature already proves the payload
// is authentic, so this is defence in depth rather than the primary check.
const verifyWithPaystack = async (reference: string, secretKey: string): Promise<Verification> => {
  try {
    const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!res.ok) {
      return { outcome: "unavailable" };
    }

    const body = await res.json();

    if (body?.status !== true || !body?.data) {
      return { outcome: "unavailable" };
    }

    const data = body.data;

    if (data.status === "success" && data.currency === "KES" && data.reference === reference) {
      return {
        outcome: "confirmed",
        // Paystack reports in subunits; the RPC compares against price_ksh.
        paidKsh: Number(data.amount) / 100,
        receipt: data.receipt_number ? String(data.receipt_number) : null,
        transactionId: data.id != null ? String(data.id) : null,
      };
    }

    // Paystack answered about this transaction and it was not a success.
    if (typeof data.status === "string") {
      return {
        outcome: "rejected",
        reason: data.gateway_response || `Paystack reported status "${data.status}".`,
      };
    }

    return { outcome: "unavailable" };
  } catch (error) {
    console.error("Paystack verification failed", error);
    return { outcome: "unavailable" };
  }
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

  if (!secretKey) {
    console.error("PAYSTACK_SECRET_KEY is not set; refusing every webhook.");
    return new Response(JSON.stringify({ error: "Webhook is not configured" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const rawBody = await req.text();
  const providedSignature = req.headers.get("x-paystack-signature") ?? "";
  const expectedSignature = await signBody(rawBody, secretKey);

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    console.warn("Rejected a Paystack webhook with a bad signature.");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  try {
    const body = JSON.parse(rawBody);
    const event: string = body?.event ?? "";
    const reference: string | undefined = body?.data?.reference;

    if (!reference) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    console.log("Paystack webhook received", { event, reference });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    if (event !== "charge.success") {
      // Paystack sends a family of events on this one endpoint. Only failures of
      // a charge are actionable here; the rest are acknowledged and ignored so
      // they are not retried for three days.
      if (event === "charge.failed" || body?.data?.status === "failed") {
        const { data, error } = await supabase.rpc("fail_payment", {
          p_reference: reference,
          p_result_desc: body?.data?.gateway_response ?? "Payment failed or was cancelled.",
        });

        if (error) {
          console.error("fail_payment failed", error);
          return new Response(JSON.stringify({error:"Could not record payment failure"}),{status:500,headers:jsonHeaders});
        } else {
          console.log("Recorded failed payment", { reference, outcome: data });
        }
      }

      return acknowledge();
    }

    const verification = await verifyWithPaystack(reference, secretKey);

    if (verification.outcome === "rejected") {
      const {error}=await supabase.rpc("fail_payment", {
        p_reference: reference,
        p_result_desc: verification.reason,
      });
      if(error)return new Response(JSON.stringify({error:"Could not record rejected payment"}),{status:500,headers:jsonHeaders});

      return acknowledge();
    }

    if (verification.outcome === 'unavailable') {
      return new Response(JSON.stringify({error:'Provider verification unavailable; retry required'}), {status:503,headers:jsonHeaders});
    }
    const {paidKsh,receipt,transactionId} = verification;

    const { data, error } = await supabase.rpc("complete_payment", {
      p_reference: reference,
      p_provider_receipt: receipt,
      p_provider_transaction_id: transactionId,
      p_result_desc: body?.data?.gateway_response ?? "Success",
      p_paid_amount: paidKsh,
    });

    if (error) {
      // Do not acknowledge: let Paystack retry so the payment is not lost.
      console.error("complete_payment failed", { reference, error });
      return new Response(JSON.stringify({ error: "Could not record payment" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    console.log("Payment processed", { reference, outcome: data });
    return acknowledge();
  } catch (err) {
    console.error("Error processing Paystack webhook:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
