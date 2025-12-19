import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  inviteeEmail: string;
  inviterName: string;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inviteeEmail, inviterName, token }: InviteRequest = await req.json();

    console.log("Sending invite email to:", inviteeEmail);

    // Get the app URL from the request origin or use a default
    const origin = req.headers.get("origin") || "https://coparrent.com";
    const inviteLink = `${origin}/accept-invite?token=${token}`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CoParrent <onboarding@resend.dev>",
        to: [inviteeEmail],
        subject: `${inviterName} invited you to co-parent on CoParrent`,
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
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">Co<span class="logo-accent">Parrent</span></div>
              </div>
              <div class="content">
                <h2 style="margin-top: 0;">You've been invited to co-parent!</h2>
                <p><strong>${inviterName}</strong> has invited you to join CoParrent, a co-parenting coordination platform that helps families communicate better and manage custody schedules.</p>
                <p>With CoParrent, you can:</p>
                <ul>
                  <li>Share and manage custody calendars</li>
                  <li>Send court-friendly messages</li>
                  <li>Track children's important information</li>
                  <li>Generate legal documentation</li>
                </ul>
                <p>You'll both get a <strong>7-day free trial</strong> with full access to all features once you accept this invitation.</p>
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
      console.error("Resend API error:", result);
      throw new Error(result.message || "Failed to send email");
    }

    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invite email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
