import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetStripeFeesRequest {
  payment_intent_ids: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const { payment_intent_ids }: GetStripeFeesRequest = await req.json();

    if (!payment_intent_ids || payment_intent_ids.length === 0) {
      return new Response(
        JSON.stringify({ fees: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    const fees: Record<string, number> = {};

    // Hämta faktisk Stripe-avgift per transaktion via Balance Transaction API
    for (const piId of payment_intent_ids) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(piId);
        const chargeId = paymentIntent.latest_charge as string;

        if (chargeId) {
          const charge = await stripe.charges.retrieve(chargeId, {
            expand: ['balance_transaction']
          });

          const bt = charge.balance_transaction as Stripe.BalanceTransaction;
          if (bt && typeof bt.fee === 'number') {
            // bt.fee är i öre (minsta valutaenheten)
            fees[piId] = bt.fee;
          }
        }
      } catch (e) {
        console.error(`Failed to get fee for ${piId}:`, e);
        // Hoppa över denna transaktion, returnera inte fel för hela requesten
      }
    }

    return new Response(
      JSON.stringify({ fees }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error fetching Stripe fees:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
