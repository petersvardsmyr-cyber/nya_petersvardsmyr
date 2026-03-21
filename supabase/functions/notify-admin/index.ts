import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const ADMIN_EMAIL = "hej@petersvardsmyr.se";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyAdminRequest {
  type: "new_comment" | "new_blog_subscriber" | "new_newsletter_subscriber";
  // new_comment
  author_name?: string;
  comment?: string;
  post_title?: string;
  post_slug?: string;
  // new_blog_subscriber / new_newsletter_subscriber
  subscriber_email?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: NotifyAdminRequest = await req.json();
    console.log("Admin notification:", data.type);

    let subject = "";
    let html = "";
    const siteUrl = "https://petersvardsmyr.se";

    switch (data.type) {
      case "new_comment": {
        const name = data.author_name || "Anonym";
        const postUrl = `${siteUrl}/blogg/${data.post_slug}`;
        subject = `Ny kommentar på "${data.post_title}"`;
        html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="font-size: 20px; margin-bottom: 8px;">Ny kommentar</h2>
  <p style="color: #666; margin-bottom: 4px;"><strong>${name}</strong> kommenterade på <a href="${postUrl}" style="color: #1a1a1a;">${data.post_title}</a>:</p>
  <blockquote style="border-left: 3px solid #ddd; padding-left: 16px; margin: 16px 0; color: #555;">
    ${(data.comment || "").substring(0, 500)}
  </blockquote>
  <p>
    <a href="${postUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 14px;">
      Visa inlägget
    </a>
  </p>
</body>
</html>`;
        break;
      }

      case "new_blog_subscriber": {
        subject = "Ny bloggprenumerant";
        html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="font-size: 20px; margin-bottom: 8px;">Ny bloggprenumerant</h2>
  <p><strong>${data.subscriber_email}</strong> har bekräftat sin prenumeration på bloggen.</p>
</body>
</html>`;
        break;
      }

      case "new_newsletter_subscriber": {
        subject = "Ny nyhetsbrevsprenumerant";
        html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="font-size: 20px; margin-bottom: 8px;">Ny nyhetsbrevsprenumerant</h2>
  <p><strong>${data.subscriber_email}</strong> har bekräftat sin prenumeration på nyhetsbrevet.</p>
</body>
</html>`;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown notification type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    await resend.emails.send({
      from: "petersvardsmyr.se <info@petersvardsmyr.se>",
      to: [ADMIN_EMAIL],
      subject,
      html,
    });

    console.log(`Admin notification sent: ${data.type}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-admin:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
