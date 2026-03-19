import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import { buildAppUrl } from "../_shared/appUrl.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
type SupabaseServiceClient = ReturnType<typeof createClient>;

interface UpcomingExchange {
  schedule_id: string;
  parent_a_id: string;
  parent_b_id: string;
  exchange_date: string;
  exchange_time: string | null;
  exchange_location: string | null;
  child_ids: string[];
  pattern: string;
}

// Reminder intervals in minutes with preference keys
const REMINDER_INTERVALS = [
  { minutes: 1440, label: "24 hours", prefKey: "exchange_reminder_24h" },
  { minutes: 120, label: "2 hours", prefKey: "exchange_reminder_2h" },
  { minutes: 30, label: "30 minutes", prefKey: "exchange_reminder_30min" },
];

const getEmailHtml = (
  recipientName: string,
  exchangeDate: string,
  exchangeTime: string | null,
  location: string | null,
  childNames: string[],
  reminderLabel: string
) => {
  const calendarUrl = buildAppUrl("/dashboard/calendar");
  const settingsUrl = buildAppUrl("/dashboard/settings");
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
    border: 1px solid #a8c5a8;
    border-top: none;
    border-radius: 0 0 12px 12px;
  `;

  const highlightBoxStyles = `
    background: linear-gradient(135deg, #e8f0e8 0%, #d4e5d4 100%);
    border-left: 4px solid #7fa87f;
    padding: 20px;
    margin: 20px 0;
    border-radius: 0 8px 8px 0;
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

  const childList = childNames.length > 0 
    ? childNames.join(", ") 
    : "your children";

  const timeDisplay = exchangeTime 
    ? `at ${exchangeTime}` 
    : "";

  const locationDisplay = location 
    ? `<p style="margin: 8px 0; color: #333;"><strong>📍 Location:</strong> ${location}</p>` 
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${baseStyles}">
      <div style="${headerStyles}">
        <h1 style="margin: 0; font-size: 24px;">🔔 Exchange Reminder</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">CoParrent</p>
      </div>
      <div style="${contentStyles}">
        <p style="color: #333; font-size: 16px;">Hi ${recipientName || "there"},</p>
        <p style="color: #333; line-height: 1.6;">
          This is a gentle reminder that you have a custody exchange coming up in <strong>${reminderLabel}</strong>.
        </p>
        
        <div style="${highlightBoxStyles}">
          <p style="margin: 0 0 8px; color: #1e3a5f; font-weight: 600; font-size: 18px;">
            📅 ${exchangeDate} ${timeDisplay}
          </p>
          ${locationDisplay}
          <p style="margin: 8px 0 0; color: #333;"><strong>👶 Children:</strong> ${childList}</p>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          We hope this exchange goes smoothly. Remember, keeping things calm and positive 
          helps everyone, especially the kids. 💚
        </p>
        
        <a href="${calendarUrl}" style="${buttonStyles}">
          View Calendar
        </a>
      </div>
      <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
        <p>You're receiving this because you have exchange reminders enabled.</p>
        <p>
          <a href="${settingsUrl}" style="color: #1e3a5f;">
            Manage notification preferences
          </a>
        </p>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  // Strict CORS validation
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  console.log("Exchange reminders function triggered at:", new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const results: { sent: number; skipped: number; errors: number } = {
      sent: 0,
      skipped: 0,
      errors: 0,
    };

    // Fetch all custody schedules
    const { data: schedules, error: schedulesError } = await supabase
      .from("custody_schedules")
      .select(`
        id,
        parent_a_id,
        parent_b_id,
        start_date,
        exchange_time,
        exchange_location,
        child_ids,
        pattern
      `);

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} custody schedules`);

    // Process each schedule to find upcoming exchanges
    for (const schedule of (schedules ?? []) as ScheduleRow[]) {
      // Calculate next exchange date based on pattern
      const exchanges = calculateUpcomingExchanges(schedule, now);

      for (const exchange of exchanges) {
        // Check each reminder interval
        for (const interval of REMINDER_INTERVALS) {
          const reminderTime = new Date(exchange.dateTime.getTime() - interval.minutes * 60 * 1000);
          const timeDiff = Math.abs(now.getTime() - reminderTime.getTime());
          
          // If we're within 5 minutes of the reminder time, send it
          if (timeDiff <= 5 * 60 * 1000) {
            console.log(`Sending ${interval.label} reminder for exchange at ${exchange.dateTime}`);

            // Get child names
            const childNames = await getChildNames(supabase, schedule.child_ids || []);

            // Send to both parents
            for (const parentId of [schedule.parent_a_id, schedule.parent_b_id]) {
              const result = await sendExchangeReminder(
                supabase,
                parentId,
                exchange.dateString,
                schedule.exchange_time,
                schedule.exchange_location,
                childNames,
                interval.label,
                interval.prefKey
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
    }

    console.log("Exchange reminders complete:", results);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in exchange-reminders:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Unable to process exchange reminders. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

interface ExchangeDate {
  dateTime: Date;
  dateString: string;
}

interface ScheduleRow {
  id: string;
  parent_a_id: string;
  parent_b_id: string;
  start_date: string;
  exchange_time: string | null;
  exchange_location: string | null;
  child_ids: string[] | null;
  pattern: string;
}

interface ChildNameRow {
  name: string;
}

function calculateUpcomingExchanges(
  schedule: ScheduleRow,
  now: Date
): ExchangeDate[] {
  const exchanges: ExchangeDate[] = [];
  const startDate = new Date(schedule.start_date);
  const pattern = schedule.pattern;

  // Calculate days between exchanges based on pattern
  let daysBetween = 7; // default weekly
  switch (pattern) {
    case "weekly":
      daysBetween = 7;
      break;
    case "biweekly":
    case "2-2-3":
      daysBetween = 14;
      break;
    case "every_other_weekend":
      daysBetween = 14;
      break;
    case "5-2":
      daysBetween = 7;
      break;
    case "3-4":
      daysBetween = 7;
      break;
    default:
      daysBetween = 7;
  }

  // Find upcoming exchanges within the next 48 hours
  const lookAhead = 48 * 60 * 60 * 1000; // 48 hours in ms
  
  // Calculate days since start
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const currentCycleStart = Math.floor(daysSinceStart / daysBetween) * daysBetween;
  
  // Check next few potential exchange dates
  for (let i = 0; i <= 2; i++) {
    const daysFromStart = currentCycleStart + (i * daysBetween);
    const exchangeDate = new Date(startDate);
    exchangeDate.setDate(exchangeDate.getDate() + daysFromStart);
    
    // Set exchange time if specified
    if (schedule.exchange_time) {
      const [hours, minutes] = schedule.exchange_time.split(":");
      exchangeDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      // Default to 6 PM if no time specified
      exchangeDate.setHours(18, 0, 0, 0);
    }

    // Check if this exchange is within our look-ahead window
    const timeDiff = exchangeDate.getTime() - now.getTime();
    if (timeDiff > 0 && timeDiff <= lookAhead) {
      exchanges.push({
        dateTime: exchangeDate,
        dateString: exchangeDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      });
    }
  }

  return exchanges;
}

async function getChildNames(supabase: SupabaseServiceClient, childIds: string[]): Promise<string[]> {
  if (!childIds || childIds.length === 0) return [];

  const { data: children, error } = await supabase
    .from("children")
    .select("name")
    .in("id", childIds);

  if (error) {
    console.error("Error fetching children:", error);
    return [];
  }

  return ((children ?? []) as ChildNameRow[]).map((child) => child.name);
}

async function sendExchangeReminder(
  supabase: SupabaseServiceClient,
  parentProfileId: string,
  exchangeDate: string,
  exchangeTime: string | null,
  location: string | null,
  childNames: string[],
  reminderLabel: string,
  reminderPrefKey: string
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

    // Check if exchange reminders are enabled
    if (preferences && !preferences.upcoming_exchanges) {
      console.log(`Exchange reminders disabled for ${profile.email}`);
      return { success: true, sent: false };
    }

    // Check specific interval preference
    if (preferences && preferences[reminderPrefKey] === false) {
      console.log(`${reminderPrefKey} reminder disabled for ${profile.email}`);
      return { success: true, sent: false };
    }

    // Create in-app notification
    const timeDisplay = exchangeTime ? ` at ${exchangeTime}` : "";
    const locationDisplay = location ? ` at ${location}` : "";
    const childDisplay = childNames.length > 0 ? ` for ${childNames.join(", ")}` : "";

    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: profile.id,
      type: "exchange_reminder",
      title: `Exchange in ${reminderLabel}`,
      message: `Custody exchange${childDisplay} on ${exchangeDate}${timeDisplay}${locationDisplay}.`,
    });

    if (notifError) {
      console.error("Error creating notification:", notifError);
    }

    // Send email
    if (profile.email) {
      try {
        const html = getEmailHtml(
          profile.full_name,
          exchangeDate,
          exchangeTime,
          location,
          childNames,
          reminderLabel
        );

        const { error: emailError } = await resend.emails.send({
          from: "CoParrent <notifications@resend.dev>",
          to: [profile.email],
          subject: `🔔 Custody Exchange in ${reminderLabel}`,
          html,
        });

        if (emailError) {
          console.error("Error sending email:", emailError);
        } else {
          console.log(`Exchange reminder email sent to ${profile.email}`);
        }
      } catch (emailErr) {
        console.error("Email exception:", emailErr);
      }
    }

    return { success: true, sent: true };
  } catch (error) {
    console.error("Error sending exchange reminder:", error);
    return { success: false, sent: false };
  }
}

serve(handler);
