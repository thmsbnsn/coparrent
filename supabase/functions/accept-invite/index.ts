import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

type MemberRole = "parent" | "guardian" | "third_party" | "child";

interface ProfileRow {
  id: string;
  user_id: string;
  email: string | null;
}

interface InvitationRow {
  id: string;
  inviter_id: string;
  invitee_email: string;
  status: string;
  expires_at: string;
  invitation_type: "co_parent" | "third_party";
  role: string | null;
  relationship: string | null;
  family_id: string | null;
}

interface FamilyMemberRow {
  id: string;
  family_id: string | null;
  user_id: string | null;
  profile_id: string | null;
  primary_parent_id: string | null;
  role: MemberRole;
  status: string | null;
  created_at: string;
}

const AcceptInviteSchema = z.object({
  token: z.string().uuid("Invalid invite token"),
  invitationType: z.enum(["co_parent", "third_party"]).optional(),
  relationshipLabel: z.string().trim().min(1).max(80).optional(),
});

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ACCEPT-INVITE] ${step}${detailsStr}`);
};

function jsonResponse(
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function ensureFamilyMemberRecord(
  supabaseAdmin: ReturnType<typeof createClient>,
  args: {
    familyId: string;
    userId: string;
    profileId: string;
    primaryParentId: string;
    role: MemberRole;
    relationshipLabel?: string | null;
    invitedBy?: string | null;
  },
): Promise<void> {
  const {
    familyId,
    userId,
    profileId,
    primaryParentId,
    role,
    relationshipLabel = null,
    invitedBy = null,
  } = args;

  const { data: existingMember, error: existingMemberError } = await supabaseAdmin
    .from("family_members")
    .select("id, relationship_label")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string; relationship_label: string | null }>();

  if (existingMemberError) {
    throw new Error(`Unable to look up family membership: ${existingMemberError.message}`);
  }

  if (existingMember) {
    const { error: updateError } = await supabaseAdmin
      .from("family_members")
      .update({
        profile_id: profileId,
        primary_parent_id: primaryParentId,
        role,
        relationship_label: relationshipLabel ?? existingMember.relationship_label,
        status: "active",
        invited_by: invitedBy ?? undefined,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", existingMember.id);

    if (updateError) {
      throw new Error(`Unable to update family membership: ${updateError.message}`);
    }

    return;
  }

  const now = new Date().toISOString();
  const { error: insertError } = await supabaseAdmin
    .from("family_members")
    .insert({
      family_id: familyId,
      user_id: userId,
      profile_id: profileId,
      primary_parent_id: primaryParentId,
      role,
      relationship_label: relationshipLabel,
      status: "active",
      invited_by: invitedBy,
      invited_at: invitedBy ? now : null,
      accepted_at: now,
    });

  if (insertError) {
    throw new Error(`Unable to insert family membership: ${insertError.message}`);
  }
}

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        { success: false, error: "Authentication required", code: "AUTH_REQUIRED" },
        corsHeaders,
        401,
      );
    }

    const rawBody = await req.json();
    const parsedBody = AcceptInviteSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return jsonResponse(
        { success: false, error: "Invalid request data", code: "INVALID_REQUEST" },
        corsHeaders,
        400,
      );
    }

    const { token, invitationType, relationshipLabel } = parsedBody.data;

    const accessToken = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return jsonResponse(
        { success: false, error: "Authentication failed", code: "AUTH_FAILED" },
        corsHeaders,
        401,
      );
    }

    const authUser = authData.user;
    logStep("User authenticated", { userId: authUser.id, invitationType });

    const { data: acceptorProfile, error: acceptorProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, email")
      .eq("user_id", authUser.id)
      .single<ProfileRow>();

    if (acceptorProfileError || !acceptorProfile) {
      throw new Error(`Unable to load acceptor profile: ${acceptorProfileError?.message ?? "profile missing"}`);
    }

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("invitations")
      .select("id, inviter_id, invitee_email, status, expires_at, invitation_type, role, relationship, family_id")
      .eq("token", token)
      .maybeSingle<InvitationRow>();

    if (invitationError) {
      throw new Error(`Unable to load invitation: ${invitationError.message}`);
    }

    if (!invitation) {
      return jsonResponse(
        { success: false, error: "Invalid or already used invitation", code: "INVITATION_NOT_FOUND" },
        corsHeaders,
        404,
      );
    }

    if (invitationType && invitation.invitation_type !== invitationType) {
      return jsonResponse(
        { success: false, error: "Invitation type mismatch", code: "INVITATION_TYPE_MISMATCH" },
        corsHeaders,
        400,
      );
    }

    if (invitation.status !== "pending") {
      return jsonResponse(
        { success: false, error: "Invalid or already used invitation", code: "INVITATION_NOT_PENDING" },
        corsHeaders,
        400,
      );
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      return jsonResponse(
        { success: false, error: "Invitation has expired", code: "INVITATION_EXPIRED" },
        corsHeaders,
        400,
      );
    }

    const acceptorEmail = authUser.email?.toLowerCase() ?? "";
    if (acceptorEmail !== invitation.invitee_email.toLowerCase()) {
      return jsonResponse(
        {
          success: false,
          error: "This invitation was sent to a different email address",
          code: "EMAIL_MISMATCH",
        },
        corsHeaders,
        400,
      );
    }

    if (!invitation.family_id) {
      return jsonResponse(
        {
          success: false,
          error: "Invitation is missing family_id",
          code: "FAMILY_ID_REQUIRED",
        },
        corsHeaders,
        400,
      );
    }

    const familyId = invitation.family_id;

    const { data: inviterProfile, error: inviterProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, email")
      .eq("id", invitation.inviter_id)
      .single<ProfileRow>();

    if (inviterProfileError || !inviterProfile) {
      throw new Error(`Unable to load inviter profile: ${inviterProfileError?.message ?? "profile missing"}`);
    }

    const { data: familyMembers, error: familyMemberError } = await supabaseAdmin
      .from("family_members")
      .select("id, family_id, user_id, profile_id, primary_parent_id, role, status, created_at")
      .eq("family_id", familyId)
      .in("status", ["active", "invited"])
      .order("created_at", { ascending: true })
      .returns<FamilyMemberRow[]>();

    if (familyMemberError) {
      throw new Error(`Unable to load family members: ${familyMemberError.message}`);
    }

    const inviterMembership =
      familyMembers?.find(
        (member) =>
          member.user_id === inviterProfile.user_id &&
          (member.role === "parent" || member.role === "guardian"),
      ) ?? null;

    if (!inviterMembership) {
      return jsonResponse(
        {
          success: false,
          error: "Inviting parent is not active in the invitation family",
          code: "INVITER_NOT_IN_FAMILY",
        },
        corsHeaders,
        400,
      );
    }

    const primaryParentId =
      inviterMembership.primary_parent_id ?? inviterMembership.profile_id ?? inviterProfile.id;

    if (invitation.invitation_type === "co_parent") {
      await ensureFamilyMemberRecord(supabaseAdmin, {
        familyId,
        userId: inviterProfile.user_id,
        profileId: inviterProfile.id,
        primaryParentId,
        role: "parent",
      });

      await ensureFamilyMemberRecord(supabaseAdmin, {
        familyId,
        userId: acceptorProfile.user_id,
        profileId: acceptorProfile.id,
        primaryParentId,
        role: "parent",
        invitedBy: inviterProfile.id,
      });

      const { error: parentUpdateError } = await supabaseAdmin
        .from("family_members")
        .update({ primary_parent_id: primaryParentId })
        .eq("family_id", familyId)
        .in("role", ["parent", "guardian"]);

      if (parentUpdateError) {
        throw new Error(`Unable to align parent memberships: ${parentUpdateError.message}`);
      }
    } else {
      await ensureFamilyMemberRecord(supabaseAdmin, {
        familyId,
        userId: acceptorProfile.user_id,
        profileId: acceptorProfile.id,
        primaryParentId,
        role: "third_party",
        relationshipLabel: relationshipLabel ?? invitation.relationship ?? "grandparent",
        invitedBy: inviterProfile.id,
      });
    }

    const { error: invitationUpdateError } = await supabaseAdmin
      .from("invitations")
      .update({
        family_id: familyId,
        status: "accepted",
      })
      .eq("id", invitation.id);

    if (invitationUpdateError) {
      throw new Error(`Unable to update invitation status: ${invitationUpdateError.message}`);
    }

    return jsonResponse(
      {
        success: true,
        family_id: familyId,
        role: invitation.invitation_type === "co_parent" ? "parent" : "third_party",
        relationship_label:
          invitation.invitation_type === "third_party" ? relationshipLabel ?? invitation.relationship ?? "grandparent" : null,
        route: "/dashboard",
      },
      corsHeaders,
      200,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return jsonResponse(
      { success: false, error: message, code: "UNKNOWN_ERROR" },
      corsHeaders,
      400,
    );
  }
});
