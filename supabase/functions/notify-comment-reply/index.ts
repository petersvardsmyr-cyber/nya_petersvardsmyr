import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommentNotifyRequest {
  post_id: string;
  reply_author_name: string;
  reply_author_email?: string;
  reply_content: string;
  post_slug: string;
  post_title: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: CommentNotifyRequest = await req.json();
    console.log("Comment notification for post:", data.post_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Hämta alla kommentarer på detta inlägg som har e-post
    const { data: comments, error } = await supabase
      .from("blog_comments")
      .select("author_email, author_name")
      .eq("post_id", data.post_id)
      .not("author_email", "is", null);

    if (error) {
      console.error("Error fetching comments:", error);
      throw error;
    }

    if (!comments || comments.length === 0) {
      console.log("No commenters with email found");
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unika e-postadresser, exkludera den som just kommenterade
    const uniqueEmails = [...new Set(
      comments
        .map(c => c.author_email as string)
        .filter(email => email !== data.reply_author_email)
    )];

    if (uniqueEmails.length === 0) {
      console.log("No other commenters to notify");
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siteUrl = "https://petersvardsmyr.se";
    const postUrl = `${siteUrl}/blogg/${data.post_slug}`;
    const replyAuthor = data.reply_author_name || "Någon";

    let sentCount = 0;

    for (const email of uniqueEmails) {
      try {
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="font-size: 20px; margin-bottom: 8px;">Ny kommentar på "${data.post_title}"</h2>
  <p><strong>${replyAuthor}</strong> har kommenterat på ett inlägg du också kommenterat:</p>
  <blockquote style="border-left: 3px solid #ddd; padding-left: 16px; margin: 16px 0; color: #555;">
    ${data.reply_content.substring(0, 500)}
  </blockquote>
  <p>
    <a href="${postUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 14px;">
      Läs kommentaren
    </a>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="font-size: 12px; color: #999;">
    Du får detta mejl för att du angav din e-post vid kommentering på petersvardsmyr.se.
  </p>
</body>
</html>`;

        await resend.emails.send({
          from: "Peter Svärdsmyr <info@petersvardsmyr.se>",
          to: [email],
          subject: `Ny kommentar på "${data.post_title}"`,
          html,
        });

        sentCount++;
        console.log(`Notification sent to: ${email}`);
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
      }
    }

    console.log(`Comment notifications complete: ${sentCount} sent`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-comment-reply:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
