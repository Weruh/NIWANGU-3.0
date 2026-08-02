import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getPlanDays = (planId: string): number => {
  switch (planId) {
    case "7_days":
      return 7;
    case "30_days":
      return 30;
    case "90_days":
      return 90;
    case "180_days":
      return 180;
    case "365_days":
      return 365;
    default:
      return 30;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("M-Pesa Callback received:", JSON.stringify(body));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return new Response(JSON.stringify({ error: "Invalid callback payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch matching payment record
    const { data: payment, error: fetchErr } = await supabase
      .from("payments")
      .select("*")
      .eq("checkout_request_id", CheckoutRequestID)
      .single();

    if (fetchErr || !payment) {
      console.error("Payment record not found for CheckoutRequestID:", CheckoutRequestID);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ResultCode === 0) {
      // Payment Successful
      let mpesaReceipt = "";
      if (CallbackMetadata?.Item) {
        const receiptItem = CallbackMetadata.Item.find((item: any) => item.Name === "MpesaReceiptNumber");
        if (receiptItem) {
          mpesaReceipt = String(receiptItem.Value);
        }
      }

      // Update payment record
      await supabase
        .from("payments")
        .update({
          status: "completed",
          mpesa_receipt: mpesaReceipt,
          result_desc: ResultDesc,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      // Calculate expiration date
      const days = getPlanDays(payment.plan_id);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      // Update profile subscription
      await supabase
        .from("profiles")
        .update({
          is_premium: true,
          subscription_plan: payment.plan_id,
          premium_expires_at: expiresAt.toISOString(),
          mpesa_receipt_number: mpesaReceipt,
        })
        .eq("id", payment.profile_id);

      console.log(`Successfully activated ${payment.plan_id} for profile ${payment.profile_id}`);
    } else {
      // Payment Failed or Cancelled
      await supabase
        .from("payments")
        .update({
          status: "failed",
          result_desc: ResultDesc,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error processing M-Pesa callback:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
