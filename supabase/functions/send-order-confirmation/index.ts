import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderConfirmationRequest {
  session_id: string;
  customer_email: string;
  newsletter_subscribed?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK'
  }).format(amount);
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing order confirmation email...");
    
    const { session_id, customer_email, newsletter_subscribed = false }: OrderConfirmationRequest = await req.json();
    
    if (!session_id || !customer_email) {
      throw new Error("session_id and customer_email are required");
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get order confirmation template from database
    const { data: template } = await supabase
      .from('email_templates')
      .select('subject, content')
      .eq('template_type', 'order_confirmation')
      .eq('is_active', true)
      .limit(1)
      .single();

    // Initialize Stripe to get session details
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Get session details with expanded line items
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items']
    });

    if (!session) {
      throw new Error("Session not found");
    }

    // Parse metadata
    const orderItems = JSON.parse(session.metadata?.order_items || '[]');
    const shipping = JSON.parse(session.metadata?.shipping || '{}');
    const vatBreakdown = JSON.parse(session.metadata?.vat_breakdown || '{}');
    const discountCode = session.metadata?.discount_code || '';
    const discountAmount = parseInt(session.metadata?.discount_amount || '0');

    const orderNumber = session_id.slice(-8).toUpperCase();
    const totalAmount = session.amount_total ? session.amount_total / 100 : 0;

    // Use template content if available, otherwise use default
    let emailSubject = template?.subject || 'Tack för din beställning!';
    let templateContent = template?.content || '<h1>Tack för din beställning!</h1><p>Vi har mottagit din beställning och kommer att behandla den så snart som möjligt.</p>';

    // Generate customer email HTML with template content
    const customerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #2c3e50; margin: 0;">${emailSubject}</h1>
          <p style="color: #7f8c8d; margin: 10px 0 0 0;">Orderbekräftelse från Peter Svärdsmyr</p>
        </div>
        
        <div style="padding: 30px 20px;">
          <div style="background-color: #e8f5e8; border-left: 4px solid #27ae60; padding: 15px; margin-bottom: 25px;">
            <p style="margin: 0; color: #27ae60; font-weight: bold;">Din order har behandlats framgångsrikt!</p>
            <p style="margin: 5px 0 0 0; color: #2c3e50;">Ordernummer: <strong>${orderNumber}</strong></p>
          </div>

          <!-- Template content -->
          <div style="margin-bottom: 25px;">
            ${templateContent}
          </div>

          <h2 style="color: #2c3e50; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px;">Orderdetaljer</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Produkt</th>
                <th style="padding: 12px; text-align: center; border-bottom: 1px solid #dee2e6;">Antal</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">Pris</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems.map((item: any) => `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.title}</td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">${formatCurrency(item.price * item.quantity)}</td>
                </tr>
              `).join('')}
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${shipping.name}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">1</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">${formatCurrency(shipping.price_ex_vat * (1 + shipping.vat_rate))}</td>
              </tr>
              ${discountAmount > 0 ? `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;">Rabatt (${discountCode})</td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">1</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; color: #e74c3c;">-${formatCurrency(discountAmount)}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>

          <div style="background-color: #f8f9fa; padding: 15px; margin-bottom: 25px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="font-size: 18px; color: #2c3e50;">Totalt att betala:</strong>
              <strong style="font-size: 18px; color: #27ae60;">${formatCurrency(totalAmount)}</strong>
            </div>
          </div>

          <h3 style="color: #2c3e50; margin-top: 25px;">Momsspecifikation</h3>
          <div style="background-color: #f8f9fa; padding: 15px; margin-bottom: 25px;">
            ${(vatBreakdown.vat6?.incVAT || 0) > 0 ? `
            <div style="margin-bottom: 8px;">
              <strong>Böcker (6% moms):</strong> ${formatCurrency(vatBreakdown.vat6?.exVAT || 0)} + ${formatCurrency(vatBreakdown.vat6?.vat || 0)} moms = ${formatCurrency(vatBreakdown.vat6?.incVAT || 0)}
            </div>
            ` : ''}
            ${(vatBreakdown.vat25?.incVAT || 0) > 0 ? `
            <div style="margin-bottom: 8px;">
              <strong>Övrigt (25% moms):</strong> ${formatCurrency(vatBreakdown.vat25?.exVAT || 0)} + ${formatCurrency(vatBreakdown.vat25?.vat || 0)} moms = ${formatCurrency(vatBreakdown.vat25?.incVAT || 0)}
            </div>
            ` : ''}
            ${!vatBreakdown.vat6 && !vatBreakdown.vat25 ? `
            <div style="margin-bottom: 8px;">
              <strong>Produkter:</strong> ${formatCurrency(vatBreakdown.products?.exVAT || 0)} + ${formatCurrency(vatBreakdown.products?.vat || 0)} moms = ${formatCurrency(vatBreakdown.products?.incVAT || 0)}
            </div>
            ` : ''}
            <div style="margin-bottom: 8px;">
              <strong>Frakt:</strong> ${formatCurrency(vatBreakdown.shipping?.exVAT || 0)} + ${formatCurrency(vatBreakdown.shipping?.vat || 0)} moms (${Math.round((vatBreakdown.shipping?.vatRate || 0) * 100)}%) = ${formatCurrency(vatBreakdown.shipping?.incVAT || 0)}
            </div>
            ${(vatBreakdown.total?.oresutjamning || 0) !== 0 ? `
            <div style="margin-bottom: 8px;">
              <strong>Öresutjämning:</strong> ${formatCurrency(vatBreakdown.total?.oresutjamning || 0)}
            </div>
            ` : ''}
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #dee2e6;">
            <div style="font-weight: bold;">
              <strong>Totalt exkl. moms:</strong> ${formatCurrency(vatBreakdown.total?.exVAT || 0)}<br>
              <strong>Totalt moms:</strong> ${formatCurrency(vatBreakdown.total?.vat || 0)}<br>
              <strong>Totalt inkl. moms:</strong> ${formatCurrency(vatBreakdown.total?.incVAT || 0)}
            </div>
          </div>

          ${session.shipping_details ? `
            <h3 style="color: #2c3e50;">Leveransadress</h3>
            <div style="background-color: #f8f9fa; padding: 15px; margin-bottom: 25px;">
              <p style="margin: 0; line-height: 1.6;">
                ${session.shipping_details.name}<br>
                ${session.shipping_details.address?.line1}<br>
                ${session.shipping_details.address?.line2 ? session.shipping_details.address.line2 + '<br>' : ''}
                ${session.shipping_details.address?.postal_code} ${session.shipping_details.address?.city}<br>
                ${session.shipping_details.address?.country}
              </p>
            </div>
          ` : ''}

          ${newsletter_subscribed ? `
            <div style="background-color: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin-bottom: 25px;">
              <h4 style="margin: 0 0 10px 0; color: #2e7d32;">📧 Nyhetsbrev</h4>
              <p style="margin: 0; color: #2e7d32;">Tack för att du prenumererar på mitt nyhetsbrev! Du kommer få uppdateringar om nya böcker, artiklar och tankar direkt i din inkorg.</p>
            </div>
          ` : ''}

          <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin-bottom: 25px;">
            <h4 style="margin: 0 0 10px 0; color: #1976d2;">Vad händer nu?</h4>
            <ul style="margin: 0; padding-left: 20px; color: #424242;">
              <li>Din beställning bearbetas inom 1-2 arbetsdagar</li>
              <li>Du får en försändelseavis när paketet skickas</li>
              <li>Leveranstid: ${shipping.region === 'sweden' ? '2-3 arbetsdagar' : shipping.region === 'eu' ? '5-7 arbetsdagar' : '7-14 arbetsdagar'}</li>
            </ul>
          </div>

          <p style="color: #7f8c8d; margin-top: 30px;">
            Har du frågor om din beställning? Kontakta mig gärna på 
            <a href="mailto:hej@petersvardsmyr.se" style="color: #3498db;">hej@petersvardsmyr.se</a>
          </p>

          <p style="color: #7f8c8d;">
            Tack för att du handlar från mig!<br>
            Vänliga hälsningar,<br>
            <strong>Peter Svärdsmyr</strong>
          </p>
        </div>
      </div>
    `;

    // Generate admin notification email HTML
    const adminEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #f39c12; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Ny beställning!</h1>
          <p style="color: #f7f7f7; margin: 10px 0 0 0;">Order ${orderNumber}</p>
        </div>
        
        <div style="padding: 30px 20px;">
          <div style="background-color: #fff3cd; border-left: 4px solid #f39c12; padding: 15px; margin-bottom: 25px;">
            <p style="margin: 0; color: #856404; font-weight: bold;">Ny order mottagen!</p>
            <p style="margin: 5px 0 0 0; color: #856404;">Ordernummer: <strong>${orderNumber}</strong></p>
            <p style="margin: 5px 0 0 0; color: #856404;">Kund: <strong>${customer_email}</strong></p>
            <p style="margin: 5px 0 0 0; color: #856404;">Totalbelopp: <strong>${formatCurrency(totalAmount)}</strong></p>
          </div>

          <h2 style="color: #2c3e50; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px;">Orderdetaljer</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Produkt</th>
                <th style="padding: 12px; text-align: center; border-bottom: 1px solid #dee2e6;">Antal</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">Pris</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems.map((item: any) => `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.title}</td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">${formatCurrency(item.price * item.quantity)}</td>
                </tr>
              `).join('')}
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${shipping.name}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">1</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">${formatCurrency(shipping.price_ex_vat * (1 + shipping.vat_rate))}</td>
              </tr>
              ${discountAmount > 0 ? `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;">Rabatt (${discountCode})</td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">1</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; color: #e74c3c;">-${formatCurrency(discountAmount)}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>

          ${session.shipping_details ? `
            <h3 style="color: #2c3e50;">Leveransadress</h3>
            <div style="background-color: #f8f9fa; padding: 15px; margin-bottom: 25px;">
              <p style="margin: 0; line-height: 1.6;">
                ${session.shipping_details.name}<br>
                ${session.shipping_details.address?.line1}<br>
                ${session.shipping_details.address?.line2 ? session.shipping_details.address.line2 + '<br>' : ''}
                ${session.shipping_details.address?.postal_code} ${session.shipping_details.address?.city}<br>
                ${session.shipping_details.address?.country}
              </p>
            </div>
          ` : ''}

          <div style="background-color: #f8f9fa; padding: 15px;">
            <h4 style="margin: 0 0 10px 0;">Stripe Session ID:</h4>
            <code style="background-color: #e9ecef; padding: 5px; font-family: monospace;">${session_id}</code>
          </div>
        </div>
      </div>
    `;

    // Send customer confirmation email
    const customerEmailResult = await resend.emails.send({
      from: "Peter Svärdsmyr <hej@petersvardsmyr.se>",
      to: [customer_email],
      subject: `${emailSubject} - ${orderNumber}`,
      html: customerEmailHtml,
    });

    console.log("Customer email sent successfully");

    // Send admin notification email
    const adminEmailResult = await resend.emails.send({
      from: "Peter Svärdsmyr <hej@petersvardsmyr.se>",
      to: ["hej@petersvardsmyr.se"],
      subject: `Ny beställning ${orderNumber}`,
      html: adminEmailHtml,
    });

    console.log("Admin notification sent successfully");

    return new Response(
      JSON.stringify({ 
        message: "Order confirmation emails sent successfully",
        customer_email_sent: !!customerEmailResult.data,
        admin_email_sent: !!adminEmailResult.data
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error sending order confirmation:", error);
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
};

serve(handler);