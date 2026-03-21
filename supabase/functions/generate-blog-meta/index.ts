import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  content: string;
  title: string;
  type: "excerpt" | "meta_description" | "both";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { content, title, type }: GenerateRequest = await req.json();

    if (!content || !title) {
      return new Response(JSON.stringify({ error: "Titel och innehåll krävs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI API-nyckel saknas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip HTML tags for cleaner input
    const plainContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    // Limit content to avoid huge prompts
    const truncatedContent = plainContent.substring(0, 3000);

    let prompt = "";
    if (type === "excerpt" || type === "both") {
      prompt += `Skriv en kort, engagerande sammanfattning (2-3 meningar, max 200 tecken) av följande blogginlägg. Sammanfattningen ska locka till läsning utan att avslöja hela innehållet. Skriv på svenska.\n\n`;
    }
    if (type === "meta_description" || type === "both") {
      if (type === "both") {
        prompt += `Skriv också en SEO-optimerad meta-beskrivning (max 155 tecken) på svenska. Den ska vara koncis och tydligt beskriva vad inlägget handlar om.\n\n`;
      } else {
        prompt += `Skriv en SEO-optimerad meta-beskrivning (max 155 tecken) på svenska för följande blogginlägg. Den ska vara koncis och tydligt beskriva vad inlägget handlar om.\n\n`;
      }
    }

    prompt += `Titel: ${title}\n\nInnehåll:\n${truncatedContent}`;

    if (type === "both") {
      prompt += `\n\nSvara i JSON-format exakt så här:\n{"excerpt": "...", "meta_description": "..."}`;
    } else if (type === "excerpt") {
      prompt += `\n\nSvara i JSON-format exakt så här:\n{"excerpt": "..."}`;
    } else {
      prompt += `\n\nSvara i JSON-format exakt så här:\n{"meta_description": "..."}`;
    }

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", errorText);
      return new Response(JSON.stringify({ error: "AI-tjänsten svarade med ett fel" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const aiText = aiResponse.content?.[0]?.text || "";

    // Parse JSON from response
    const jsonMatch = aiText.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      console.error("Could not parse AI response:", aiText);
      return new Response(JSON.stringify({ error: "Kunde inte tolka AI-svaret" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in generate-blog-meta:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
