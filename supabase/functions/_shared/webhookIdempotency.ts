import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

interface IdempotencyCheckResult {
  alreadyProcessed: boolean;
  shouldProcess: boolean;
}

export async function checkIdempotency(
  eventId: string,
  eventType: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
): Promise<IdempotencyCheckResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: existingEvent, error: lookupError } = await supabase
    .from("stripe_webhook_events")
    .select("id, status")
    .eq("id", eventId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingEvent) {
    return { alreadyProcessed: true, shouldProcess: false };
  }

  const { error: insertError } = await supabase.from("stripe_webhook_events").insert({
    id: eventId,
    event_type: eventType,
    status: "processing",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { alreadyProcessed: true, shouldProcess: false };
    }

    throw insertError;
  }

  return { alreadyProcessed: false, shouldProcess: true };
}

export async function markEventProcessed(
  eventId: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      metadata,
      processed_at: new Date().toISOString(),
      status: "success",
    })
    .eq("id", eventId);

  if (error) {
    throw error;
  }
}

export async function markEventFailed(
  eventId: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
  errorMessage: string,
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      metadata: { error: errorMessage },
      processed_at: new Date().toISOString(),
      status: "failed",
    })
    .eq("id", eventId);

  if (error) {
    throw error;
  }
}
