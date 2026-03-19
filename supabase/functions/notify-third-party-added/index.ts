import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[NOTIFY-THIRD-PARTY-ADDED] ${step}${detailsStr}`);
};

const handler = async (req: Request): Promise<Response> => {
  // Strict CORS validation
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { thirdPartyName, thirdPartyEmail, primaryParentId } = await req.json();
    
    if (!thirdPartyName || !thirdPartyEmail || !primaryParentId) {
      logStep("Missing required fields");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Input validated", { thirdPartyEmail, primaryParentId });

    // Get the primary parent and co-parent
    const { data: primaryParent, error: parentError } = await supabaseClient
      .from("profiles")
      .select("id, full_name, email, co_parent_id")
      .eq("id", primaryParentId)
      .single();

    if (parentError || !primaryParent) {
      logStep("Primary parent not found", { error: parentError });
      return new Response(
        JSON.stringify({ success: false, error: "Primary parent not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const parentEmails: string[] = [];
    const parentNames: string[] = [];

    if (primaryParent.email) {
      parentEmails.push(primaryParent.email);
      parentNames.push(primaryParent.full_name || "Parent");
    }

    // Get co-parent if exists
    if (primaryParent.co_parent_id) {
      const { data: coParent } = await supabaseClient
        .from("profiles")
        .select("email, full_name")
        .eq("id", primaryParent.co_parent_id)
        .single();

      if (coParent?.email) {
        parentEmails.push(coParent.email);
        parentNames.push(coParent.full_name || "Co-Parent");
      }
    }

    if (parentEmails.length === 0) {
      logStep("No parent emails found");
      return new Response(
        JSON.stringify({ success: false, error: "No parent emails found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Found parents to notify", { parentEmails });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      logStep("ERROR: RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service unavailable" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const fromAddress = "CoParrent <noreply@coparrent.com>";
    const appUrl = "https://coparrent.com";

    // Send notification to all parents
    for (const parentEmail of parentEmails) {
      logStep("Sending notification email", { to: parentEmail });

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [parentEmail],
          subject: `${thirdPartyName} has joined your family group`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #2563eb; }
                .logo-accent { color: #0d9488; }
                .content { background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 30px; }
                .alert-box { background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin-top: 20px; }
                .button { display: inline-block; background: linear-gradient(135deg, #2563eb, #0d9488); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
                .footer { text-align: center; color: #64748b; font-size: 14px; }
                .member-info { background: white; border-radius: 8px; padding: 16px; margin-top: 16px; border: 1px solid #e2e8f0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">Co<span class="logo-accent">Parrent</span></div>
                </div>
                <div class="content">
                  <h2 style="margin-top: 0;">New Family Member Added</h2>
                  <p>A new family member has joined your family group on CoParrent.</p>
                  
                  <div class="member-info">
                    <p style="margin: 0;"><strong>Name:</strong> ${thirdPartyName}</p>
                    <p style="margin: 8px 0 0;"><strong>Email:</strong> ${thirdPartyEmail}</p>
                  </div>
                  
                  <div class="alert-box">
                    <p style="margin: 0; color: #166534;"><strong>What they can access:</strong></p>
                    <ul style="margin: 8px 0 0; color: #166534;">
                      <li>Family messaging</li>
                      <li>Calendar (view only)</li>
                      <li>Their own journal</li>
                      <li>Law library and blog</li>
                    </ul>
                  </div>
                  
                  <p style="margin-top: 20px;">If you did not expect this, you can manage your family members in the settings.</p>
                  
                  <p style="text-align: center; margin-top: 30px;">
                    <a href="${appUrl}/dashboard/settings" class="button">View Settings</a>
                  </p>
                </div>
                <div class="footer">
                  <p>© CoParrent - Making co-parenting easier</p>
                </div>
              </div>
            </body>
            </html>
          `,
        }),
      });

      const result = await emailResponse.json();

      if (!emailResponse.ok) {
        logStep("Resend API error", { status: emailResponse.status, error: result, to: parentEmail });
      } else {
        logStep("Email sent successfully", { messageId: result.id, to: parentEmail });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);