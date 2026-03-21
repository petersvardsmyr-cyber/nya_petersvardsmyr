import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BlogNotificationRequest {
  post_id: string;
  title: string;
  excerpt: string;
  slug: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      console.error("Not admin:", roleError);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { post_id, title, excerpt, slug }: BlogNotificationRequest = await req.json();
    console.log("Sending blog notification for:", title);

    // Get blog subscribers (subscription_type = 'blog')
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: subscribers, error: subError } = await adminClient
      .from("newsletter_subscribers")
      .select("email")
      .eq("is_active", true)
      .eq("subscription_type", "blog");

    if (subError) {
      console.error("Error fetching subscribers:", subError);
      throw subError;
    }

    if (!subscribers || subscribers.length === 0) {
      console.log("No blog subscribers found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscribers" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscribers.length} blog subscribers`);

    const siteUrl = "https://petersvardsmyr.se";
    const postUrl = `${siteUrl}/blogg/${slug}`;
    const unsubscribeBaseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe-newsletter`;

    let successCount = 0;
    let errorCount = 0;

    // Send emails in batches
    const batchSize = 5;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (subscriber) => {
          try {
            const unsubscribeUrl = `${unsubscribeBaseUrl}?email=${encodeURIComponent(subscriber.email)}`;

            const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f0eb; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f0eb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width: 560px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px; text-align: center;">
              <a href="${siteUrl}" style="text-decoration: none; color: #1a1a1a;">
                <span style="font-family: Georgia, serif; font-size: 18px; letter-spacing: 0.5px; color: #1a1a1a;">Peter Svärdsmyr</span>
              </a>
              <div style="width: 40px; height: 1px; background-color: #c4b5a3; margin: 12px auto 0;"></div>
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 4px; padding: 40px 36px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

              <!-- Label -->
              <p style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #a09080;">
                Nytt blogginlägg
              </p>

              <!-- Title -->
              <h1 style="margin: 0 0 20px 0; font-family: Georgia, serif; font-size: 26px; font-weight: normal; line-height: 1.3; color: #1a1a1a;">
                ${title}
              </h1>

              <!-- Excerpt -->
              ${excerpt ? `
              <p style="margin: 0 0 28px 0; font-family: Georgia, serif; font-size: 16px; line-height: 1.7; color: #555;">
                ${excerpt}
              </p>
              ` : ''}

              <!-- CTA Button -->
              <a href="${postUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; font-weight: 500; padding: 13px 28px; text-decoration: none; border-radius: 3px; letter-spacing: 0.3px;">
                Läs inlägget →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 0; text-align: center;">
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #a09080; line-height: 1.6;">
                Du får detta mejl för att du prenumererar på bloggen.
              </p>
              <p style="margin: 6px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px;">
                <a href="${unsubscribeUrl}" style="color: #a09080; text-decoration: underline;">Avsluta prenumeration</a>
                &nbsp;&middot;&nbsp;
                <a href="${siteUrl}" style="color: #a09080; text-decoration: underline;">petersvardsmyr.se</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

            await resend.emails.send({
              from: "Peter Svärdsmyr <hej@petersvardsmyr.se>",
              to: [subscriber.email],
              subject: `${title}`,
              html,
            });

            successCount++;
            console.log(`Email sent to: ${subscriber.email}`);
          } catch (err) {
            errorCount++;
            console.error(`Failed to send to ${subscriber.email}:`, err);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < subscribers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Blog notification complete: ${successCount} sent, ${errorCount} failed`);

    return new Response(
      JSON.stringify({ success: true, sent: successCount, failed: errorCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-blog-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
