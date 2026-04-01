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

    // Since author_email was removed from blog_comments for privacy,
    // this function now only logs. Comment reply notifications
    // are no longer sent to individual commenters.
    console.log("Comment reply notifications disabled (author_email removed for privacy)");

    return new Response(
      JSON.stringify({ success: true, sent: 0, message: "Notifications disabled" }),
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
