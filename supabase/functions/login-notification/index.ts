import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

interface LoginNotificationRequest {
  userId: string;
  userEmail: string;
  deviceFingerprint: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Strict CORS validation
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, userEmail, deviceFingerprint, deviceName, browser, os, ipAddress }: LoginNotificationRequest = await req.json();

    console.log(`Processing login notification for user ${userId}`);

    // Check if this device is already known
    const { data: existingDevice, error: fetchError } = await supabase
      .from("user_devices")
      .select("*")
      .eq("user_id", userId)
      .eq("device_fingerprint", deviceFingerprint)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching device:", fetchError);
      throw fetchError;
    }

    const now = new Date().toISOString();
    let isNewDevice = false;

    if (existingDevice) {
      // Update last seen
      console.log("Known device, updating last seen");
      await supabase
        .from("user_devices")
        .update({ last_seen_at: now })
        .eq("id", existingDevice.id);
    } else {
      // New device - insert and send notification
      isNewDevice = true;
      console.log("New device detected, creating record");

      const { error: insertError } = await supabase
        .from("user_devices")
        .insert({
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          device_name: deviceName,
          browser: browser,
          os: os,
          ip_address: ipAddress || "Unknown",
          first_seen_at: now,
          last_seen_at: now,
        });

      if (insertError) {
        console.error("Error inserting device:", insertError);
        throw insertError;
      }

      // Get user's profile for notification preferences
      const { data: profile } = await supabase
        .from("profiles")
        .select("notification_preferences, full_name, id")
        .eq("user_id", userId)
        .maybeSingle();

      const notificationEnabled = profile?.notification_preferences?.enabled !== false;

      if (notificationEnabled && profile) {
        // Create in-app notification
        await supabase
          .from("notifications")
          .insert({
            user_id: profile.id,
            type: "security",
            title: "New Device Login",
            message: `Your account was accessed from a new device: ${deviceName} (${browser} on ${os})`,
            related_id: null,
          });

        console.log("In-app notification created");

        // Send email notification if Resend is configured
        if (resendApiKey && userEmail) {
          const loginTime = new Date().toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
          });

          try {
            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: "CoParrent Security <security@resend.dev>",
                to: [userEmail],
                subject: "New Device Login Detected - CoParrent",
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
                      .header h1 { color: white; margin: 0; font-size: 24px; }
                      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
                      .device-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
                      .device-info p { margin: 8px 0; }
                      .warning { background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px; }
                      .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1>🔔 New Device Login</h1>
                      </div>
                      <div class="content">
                        <p>Hi ${profile.full_name || "there"},</p>
                        <p>We noticed a new login to your CoParrent account from a device we don't recognize:</p>
                        
                        <div class="device-info">
                          <p><strong>Device:</strong> ${deviceName}</p>
                          <p><strong>Browser:</strong> ${browser}</p>
                          <p><strong>Operating System:</strong> ${os}</p>
                          <p><strong>Time:</strong> ${loginTime}</p>
                          ${ipAddress ? `<p><strong>IP Address:</strong> ${ipAddress}</p>` : ""}
                        </div>
                        
                        <p>If this was you, no action is needed. You can mark this device as trusted in your account settings.</p>
                        
                        <div class="warning">
                          <strong>⚠️ Wasn't you?</strong><br>
                          If you didn't sign in from this device, please change your password immediately and review your account security settings.
                        </div>
                        
                        <div class="footer">
                          <p>This is an automated security notification from CoParrent.</p>
                        </div>
                      </div>
                    </div>
                  </body>
                  </html>
                `,
              }),
            });

            if (emailResponse.ok) {
              console.log("Email notification sent");
            } else {
              const errorData = await emailResponse.text();
              console.error("Email send failed:", errorData);
            }
          } catch (emailError) {
            console.error("Error sending email:", emailError);
            // Don't throw - email failure shouldn't block login
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        isNewDevice,
        message: isNewDevice ? "New device detected, notification sent" : "Known device"
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in login-notification function:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Unable to process login notification. Please try again." }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
