import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import { checkFunctionRateLimit, createRateLimitResponse } from "../_shared/functionRateLimit.ts";

const InviteRequestSchema = z.object({
  inviteeEmail: z.string().email("Invalid email address").max(255, "Email too long"),
  inviterName: z.string().min(1, "Inviter name required").max(100, "Name too long"),
  token: z.string().uuid("Invalid token format"),
  primaryParentId: z.string().uuid("Invalid primary parent ID"),
});

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-THIRD-PARTY-INVITE] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      logStep("Authentication failed");
      return new Response(
        JSON.stringify({ success: false, error: "Authentication failed" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("User authenticated", { userId: userData.user.id });

    // Check rate limit
    const rateLimitResult = await checkFunctionRateLimit(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      userData.user.id,
      "send-third-party-invite"
    );

    if (!rateLimitResult.allowed) {
      logStep("Rate limit exceeded", { remaining: rateLimitResult.remaining });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const rawBody = await req.json();
    const parseResult = InviteRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      logStep("Validation failed", { errors: parseResult.error.flatten() });
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request data" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { inviteeEmail, inviterName, token: inviteToken, primaryParentId } = parseResult.data;
    logStep("Input validated", { inviteeEmail, primaryParentId });

    // Verify the invitation exists
    const { data: invitation, error: inviteError } = await supabaseClient
      .from('invitations')
      .select('id, inviter_id, status, invitation_type')
      .eq('token', inviteToken)
      .single();

    if (inviteError || !invitation) {
      logStep("Invitation not found", { token: inviteToken });
      return new Response(
        JSON.stringify({ success: false, error: "Invitation not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (invitation.status !== 'pending') {
      logStep("Invitation already processed", { status: invitation.status });
      return new Response(
        JSON.stringify({ success: false, error: "This invitation has already been processed" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Invitation verified", { invitationId: invitation.id });

    const appUrl = "https://coparrent.com";
    const inviteLink = `${appUrl}/accept-invite?token=${inviteToken}&type=third_party`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      logStep("ERROR: RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service unavailable" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const fromAddress = "CoParrent <noreply@coparrent.com>";
    logStep("Sending email", { from: fromAddress, to: inviteeEmail });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [inviteeEmail],
        subject: `${inviterName} invited you to join their family on CoParrent`,
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
              .button { display: inline-block; background: linear-gradient(135deg, #2563eb, #0d9488); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
              .footer { text-align: center; color: #64748b; font-size: 14px; }
              .permissions { background: #e0f2fe; border-radius: 8px; padding: 16px; margin-top: 20px; }
              .permissions h4 { margin-top: 0; color: #0369a1; }
              .permissions ul { margin-bottom: 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">Co<span class="logo-accent">Parrent</span></div>
              </div>
              <div class="content">
                <h2 style="margin-top: 0;">You've been invited to join a family!</h2>
                <p><strong>${inviterName}</strong> has invited you to join their family group on CoParrent as a trusted family member.</p>
                
                <div class="permissions">
                  <h4>As a family member, you'll be able to:</h4>
                  <ul>
                    <li>Send and receive messages in the family chat</li>
                    <li>View the children's calendar (read-only)</li>
                    <li>Keep your own private journal</li>
                    <li>Access the law library and blog</li>
                  </ul>
                </div>
                
                <p style="text-align: center; margin-top: 30px;">
                  <a href="${inviteLink}" class="button">Accept Invitation</a>
                </p>
                <p style="font-size: 14px; color: #64748b; margin-top: 20px;">This invitation expires in 7 days.</p>
              </div>
              <div class="footer">
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
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
      logStep("Resend API error", { status: emailResponse.status, error: result });
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send invitation email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Email sent successfully", { messageId: result.id });

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
