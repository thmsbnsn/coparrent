import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { buildAppUrl } from "../_shared/appUrl.ts";
import {
  calculateLeaveByTime,
  estimateDistance,
  getParentResponsibility,
  getRequiredEquipment,
  PREP_TIME_MINUTES,
  type ReminderEquipmentItem,
} from "../_shared/reminderHelpers.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
type SupabaseServiceClient = ReturnType<typeof createClient>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reminder intervals in minutes before event start
const REMINDER_INTERVALS = [
  { minutes: 1440, label: "24 hours", prefKey: "sports_reminder_24h" },
  { minutes: 120, label: "2 hours", prefKey: "sports_reminder_2h" },
  { minutes: 60, label: "1 hour", prefKey: "sports_reminder_1h" },
];

interface SportsEvent {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  event_type: string;
  location_name: string | null;
  location_address: string | null;
  venue_notes: string | null;
  equipment_needed: ReminderEquipmentItem[] | null;
  dropoff_parent_id: string | null;
  pickup_parent_id: string | null;
  activity_id: string;
  is_cancelled: boolean;
}

interface ActivityInfo {
  name: string;
  sport_type: string;
  child_id: string;
  child_name: string;
  primary_parent_id: string;
}

interface ActivityRow {
  id: string;
  name: string;
  sport_type: string;
  child_id: string;
  primary_parent_id: string;
  children: { id: string; name: string } | null;
}

