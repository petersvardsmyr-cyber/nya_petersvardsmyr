import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderRequest {
  items: Array<{
    id: string;
    title: string;
    price: number;
    quantity: number;
    category: string;
  }>;
  shipping: {
    option_id: string;
    name: string;
    price_ex_vat: number;
    vat_rate: number;
    region: string;
  };
  total_amount: number;
  discount_amount?: number;
  discount_code?: string;
  newsletter_optin?: boolean;
  vat_breakdown: any;
  email?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing payment request...");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    // Parse request body with validation
    let orderData: OrderRequest;
    try {
      orderData = await req.json();
      console.log("Processing order with", orderData.items?.length || 0, "items");
      
      // Validate required fields
      if (!orderData.items || orderData.items.length === 0) {
        throw new Error("No items in order");
      }
      if (!orderData.shipping) {
        throw new Error("No shipping option selected");
      }
      if (!orderData.total_amount || orderData.total_amount <= 0) {
        throw new Error("Invalid total amount");
      }
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      throw new Error("Invalid request data");
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Create line items for Stripe (including VAT)
    const lineItems = orderData.items.map(item => {
      const vatRate = item.category === 'book' ? 0.06 : 0.25;
      const priceIncVAT = Math.round(item.price * (1 + vatRate) * 100); // Dynamisk momssats per produkt
      return {
        price_data: {
          currency: "sek",
          product_data: {
            name: `${item.title} (inkl. ${Math.round(vatRate * 100)}% moms)`,
          },
          unit_amount: priceIncVAT,
        },
        quantity: item.quantity,
      };
    });

    // Add shipping as line item
    const shippingPriceIncVAT = Math.round(orderData.shipping.price_ex_vat * (1 + orderData.shipping.vat_rate) * 100);
    lineItems.push({
      price_data: {
        currency: "sek",
        product_data: {
          name: `${orderData.shipping.name} ${orderData.shipping.vat_rate === 0 ? '(momsfri export)' : `(inkl. ${Math.round(orderData.shipping.vat_rate * 100)}% moms)`}`,
        },
        unit_amount: shippingPriceIncVAT,
      },
      quantity: 1,
    });

    // NOTE: Discounts are carried in metadata only for now to avoid Stripe negative line item errors.
    // If you need cart-level discounts, we can implement Stripe Coupons/Promotion Codes.


    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      locale: "sv", // Force Swedish language
      success_url: `${req.headers.get("origin") || "http://localhost:3000"}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin") || "http://localhost:3000"}/butik`,
      customer_email: orderData.email === 'guest@example.com' ? undefined : orderData.email,
      shipping_address_collection: {
        allowed_countries: ['SE', 'NO', 'DK', 'FI'],
      },
      billing_address_collection: 'required',
      payment_intent_data: {
        metadata: {
          order_items: JSON.stringify(orderData.items),
          shipping: JSON.stringify(orderData.shipping),
          discount_code: orderData.discount_code || '',
          discount_amount: (orderData.discount_amount || 0).toString(),
          vat_breakdown: JSON.stringify(orderData.vat_breakdown),
          newsletter_optin: (orderData.newsletter_optin || false).toString(),
        }
      },
      metadata: {
        order_items: JSON.stringify(orderData.items),
        shipping: JSON.stringify(orderData.shipping),
        discount_code: orderData.discount_code || '',
        discount_amount: (orderData.discount_amount || 0).toString(),
        vat_breakdown: JSON.stringify(orderData.vat_breakdown),
        newsletter_optin: (orderData.newsletter_optin || false).toString(),
      }
    });

    console.log("Stripe session created:", session.id);

    // Save order to database
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user if available
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    let userEmail = orderData.email;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email || orderData.email;
      }
    }

    const { error: insertError } = await supabaseClient
      .from("orders")
      .insert({
        stripe_session_id: session.id,
        user_id: userId,
        email: userEmail || orderData.email || 'pending@checkout.temp',
        total_amount: orderData.total_amount * 100, // Store in öre
        discount_amount: (orderData.discount_amount || 0) * 100,
        discount_code: orderData.discount_code,
        items: orderData.items,
        shipping_address: orderData.shipping,
        status: 'pending',
      });

    if (insertError) {
      console.error("Error saving order:", insertError);
      // Don't fail the request, just log the error
    } else {
      console.log("Order saved to database");
    }

    // Newsletter subscription will be handled in Stripe webhook after payment completion
    // This ensures we have the correct customer email from Stripe checkout

    // Order confirmation emails are now sent via Stripe webhook after successful payment
    // This avoids sending emails before the customer completes checkout and ensures we use the final email from Stripe.

    return new Response(
      JSON.stringify({ 
        url: session.url,
        session_id: session.id 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error creating payment session:", error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = "Unknown error occurred";
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific error types
      if (error.message.includes("STRIPE_SECRET_KEY")) {
        errorMessage = "Stripe configuration error: Missing or invalid secret key";
        statusCode = 500;
      } else if (error.message.includes("Invalid request")) {
        errorMessage = "Invalid order data provided";
        statusCode = 400;
      } else if (error.message.includes("Network")) {
        errorMessage = "Network error occurred while processing payment";
        statusCode = 502;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: statusCode,
      }
    );
  }
});