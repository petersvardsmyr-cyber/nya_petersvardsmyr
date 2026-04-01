import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    if (!webhookSecret) {
      console.log("STRIPE_WEBHOOK_SECRET not configured, skipping signature verification");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return new Response(`Webhook signature verification failed`, { status: 400 });
      }
    } else {
      // For development/testing without webhook secret
      event = JSON.parse(body);
    }

    console.log("Received webhook event:", event.type);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session completed");

        // Prepare shipping address data from Stripe
        const deliveryAddress = session.shipping_details?.address ? {
          name: session.shipping_details.name || null,
          line1: session.shipping_details.address.line1 || null,
          line2: session.shipping_details.address.line2 || null,
          city: session.shipping_details.address.city || null,
          state: session.shipping_details.address.state || null,
          postal_code: session.shipping_details.address.postal_code || null,
          country: session.shipping_details.address.country || null,
          phone: session.customer_details?.phone || null
        } : null;

        // Get shipping option from metadata
        const shippingOption = session.metadata?.shipping ? JSON.parse(session.metadata.shipping) : null;

        // Store delivery address with shipping option nested separately to avoid field collisions
        const combinedShippingData = deliveryAddress ? {
          ...deliveryAddress,
          ...(shippingOption && { shipping_option: shippingOption })
        } : (shippingOption ? { shipping_option: shippingOption } : null);

        // Update order status to completed
        const { error: updateError } = await supabaseClient
          .from("orders")
          .update({
            status: 'completed',
            stripe_payment_intent_id: session.payment_intent as string,
            email: session.customer_details?.email || session.customer_email || null,
            ...(combinedShippingData && { shipping_address: combinedShippingData })
          })
          .eq('stripe_session_id', session.id);

        if (updateError) {
          console.error("Error updating order:", updateError);
        } else {
          console.log("Order updated to completed for session:", session.id);
        }

        // Trigger order confirmation emails now that payment is completed
        try {
          const newsletterOptin = (session.metadata?.newsletter_optin === 'true');
          const email = session.customer_details?.email || session.customer_email || '';

          // Add to newsletter if opted in
          if (newsletterOptin && email) {
            console.log('Adding customer to newsletter:', email);
            const { error: newsletterError } = await supabaseClient
              .from('newsletter_subscribers')
              .insert({
                email: email,
                name: session.customer_details?.name || null,
                is_active: true
              });
            
            if (newsletterError) {
              // Don't fail the webhook if email already exists
              if (newsletterError.code !== '23505') { // Not a unique constraint violation
                console.error('Error adding to newsletter:', newsletterError);
              } else {
                console.log('Email already subscribed to newsletter');
                // Reactivate if inactive
                await supabaseClient
                  .from('newsletter_subscribers')
                  .update({ is_active: true })
                  .eq('email', email)
                  .eq('is_active', false);
              }
            } else {
              console.log('Successfully added to newsletter');
            }

            // Send newsletter subscription confirmation email
            try {
              const { error: confirmError } = await supabaseClient.functions.invoke('send-confirmation-email', {
                body: { email }
              });
              
              if (confirmError) {
                console.error('Failed to send newsletter confirmation:', confirmError);
              } else {
                console.log('Newsletter confirmation sent to:', email);
              }
            } catch (confirmErr) {
              console.error('Error sending newsletter confirmation:', confirmErr);
            }
          }

          const { error: fnError } = await supabaseClient.functions.invoke('send-order-confirmation', {
            body: {
              session_id: session.id,
              customer_email: email,
              newsletter_subscribed: newsletterOptin,
            }
          });

          if (fnError) {
            console.error('Failed to trigger confirmation emails:', fnError);
          } else {
            console.log('Order confirmation emails sent for session:', session.id);
          }
        } catch (e) {
          console.error('Error invoking confirmation email function:', e);
        }

        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment succeeded:", paymentIntent.id);
        
        // Additional handling if needed
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment failed");
        
        // Update order status to failed if needed
        const { error: updateError } = await supabaseClient
          .from("orders")
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        if (updateError) {
          console.error("Error updating failed order:", updateError);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Webhook error:", error);
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