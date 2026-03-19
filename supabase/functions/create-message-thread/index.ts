import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-MESSAGE-THREAD] ${step}${detailsStr}`);
};

interface CreateThreadRequest {
  thread_type: "family_channel" | "direct_message" | "group_chat";
  other_profile_id?: string; // For DM
  participant_ids?: string[]; // For group chat
  group_name?: string; // For group chat
}

serve(async (req) => {
  // Use strict CORS validation instead of wildcard
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error(`Authentication error: ${userError?.message || "User not found"}`);
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Get user's profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, co_parent_id")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      throw new Error("User profile not found");
    }

    const profileId = profile.id;
    logStep("Profile found", { profileId });

    // Calculate primary_parent_id (same logic as client-side)
    let primaryParentId: string;
    
    // Check if user is a third-party member
    const { data: familyMember } = await supabaseAdmin
      .from("family_members")
      .select("primary_parent_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (familyMember) {
      primaryParentId = familyMember.primary_parent_id;
    } else {
      // User is a parent - primary parent ID is the "lower" of the two parent IDs
      if (profile.co_parent_id) {
        primaryParentId = profile.id < profile.co_parent_id ? profile.id : profile.co_parent_id;
      } else {
        primaryParentId = profile.id;
      }
    }
    logStep("Primary parent ID determined", { primaryParentId });

    // Get user's family role
    let userRole: "parent" | "guardian" | "third_party" = "parent";
    if (familyMember) {
      userRole = "third_party";
    }
    logStep("User role determined", { userRole });

    // Parse request body
    const body: CreateThreadRequest = await req.json();
    logStep("Request body", body);

    const { thread_type, other_profile_id, participant_ids, group_name } = body;

    if (!thread_type) {
      throw new Error("thread_type is required");
    }

    let thread;

    if (thread_type === "family_channel") {
      // Check for existing family channel
      const { data: existingChannel } = await supabaseAdmin
        .from("message_threads")
        .select("*")
        .eq("primary_parent_id", primaryParentId)
        .eq("thread_type", "family_channel")
        .maybeSingle();

      if (existingChannel) {
        logStep("Existing family channel found", { threadId: existingChannel.id });
        thread = existingChannel;
      } else {
        // Create new family channel
        const { data: newChannel, error: channelError } = await supabaseAdmin
          .from("message_threads")
          .insert({
            primary_parent_id: primaryParentId,
            thread_type: "family_channel",
            name: "Family Chat",
          })
          .select()
          .single();

        if (channelError) {
          logStep("Error creating family channel", channelError);
          throw new Error(`Failed to create family channel: ${channelError.message}`);
        }

        logStep("Family channel created", { threadId: newChannel.id });
        thread = newChannel;
      }
    } else if (thread_type === "direct_message") {
      if (!other_profile_id) {
        throw new Error("other_profile_id is required for direct messages");
      }

      // Sort IDs to ensure consistent ordering
      const [participantA, participantB] =
        profileId < other_profile_id
          ? [profileId, other_profile_id]
          : [other_profile_id, profileId];

      // Check for existing DM thread
      const { data: existingDM } = await supabaseAdmin
        .from("message_threads")
        .select("*")
        .eq("primary_parent_id", primaryParentId)
        .eq("thread_type", "direct_message")
        .eq("participant_a_id", participantA)
        .eq("participant_b_id", participantB)
        .maybeSingle();

      if (existingDM) {
        logStep("Existing DM thread found", { threadId: existingDM.id });
        thread = existingDM;
      } else {
        // Create new DM thread
        const { data: newDM, error: dmError } = await supabaseAdmin
          .from("message_threads")
          .insert({
            primary_parent_id: primaryParentId,
            thread_type: "direct_message",
            participant_a_id: participantA,
            participant_b_id: participantB,
          })
          .select()
          .single();

        if (dmError) {
          logStep("Error creating DM thread", dmError);
          throw new Error(`Failed to create DM thread: ${dmError.message}`);
        }

        logStep("DM thread created", { threadId: newDM.id });
        thread = newDM;
      }
    } else if (thread_type === "group_chat") {
      if (!participant_ids || participant_ids.length === 0) {
        throw new Error("participant_ids is required for group chats");
      }

      if (!group_name?.trim()) {
        throw new Error("group_name is required for group chats");
      }

      // Create new group chat thread
      const { data: newGroup, error: groupError } = await supabaseAdmin
        .from("message_threads")
        .insert({
          primary_parent_id: primaryParentId,
          thread_type: "group_chat",
          name: group_name.trim(),
        })
        .select()
        .single();

      if (groupError) {
        logStep("Error creating group chat", groupError);
        throw new Error(`Failed to create group chat: ${groupError.message}`);
      }

      logStep("Group chat created", { threadId: newGroup.id });

      // Add all participants including the creator
      const allParticipants = [...new Set([profileId, ...participant_ids])];

      const { error: participantError } = await supabaseAdmin
        .from("group_chat_participants")
        .insert(
          allParticipants.map((pid) => ({
            thread_id: newGroup.id,
            profile_id: pid,
          }))
        );

      if (participantError) {
        logStep("Error adding participants", participantError);
        // Rollback: delete the thread if participant insert failed
        await supabaseAdmin.from("message_threads").delete().eq("id", newGroup.id);
        throw new Error(`Failed to add participants: ${participantError.message}`);
      }

      logStep("Participants added", { count: allParticipants.length });
      thread = newGroup;
    } else {
      throw new Error(`Invalid thread_type: ${thread_type}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        thread,
        profile_id: profileId,
        primary_parent_id: primaryParentId,
        role: userRole,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: "Unable to create message thread. Please try again." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});