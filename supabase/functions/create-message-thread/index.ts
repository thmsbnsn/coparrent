import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import {
  HttpError,
  getActiveMembershipForProfile,
  getActiveMembershipForUser,
  requireAuthenticatedProfile,
} from "../_shared/callHelpers.ts";

const LOG_PREFIX = "CREATE-MESSAGE-THREAD";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[${LOG_PREFIX}] ${step}${detailsStr}`);
};

interface CreateThreadRequest {
  family_id?: string;
  group_name?: string;
  other_profile_id?: string;
  participant_ids?: string[];
  thread_type: "family_channel" | "direct_message" | "group_chat";
}

const jsonResponse = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
    status,
  });

async function resolveMembership(
  supabaseAdmin: SupabaseClient,
  userId: string,
  requestedFamilyId?: string,
) {
  if (requestedFamilyId) {
    return await getActiveMembershipForUser(supabaseAdmin, requestedFamilyId, userId);
  }

  const { data, error } = await supabaseAdmin
    .from("family_members")
    .select("id, family_id, primary_parent_id, profile_id, relationship_label, role, status, user_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(2);

  if (error || !data?.length) {
    throw new HttpError(403, "You do not have access to an active family.");
  }

  if (data.length > 1) {
    throw new HttpError(400, "family_id is required when your account belongs to multiple families.");
  }

  return data[0];
}

async function fetchThreadById(
  supabaseAdmin: SupabaseClient,
  threadId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("message_threads")
    .select("*")
    .eq("id", threadId)
    .single();

  if (error || !data) {
    throw new HttpError(500, error?.message ?? "Unable to load the message thread.");
  }

  return data;
}

async function findExistingFamilyChannel(
  supabaseAdmin: SupabaseClient,
  familyId: string,
  primaryParentId: string,
) {
  const { data: currentThread, error: currentThreadError } = await supabaseAdmin
    .from("message_threads")
    .select("*")
    .eq("family_id", familyId)
    .eq("thread_type", "family_channel")
    .maybeSingle();

  if (currentThreadError) {
    throw new HttpError(500, currentThreadError.message);
  }

  if (currentThread) {
    return currentThread;
  }

  const { data: legacyThread, error: legacyThreadError } = await supabaseAdmin
    .from("message_threads")
    .select("*")
    .is("family_id", null)
    .eq("primary_parent_id", primaryParentId)
    .eq("thread_type", "family_channel")
    .maybeSingle();

  if (legacyThreadError) {
    throw new HttpError(500, legacyThreadError.message);
  }

  if (!legacyThread) {
    return null;
  }

  const { data: updatedThread, error: updateError } = await supabaseAdmin
    .from("message_threads")
    .update({ family_id: familyId })
    .eq("id", legacyThread.id)
    .select("*")
    .single();

  if (updateError || !updatedThread) {
    throw new HttpError(500, updateError?.message ?? "Unable to update the family channel.");
  }

  return updatedThread;
}

async function findExistingDirectMessage(
  supabaseAdmin: SupabaseClient,
  familyId: string,
  primaryParentId: string,
  participantAId: string,
  participantBId: string,
) {
  const { data: currentThread, error: currentThreadError } = await supabaseAdmin
    .from("message_threads")
    .select("*")
    .eq("family_id", familyId)
    .eq("thread_type", "direct_message")
    .eq("participant_a_id", participantAId)
    .eq("participant_b_id", participantBId)
    .maybeSingle();

  if (currentThreadError) {
    throw new HttpError(500, currentThreadError.message);
  }

  if (currentThread) {
    return currentThread;
  }

  const { data: legacyThread, error: legacyThreadError } = await supabaseAdmin
    .from("message_threads")
    .select("*")
    .is("family_id", null)
    .eq("primary_parent_id", primaryParentId)
    .eq("thread_type", "direct_message")
    .eq("participant_a_id", participantAId)
    .eq("participant_b_id", participantBId)
    .maybeSingle();

  if (legacyThreadError) {
    throw new HttpError(500, legacyThreadError.message);
  }

  if (!legacyThread) {
    return null;
  }

  const { data: updatedThread, error: updateError } = await supabaseAdmin
    .from("message_threads")
    .update({ family_id: familyId })
    .eq("id", legacyThread.id)
    .select("*")
    .single();

  if (updateError || !updatedThread) {
    throw new HttpError(500, updateError?.message ?? "Unable to update the direct-message thread.");
  }

  return updatedThread;
}

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { success: false, error: "Method not allowed" });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const { profile, user } = await requireAuthenticatedProfile(req, supabaseAdmin);
    const body = (await req.json()) as CreateThreadRequest;

    logStep("Request received", {
      familyId: body.family_id ?? null,
      otherProfileId: body.other_profile_id ?? null,
      participantCount: body.participant_ids?.length ?? 0,
      threadType: body.thread_type,
      userId: user.id,
    });

    if (!body.thread_type) {
      throw new HttpError(400, "thread_type is required.");
    }

    const callerMembership = await resolveMembership(supabaseAdmin, user.id, body.family_id);
    const familyId = callerMembership.family_id;

    if (!familyId) {
      throw new HttpError(400, "The selected family could not be resolved.");
    }

    let threadId: string | null = null;

    if (body.thread_type === "family_channel") {
      const existingChannel = await findExistingFamilyChannel(
        supabaseAdmin,
        familyId,
        callerMembership.primary_parent_id,
      );

      if (existingChannel) {
        threadId = existingChannel.id;
      } else {
        const { data: createdChannel, error: createError } = await supabaseAdmin
          .from("message_threads")
          .insert({
            family_id: familyId,
            name: "Family Chat",
            primary_parent_id: callerMembership.primary_parent_id,
            thread_type: "family_channel",
          })
          .select("*")
          .single();

        if (createError || !createdChannel) {
          throw new HttpError(500, createError?.message ?? "Failed to create the family channel.");
        }

        threadId = createdChannel.id;
      }
    } else if (body.thread_type === "direct_message") {
      if (!body.other_profile_id) {
        throw new HttpError(400, "other_profile_id is required for direct messages.");
      }

      if (body.other_profile_id === profile.id) {
        throw new HttpError(400, "You cannot create a direct message with yourself.");
      }

      await getActiveMembershipForProfile(supabaseAdmin, familyId, body.other_profile_id);

      const [participantAId, participantBId] =
        profile.id < body.other_profile_id
          ? [profile.id, body.other_profile_id]
          : [body.other_profile_id, profile.id];

      const existingThread = await findExistingDirectMessage(
        supabaseAdmin,
        familyId,
        callerMembership.primary_parent_id,
        participantAId,
        participantBId,
      );

      if (existingThread) {
        threadId = existingThread.id;
      } else {
        const { data: createdThread, error: createError } = await supabaseAdmin
          .from("message_threads")
          .insert({
            family_id: familyId,
            participant_a_id: participantAId,
            participant_b_id: participantBId,
            primary_parent_id: callerMembership.primary_parent_id,
            thread_type: "direct_message",
          })
          .select("*")
          .single();

        if (createError || !createdThread) {
          throw new HttpError(500, createError?.message ?? "Failed to create the direct-message thread.");
        }

        threadId = createdThread.id;
      }
    } else if (body.thread_type === "group_chat") {
      if (!body.group_name?.trim()) {
        throw new HttpError(400, "group_name is required for group chats.");
      }

      const requestedParticipants = [...new Set([profile.id, ...(body.participant_ids ?? [])])];
      if (requestedParticipants.length < 2) {
        throw new HttpError(400, "Select at least one other participant for the group.");
      }

      const { data: eligibleMembers, error: eligibleMembersError } = await supabaseAdmin
        .from("family_members")
        .select("profile_id")
        .eq("family_id", familyId)
        .eq("status", "active")
        .in("profile_id", requestedParticipants);

      if (eligibleMembersError) {
        throw new HttpError(500, eligibleMembersError.message);
      }

      const eligibleProfileIds = new Set((eligibleMembers ?? []).map((member) => member.profile_id));
      const invalidParticipants = requestedParticipants.filter((participantId) => !eligibleProfileIds.has(participantId));

      if (invalidParticipants.length > 0) {
        throw new HttpError(400, "One or more selected participants are not active in the current family.");
      }

      const { data: createdGroup, error: createError } = await supabaseAdmin
        .from("message_threads")
        .insert({
          family_id: familyId,
          name: body.group_name.trim(),
          primary_parent_id: callerMembership.primary_parent_id,
          thread_type: "group_chat",
        })
        .select("*")
        .single();

      if (createError || !createdGroup) {
        throw new HttpError(500, createError?.message ?? "Failed to create the group chat.");
      }

      const { error: participantsError } = await supabaseAdmin
        .from("group_chat_participants")
        .insert(
          requestedParticipants.map((participantId) => ({
            profile_id: participantId,
            thread_id: createdGroup.id,
          })),
        );

      if (participantsError) {
        await supabaseAdmin.from("message_threads").delete().eq("id", createdGroup.id);
        throw new HttpError(500, participantsError.message);
      }

      threadId = createdGroup.id;
    } else {
      throw new HttpError(400, `Invalid thread_type: ${body.thread_type}`);
    }

    if (!threadId) {
      throw new HttpError(500, "Thread creation did not complete.");
    }

    const thread = await fetchThreadById(supabaseAdmin, threadId);

    logStep("Thread ready", {
      familyId,
      threadId,
      threadType: thread.thread_type,
    });

    return jsonResponse(req, 200, {
      success: true,
      family_id: familyId,
      primary_parent_id: callerMembership.primary_parent_id,
      profile_id: profile.id,
      role: callerMembership.role,
      thread,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to create the message thread.";
    logStep("Error", { message, status });

    return jsonResponse(req, status, {
      success: false,
      error: message,
    });
  }
});
