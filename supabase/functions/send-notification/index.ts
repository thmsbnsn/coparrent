import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import { checkFunctionRateLimit, createRateLimitResponse } from "../_shared/functionRateLimit.ts";
import { buildAppUrl } from "../_shared/appUrl.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
type SupabaseServiceClient = ReturnType<typeof createClient>;

interface NotificationPayload {
  type: "new_message" | "schedule_change" | "schedule_response" | "document_upload" | "child_update" | "exchange_reminder";
  recipient_profile_id: string;
  sender_name?: string;
  title: string;
  message: string;
  action_url?: string;
  data?: Record<string, unknown>;
}

/**
 * Get email template - NO SENSITIVE CONTENT
 * Only includes neutral copy and CTA link
 */
const getEmailTemplate = (payload: NotificationPayload): { subject: string; html: string } => {
  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #ffffff;
  `;

  const headerStyles = `
    background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
    color: white;
    padding: 30px;
    text-align: center;
    border-radius: 12px 12px 0 0;
  `;

  const contentStyles = `
    padding: 30px;
    background-color: #f8faf8;
    border: 1px solid #e5ebe5;
    border-top: none;
    border-radius: 0 0 12px 12px;
  `;

  const buttonStyles = `
    display: inline-block;
    background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
    color: white;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    margin-top: 20px;
  `;

  const footerStyles = `
    text-align: center;
    padding: 20px;
    color: #666;
    font-size: 12px;
  `;

  const actionUrl = payload.action_url || buildAppUrl("/dashboard");
  const settingsUrl = buildAppUrl("/dashboard/settings");

  // PRIVACY: Generic messages only - no actual content
  const safeMessageMap: Record<NotificationPayload["type"], string> = {
    new_message: "You have a new message waiting for you in CoParrent.",
    schedule_change: "A schedule change has been requested. Please review it in the app.",
    schedule_response: "Your schedule request has been updated.",
    document_upload: "A new document has been shared with you.",
    child_update: "Child information has been updated.",
    exchange_reminder: "You have an upcoming custody exchange.",
  };

  const safeMessage = safeMessageMap[payload.type] || "You have a new notification in CoParrent.";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${baseStyles}">
      <div style="${headerStyles}">
        <h1 style="margin: 0; font-size: 24px;">CoParrent</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">Co-parenting made simpler</p>
      </div>
      <div style="${contentStyles}">
        <h2 style="color: #1e3a5f; margin-top: 0;">${payload.title}</h2>
        <p style="color: #333; line-height: 1.6;">${safeMessage}</p>
        <a href="${actionUrl}" style="${buttonStyles}">View in CoParrent</a>
      </div>
      <div style="${footerStyles}">
        <p>You're receiving this because you have notifications enabled in CoParrent.</p>
        <p>To change your notification preferences, visit your <a href="${settingsUrl}" style="color: #1e3a5f;">settings</a>.</p>
      </div>
    </body>
    </html>
  `;

  const subjectMap: Record<NotificationPayload["type"], string> = {
    new_message: "New message in CoParrent",
    schedule_change: "Schedule change request",
    schedule_response: "Schedule request update",
    document_upload: "New document shared",
    child_update: "Child information updated",
    exchange_reminder: "Upcoming custody exchange",
  };

  return {
    subject: subjectMap[payload.type] || payload.title,
    html,
  };
};

/**
 * Audit log for notification sends (high-level, no payload)
 */
async function logNotificationAudit(
  supabase: SupabaseServiceClient,
  type: string,
  recipientId: string,
  channel: "email" | "push" | "in_app",
  success: boolean
): Promise<void> {
  try {
    // Insert directly into audit_logs table for system events
    await supabase.from("audit_logs").insert({
      actor_user_id: "00000000-0000-0000-0000-000000000000",
      actor_role_at_action: "system",
      action: `NOTIFICATION_${channel.toUpperCase()}_${success ? "SENT" : "FAILED"}`,
      entity_type: "notification",
      metadata: {
        notification_type: type,
        recipient_id: recipientId,
        channel,
        success,
      },
    });
  } catch (error) {
    // Non-blocking audit
    console.error("Audit log failed (non-blocking):", error);
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Strict CORS validation
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for auth (optional for system-triggered notifications)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id || null;
      
      // Apply rate limiting for authenticated user requests
      if (userId) {
        const rateLimitResult = await checkFunctionRateLimit(
          supabaseUrl,
          supabaseServiceKey,
          userId,
          "send-notification"
        );

        if (!rateLimitResult.allowed) {
          console.log("Rate limit exceeded for send-notification", { userId });
          return createRateLimitResponse(rateLimitResult, corsHeaders);
        }
      }
    }

    const payload: NotificationPayload = await req.json();
    // Sanitized log - no message content
    console.log("Notification request:", { type: payload.type, recipient: payload.recipient_profile_id });

    // Get recipient's profile and preferences
    const { data: recipientProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, notification_preferences")
      .eq("id", payload.recipient_profile_id)
      .single();

    if (profileError || !recipientProfile) {
      console.error("Recipient not found:", payload.recipient_profile_id);
      return new Response(
        JSON.stringify({ error: "Recipient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const preferences = recipientProfile.notification_preferences as Record<string, boolean> | null;
    
    // Check if notifications are enabled
    if (preferences && !preferences.enabled) {
      console.log("Notifications disabled for recipient");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "notifications_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check specific preference
    const preferenceMap: Record<string, string> = {
      new_message: "new_messages",
      schedule_change: "schedule_changes",
      schedule_response: "schedule_changes",
      document_upload: "document_uploads",
      child_update: "child_info_updates",
      exchange_reminder: "upcoming_exchanges",
    };

    const preferenceKey = preferenceMap[payload.type];
    if (preferences && preferenceKey && !preferences[preferenceKey]) {
      console.log(`Preference ${preferenceKey} is disabled for recipient`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: `${preferenceKey}_disabled` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create in-app notification
    let inAppSuccess = false;
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: recipientProfile.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      related_id: payload.data?.related_id || null,
    });

    if (notifError) {
      console.error("Error creating in-app notification:", notifError);
      await logNotificationAudit(supabase, payload.type, payload.recipient_profile_id, "in_app", false);
    } else {
      inAppSuccess = true;
      await logNotificationAudit(supabase, payload.type, payload.recipient_profile_id, "in_app", true);
    }

    // Send email notification
    let emailSent = false;
    if (recipientProfile.email) {
      try {
        const { subject, html } = getEmailTemplate(payload);
        
        const { error: emailError } = await resend.emails.send({
          from: "CoParrent <notifications@resend.dev>",
          to: [recipientProfile.email],
          subject,
          html,
        });

        if (emailError) {
          console.error("Email send failed");
          await logNotificationAudit(supabase, payload.type, payload.recipient_profile_id, "email", false);
        } else {
          emailSent = true;
          await logNotificationAudit(supabase, payload.type, payload.recipient_profile_id, "email", true);
          console.log("Email sent successfully");
        }
      } catch (emailErr) {
        console.error("Email exception");
        await logNotificationAudit(supabase, payload.type, payload.recipient_profile_id, "email", false);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification_created: inAppSuccess,
        email_sent: emailSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-notification");
    return new Response(
      JSON.stringify({ error: "Unable to send notification. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