const getEmailHtml = (
  recipientName: string,
  event: SportsEvent,
  activity: ActivityInfo,
  reminderLabel: string,
  responsibility: string | null,
  leaveByTime: string | null,
  equipment: string[]
) => {
  const sportsUrl = buildAppUrl("/dashboard/sports");
  const settingsUrl = buildAppUrl("/dashboard/settings");
  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #ffffff;
  `;

  const headerStyles = `
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    padding: 30px;
    text-align: center;
    border-radius: 12px 12px 0 0;
  `;

  const contentStyles = `
    padding: 30px;
    background-color: #fffbeb;
    border: 1px solid #fcd34d;
    border-top: none;
    border-radius: 0 0 12px 12px;
  `;

  const highlightBoxStyles = `
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border-left: 4px solid #f59e0b;
    padding: 20px;
    margin: 20px 0;
    border-radius: 0 8px 8px 0;
  `;

  const leaveByBoxStyles = `
    background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    border-left: 4px solid #22c55e;
    padding: 15px;
    margin: 15px 0;
    border-radius: 0 8px 8px 0;
  `;

  const equipmentBoxStyles = `
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    padding: 15px;
    margin: 15px 0;
    border-radius: 8px;
  `;

  const buttonStyles = `
    display: inline-block;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    margin-top: 20px;
  `;

  const locationDisplay = event.location_name 
    ? `<p style="margin: 8px 0; color: #333;"><strong>📍 Location:</strong> ${event.location_name}${event.location_address ? ` - ${event.location_address}` : ''}</p>` 
    : "";

  const responsibilityDisplay = responsibility
    ? `<p style="margin: 8px 0; color: #333;"><strong>🚗 Your responsibility:</strong> ${responsibility}</p>`
    : "";

  const leaveByDisplay = leaveByTime
    ? `<div style="${leaveByBoxStyles}">
        <p style="margin: 0; color: #166534; font-weight: 600;">🚦 Leave by: ${leaveByTime}</p>
        <p style="margin: 5px 0 0; color: #15803d; font-size: 14px;">Based on estimated travel time + ${PREP_TIME_MINUTES} min prep</p>
      </div>`
    : "";

  const venueNotesDisplay = event.venue_notes
    ? `<p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>📝 Venue notes:</strong> ${event.venue_notes}</p>`
    : "";

  const equipmentDisplay = equipment.length > 0
    ? `<div style="${equipmentBoxStyles}">
        <p style="margin: 0 0 10px; color: #333; font-weight: 600;">🎒 Equipment needed:</p>
        <ul style="margin: 0; padding-left: 20px; color: #555;">
          ${equipment.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>`
    : "";

  const eventTypeEmoji = {
    'practice': '🏋️',
    'game': '🏆',
    'tournament': '🎖️',
    'meeting': '📋',
    'tryout': '🔍',
    'other': '📅'
  }[event.event_type] || '📅';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${baseStyles}">
      <div style="${headerStyles}">
        <h1 style="margin: 0; font-size: 24px;">🏅 Sports Event Reminder</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">CoParrent</p>
      </div>
      <div style="${contentStyles}">
        <p style="color: #333; font-size: 16px;">Hi ${recipientName || "there"},</p>
        <p style="color: #333; line-height: 1.6;">
          This is a reminder that <strong>${activity.child_name}</strong> has a <strong>${activity.sport_type}</strong> ${event.event_type} coming up in <strong>${reminderLabel}</strong>.
        </p>
        
        <div style="${highlightBoxStyles}">
          <p style="margin: 0 0 8px; color: #92400e; font-weight: 600; font-size: 18px;">
            ${eventTypeEmoji} ${event.title}
          </p>
          <p style="margin: 8px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <p style="margin: 8px 0; color: #333;"><strong>⏰ Time:</strong> ${event.start_time}${event.end_time ? ` - ${event.end_time}` : ''}</p>
          ${locationDisplay}
          ${responsibilityDisplay}
        </div>
        
        ${leaveByDisplay}
        ${equipmentDisplay}
        ${venueNotesDisplay}
        
        <a href="${sportsUrl}" style="${buttonStyles}">
          View in Sports Hub
        </a>
      </div>
      <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
        <p>You're receiving this because you have sports event reminders enabled.</p>
        <p>
          <a href="${settingsUrl}" style="color: #f59e0b;">
            Manage notification preferences
          </a>
        </p>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Sports event reminders function triggered at:", new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const results = { sent: 0, skipped: 0, errors: 0 };

    // Fetch upcoming sports events (next 48 hours)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 2);

    const { data: events, error: eventsError } = await supabase
      .from("activity_events")
      .select("*")
      .eq("is_cancelled", false)
      .gte("event_date", now.toISOString().split('T')[0])
      .lte("event_date", tomorrow.toISOString().split('T')[0]);

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw eventsError;
    }

    console.log(`Found ${events?.length || 0} upcoming sports events`);

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ success: true, timestamp: now.toISOString(), results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get activity details for all events
    const activityIds = [...new Set(events.map(e => e.activity_id))];
    const { data: activities } = await supabase
      .from("child_activities")
      .select(`
        id, name, sport_type, child_id, primary_parent_id,
        children:child_id (id, name)
      `)
      .in("id", activityIds);

    const activitiesMap = new Map<string, ActivityInfo>();
    for (const activity of (activities || []) as ActivityRow[]) {
      activitiesMap.set(activity.id, {
        name: activity.name,
        sport_type: activity.sport_type,
        child_id: activity.child_id,
        child_name: activity.children?.name || "Child",
        primary_parent_id: activity.primary_parent_id,
      });
    }

    // Process each event
    for (const event of events) {
      const activity = activitiesMap.get(event.activity_id);
      if (!activity) continue;

      // Parse event datetime
      const [hours, minutes] = event.start_time.split(':').map(Number);
      const eventDateTime = new Date(event.event_date);
      eventDateTime.setHours(hours, minutes, 0, 0);

      // Check each reminder interval
      for (const interval of REMINDER_INTERVALS) {
        const reminderTime = new Date(eventDateTime.getTime() - interval.minutes * 60 * 1000);
        const timeDiff = Math.abs(now.getTime() - reminderTime.getTime());

        // If we're within 5 minutes of the reminder time, send it
        if (timeDiff <= 5 * 60 * 1000) {
          console.log(`Sending ${interval.label} reminder for event: ${event.title}`);

          // Calculate leave-by time
          const distanceMiles = estimateDistance(event.location_address);
          const leaveByTime = calculateLeaveByTime(event.start_time, distanceMiles);

          // Get equipment list
          const equipment = getRequiredEquipment(event.equipment_needed);

          // Get parents to notify
          const parentsToNotify: { id: string; responsibility: string | null }[] = [];

          // Always notify primary parent
          parentsToNotify.push({ id: activity.primary_parent_id, responsibility: null });

          // Get co-parent
          const { data: primaryProfile } = await supabase
            .from("profiles")
            .select("co_parent_id")
            .eq("id", activity.primary_parent_id)
            .single();

          if (primaryProfile?.co_parent_id) {
            parentsToNotify.push({ id: primaryProfile.co_parent_id, responsibility: null });
          }

          // Update responsibilities
          for (const parent of parentsToNotify) {
            parent.responsibility = getParentResponsibility(
              parent.id,
              event.dropoff_parent_id,
              event.pickup_parent_id,
            );
          }

          // Send notifications to each parent
          for (const parent of parentsToNotify) {
            const result = await sendSportsReminder(
              supabase,
              parent.id,
              event as SportsEvent,
              activity,
              interval.label,
              interval.prefKey,
              parent.responsibility,
              leaveByTime,
              equipment
            );

            if (result.success) {
              if (result.sent) results.sent++;
              else results.skipped++;
            } else {
              results.errors++;
            }
          }
        }
      }
    }

    console.log("Sports event reminders complete:", results);

    return new Response(
      JSON.stringify({ success: true, timestamp: now.toISOString(), results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in sports-event-reminders:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Unable to process sports event reminders. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

async function sendSportsReminder(
  supabase: SupabaseServiceClient,
  parentProfileId: string,
  event: SportsEvent,
  activity: ActivityInfo,
  reminderLabel: string,
  reminderPrefKey: string,
  responsibility: string | null,
  leaveByTime: string | null,
  equipment: string[]
): Promise<{ success: boolean; sent: boolean }> {
  try {
    // Get parent profile and preferences
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, notification_preferences")
      .eq("id", parentProfileId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return { success: false, sent: false };
    }

    const preferences = profile.notification_preferences as Record<string, boolean> | null;

    // Check if notifications are enabled globally
    if (preferences && !preferences.enabled) {
      console.log(`All notifications disabled for ${profile.email}`);
      return { success: true, sent: false };
    }

    // Check if sports reminders are enabled
    if (preferences && preferences.sports_reminders === false) {
      console.log(`Sports reminders disabled for ${profile.email}`);
      return { success: true, sent: false };
    }

    // Create in-app notification
    const responsibilityText = responsibility ? ` (${responsibility})` : '';
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: profile.id,
      type: "sports_reminder",
      title: `${activity.sport_type} ${event.event_type} in ${reminderLabel}`,
      message: `${activity.child_name}'s ${event.title}${responsibilityText}. ${leaveByTime ? `Leave by ${leaveByTime}.` : ''}`,
      related_id: event.id,
    });

    if (notifError) {
      console.error("Error creating notification:", notifError);
    }

    // Send email
    if (profile.email) {
      try {
        const html = getEmailHtml(
          profile.full_name,
          event,
          activity,
          reminderLabel,
          responsibility,
          leaveByTime,
          equipment
        );

        const { error: emailError } = await resend.emails.send({
          from: "CoParrent <notifications@resend.dev>",
          to: [profile.email],
          subject: `🏅 ${activity.child_name}'s ${activity.sport_type} ${event.event_type} in ${reminderLabel}`,
          html,
        });

        if (emailError) {
          console.error("Error sending email:", emailError);
        } else {
          console.log(`Sports reminder email sent to ${profile.email}`);
        }
      } catch (emailErr) {
        console.error("Email exception:", emailErr);
      }
    }

    return { success: true, sent: true };
  } catch (error) {
    console.error("Error sending sports reminder:", error);
    return { success: false, sent: false };
  }
}

serve(handler);
