import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { buildAppUrl } from "../_shared/appUrl.ts";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import { checkFunctionRateLimit, createRateLimitResponse } from "../_shared/functionRateLimit.ts";

const FUNCTION_NAME = "notify-third-party-added";
const INTERNAL_AUTH_HEADER = "x-notify-third-party-added-key";
const INTERNAL_AUTH_ENV = "NOTIFY_THIRD_PARTY_ADDED_INTERNAL_KEY";
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const PARENT_ROLES = ["parent", "guardian"] as const;

const NotifyThirdPartyAddedSchema = z.object({
  familyId: z.string().uuid("Invalid family ID"),
  thirdPartyName: z.string().trim().min(1, "Third-party name required").max(100, "Third-party name too long"),
  thirdPartyEmail: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  invitationToken: z.string().uuid("Invalid invitation token").optional(),
  familyMemberId: z.string().uuid("Invalid family member ID").optional(),
  primaryParentId: z.string().uuid("Invalid primary parent ID").optional(),
}).refine((value) => Boolean(value.invitationToken || value.familyMemberId), {
  message: "Either invitationToken or familyMemberId is required",
  path: ["invitationToken"],
});

interface CallerProfileRow {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
}

interface InvitationRow {
  id: string;
  family_id: string | null;
  inviter_id: string;
  invitee_email: string;
  invitation_type: string;
  status: string;
}

interface FamilyMembershipRow {
  id: string;
  family_id: string | null;
  profile_id: string;
  primary_parent_id: string;
  invited_by: string | null;
  role: string;
  status: string;
  profiles?: {
    id: string;
    email: string | null;
    full_name: string | null;
  } | null;
}

interface ParentRecipientRow {
  id: string;
  role: string;
  status: string;
  profile_id: string;
  profiles?: {
    id: string;
    email: string | null;
    full_name: string | null;
  } | null;
}

interface AuthContext {
  mode: "jwt" | "internal";
  actorUserId: string;
  actorProfileId: string | null;
  actorRoleAtAction: string;
  callerProfile: CallerProfileRow | null;
}

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[NOTIFY-THIRD-PARTY-ADDED] ${step}${detailsStr}`);
};

const jsonResponse = (
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  status = 200,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const isParentRole = (role: string): role is (typeof PARENT_ROLES)[number] =>
  PARENT_ROLES.includes(role as (typeof PARENT_ROLES)[number]);

const parseJsonSafely = async (response: Response): Promise<Record<string, unknown> | null> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
};

const resolveAuthContext = async (
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  corsHeaders: Record<string, string>,
): Promise<AuthContext | Response> => {
  const authHeader = req.headers.get("Authorization");

  if (authHeader) {
    const accessToken = authHeader.replace("Bearer ", "").trim();

    if (!accessToken) {
      return jsonResponse({ success: false, error: "Authentication failed" }, corsHeaders, 401);
    }

    const { data: userData, error: authError } = await supabaseClient.auth.getUser(accessToken);
    if (authError || !userData.user) {
      return jsonResponse({ success: false, error: "Authentication failed" }, corsHeaders, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await supabaseClient
      .from("profiles")
      .select("id, user_id, email, full_name")
      .eq("user_id", userData.user.id)
      .single<CallerProfileRow>();

    if (callerProfileError || !callerProfile) {
      logStep("Caller profile missing", { userId: userData.user.id, error: callerProfileError?.message });
      return jsonResponse({ success: false, error: "Caller profile not found" }, corsHeaders, 403);
    }

    return {
      mode: "jwt",
      actorUserId: userData.user.id,
      actorProfileId: callerProfile.id,
      actorRoleAtAction: "parent",
      callerProfile,
    };
  }

  const internalAuthKey = req.headers.get(INTERNAL_AUTH_HEADER)?.trim();
  const expectedInternalAuthKey = Deno.env.get(INTERNAL_AUTH_ENV)?.trim();
  if (internalAuthKey && expectedInternalAuthKey && internalAuthKey === expectedInternalAuthKey) {
    return {
      mode: "internal",
      actorUserId: SYSTEM_USER_ID,
      actorProfileId: null,
      actorRoleAtAction: "system",
      callerProfile: null,
    };
  }

  return jsonResponse(
    { success: false, error: "Authentication required" },
    corsHeaders,
    401,
  );
};

const logSendAudit = async (
  supabaseClient: ReturnType<typeof createClient>,
  args: {
    actorUserId: string;
    actorProfileId: string | null;
    actorRoleAtAction: string;
    authMode: AuthContext["mode"];
    familyId: string;
    invitationId?: string | null;
    familyMemberId?: string | null;
    recipientEmail: string;
    recipientProfileId: string | null;
    thirdPartyEmail: string;
    thirdPartyName: string;
    success: boolean;
    resendMessageId?: string | null;
    errorMessage?: string | null;
  },
): Promise<void> => {
  try {
    await supabaseClient.from("audit_logs").insert({
      actor_user_id: args.actorUserId,
      actor_profile_id: args.actorProfileId,
      actor_role_at_action: args.actorRoleAtAction,
      action: args.success
        ? "THIRD_PARTY_ADDED_NOTIFICATION_SENT"
        : "THIRD_PARTY_ADDED_NOTIFICATION_FAILED",
      entity_type: "third_party_notification",
      entity_id: args.familyMemberId ?? args.invitationId ?? null,
      family_id: args.familyId,
      family_context: {
        family_id: args.familyId,
      },
      metadata: {
        auth_mode: args.authMode,
        invitation_id: args.invitationId ?? null,
        family_member_id: args.familyMemberId ?? null,
        recipient_email: args.recipientEmail,
        recipient_profile_id: args.recipientProfileId,
        third_party_email: args.thirdPartyEmail,
        third_party_name: args.thirdPartyName,
        resend_message_id: args.resendMessageId ?? null,
        error: args.errorMessage ?? null,
      },
    });
  } catch (auditError) {
    logStep("Audit log failed", {
      recipientEmail: args.recipientEmail,
      success: args.success,
      error: auditError instanceof Error ? auditError.message : String(auditError),
    });
  }
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

    const authContext = await resolveAuthContext(req, supabaseClient, corsHeaders);
    if (authContext instanceof Response) {
      return authContext;
    }

    logStep("Caller authenticated", {
      mode: authContext.mode,
      actorUserId: authContext.actorUserId,
      actorProfileId: authContext.actorProfileId,
    });

    const rateLimitResult = await checkFunctionRateLimit(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      authContext.actorUserId,
      FUNCTION_NAME,
    );

    if (!rateLimitResult.allowed) {
      logStep("Rate limit exceeded", {
        actorUserId: authContext.actorUserId,
        mode: authContext.mode,
        remaining: rateLimitResult.remaining,
      });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const rawBody = await req.json();
    const parseResult = NotifyThirdPartyAddedSchema.safeParse(rawBody);
    if (!parseResult.success) {
      logStep("Validation failed", { errors: parseResult.error.flatten() });
      return jsonResponse({ success: false, error: "Invalid request data" }, corsHeaders, 400);
    }

    const {
      familyId,
      thirdPartyName,
      thirdPartyEmail,
      invitationToken,
      familyMemberId,
    } = parseResult.data;

    logStep("Input validated", {
      familyId,
      invitationToken,
      familyMemberId,
      legacyPrimaryParentIdIgnored: Boolean(parseResult.data.primaryParentId),
    });

    let invitation: InvitationRow | null = null;
    if (invitationToken) {
      const { data: invitationData, error: invitationError } = await supabaseClient
        .from("invitations")
        .select("id, family_id, inviter_id, invitee_email, invitation_type, status")
        .eq("token", invitationToken)
        .maybeSingle<InvitationRow>();

      if (invitationError) {
        logStep("Invitation lookup failed", { error: invitationError.message, invitationToken });
        return jsonResponse({ success: false, error: "Unable to validate invitation" }, corsHeaders, 500);
      }

      if (!invitationData) {
        return jsonResponse({ success: false, error: "Invitation not found" }, corsHeaders, 404);
      }

      if (invitationData.invitation_type !== "third_party") {
        return jsonResponse({ success: false, error: "Invitation is not a third-party invitation" }, corsHeaders, 400);
      }

      if (!invitationData.family_id || invitationData.family_id !== familyId) {
        return jsonResponse({ success: false, error: "Invitation does not belong to this family" }, corsHeaders, 403);
      }

      if (["cancelled", "expired", "declined"].includes(invitationData.status)) {
        return jsonResponse({ success: false, error: "Invitation is no longer valid" }, corsHeaders, 400);
      }

      if (invitationData.status !== "accepted") {
        return jsonResponse(
          { success: false, error: "Third-party invitation has not been accepted yet" },
          corsHeaders,
          400,
        );
      }

      if (normalizeEmail(invitationData.invitee_email) !== normalizeEmail(thirdPartyEmail)) {
        return jsonResponse({ success: false, error: "Invitation email does not match the target member" }, corsHeaders, 400);
      }

      invitation = invitationData;
    }

    let thirdPartyMembership: FamilyMembershipRow | null = null;
    if (familyMemberId) {
      const { data: membershipData, error: membershipError } = await supabaseClient
        .from("family_members")
        .select(`
          id,
          family_id,
          profile_id,
          primary_parent_id,
          invited_by,
          role,
          status,
          profiles!family_members_profile_id_fkey (
            id,
            email,
            full_name
          )
        `)
        .eq("id", familyMemberId)
        .maybeSingle();

      if (membershipError) {
        logStep("Family member lookup failed", { error: membershipError.message, familyMemberId });
        return jsonResponse({ success: false, error: "Unable to validate family member" }, corsHeaders, 500);
      }

      const typedMembership = membershipData as FamilyMembershipRow | null;
      if (!typedMembership) {
        return jsonResponse({ success: false, error: "Family member not found" }, corsHeaders, 404);
      }

      if (!typedMembership.family_id || typedMembership.family_id !== familyId) {
        return jsonResponse({ success: false, error: "Family member does not belong to this family" }, corsHeaders, 403);
      }

      if (typedMembership.role !== "third_party") {
        return jsonResponse({ success: false, error: "Target member is not a third-party member" }, corsHeaders, 400);
      }

      if (typedMembership.status !== "active") {
        return jsonResponse({ success: false, error: "Third-party membership is not active" }, corsHeaders, 400);
      }

      if (
        typedMembership.profiles?.email &&
        normalizeEmail(typedMembership.profiles.email) !== normalizeEmail(thirdPartyEmail)
      ) {
        return jsonResponse(
          { success: false, error: "Family member email does not match the target member" },
          corsHeaders,
          400,
        );
      }

      thirdPartyMembership = typedMembership;
    }

    let callerFamilyMembership: FamilyMembershipRow | null = null;
    if (authContext.mode === "jwt") {
      const { data: membershipData, error: membershipError } = await supabaseClient
        .from("family_members")
        .select("id, family_id, profile_id, primary_parent_id, invited_by, role, status")
        .eq("user_id", authContext.actorUserId)
        .eq("family_id", familyId)
        .eq("status", "active")
        .maybeSingle();

      if (membershipError) {
        logStep("Caller family membership lookup failed", {
          actorUserId: authContext.actorUserId,
          familyId,
          error: membershipError.message,
        });
        return jsonResponse({ success: false, error: "Unable to validate caller access" }, corsHeaders, 500);
      }

      callerFamilyMembership = membershipData as FamilyMembershipRow | null;

      const hasFamilyOwnership =
        Boolean(callerFamilyMembership && isParentRole(callerFamilyMembership.role)) ||
        Boolean(invitation && authContext.callerProfile && invitation.inviter_id === authContext.callerProfile.id);

      if (!hasFamilyOwnership) {
        return jsonResponse(
          { success: false, error: "You do not have permission to notify this family" },
          corsHeaders,
          403,
        );
      }

      authContext.actorRoleAtAction = callerFamilyMembership?.role ?? "parent";
    }

    const { data: parentRows, error: parentsError } = await supabaseClient
      .from("family_members")
      .select(`
        id,
        role,
        status,
        profile_id,
        profiles!family_members_profile_id_fkey (
          id,
          email,
          full_name
        )
      `)
      .eq("family_id", familyId)
      .eq("status", "active")
      .in("role", [...PARENT_ROLES]);

    if (parentsError) {
      logStep("Parent lookup failed", { familyId, error: parentsError.message });
      return jsonResponse({ success: false, error: "Unable to resolve parent recipients" }, corsHeaders, 500);
    }

    const recipients = ((parentRows ?? []) as ParentRecipientRow[])
      .filter((row) => row.profiles?.email)
      .map((row) => ({
        recipientProfileId: row.profiles?.id ?? row.profile_id,
        recipientEmail: row.profiles?.email ?? "",
      }));

    const dedupedRecipients = [...new Map(
      recipients.map((recipient) => [normalizeEmail(recipient.recipientEmail), recipient]),
    ).values()];

    if (dedupedRecipients.length === 0) {
      logStep("No parent recipients found", { familyId });
      return jsonResponse({ success: false, error: "No parent recipients found" }, corsHeaders, 400);
    }

    logStep("Found parent recipients", {
      familyId,
      recipientCount: dedupedRecipients.length,
    });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      logStep("ERROR: RESEND_API_KEY not configured");
      return jsonResponse({ success: false, error: "Email service unavailable" }, corsHeaders, 500);
    }

    const fromAddress = "CoParrent <noreply@coparrent.com>";
    const settingsUrl = buildAppUrl("/dashboard/settings");
    const sendResults: Array<{ email: string; success: boolean; error?: string | null }> = [];

    for (const recipient of dedupedRecipients) {
      logStep("Sending notification email", {
        to: recipient.recipientEmail,
        familyId,
      });

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipient.recipientEmail],
          subject: `${thirdPartyName} has joined your family group`,
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
                .alert-box { background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin-top: 20px; }
                .button { display: inline-block; background: linear-gradient(135deg, #2563eb, #0d9488); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
                .footer { text-align: center; color: #64748b; font-size: 14px; }
                .member-info { background: white; border-radius: 8px; padding: 16px; margin-top: 16px; border: 1px solid #e2e8f0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">Co<span class="logo-accent">Parrent</span></div>
                </div>
                <div class="content">
                  <h2 style="margin-top: 0;">New Family Member Added</h2>
                  <p>A new family member has joined your family group on CoParrent.</p>
                  
                  <div class="member-info">
                    <p style="margin: 0;"><strong>Name:</strong> ${thirdPartyName}</p>
                    <p style="margin: 8px 0 0;"><strong>Email:</strong> ${thirdPartyEmail}</p>
                  </div>
                  
                  <div class="alert-box">
                    <p style="margin: 0; color: #166534;"><strong>What they can access:</strong></p>
                    <ul style="margin: 8px 0 0; color: #166534;">
                      <li>Family messaging</li>
                      <li>Calendar (view only)</li>
                      <li>Their own journal</li>
                      <li>Law library and blog</li>
                    </ul>
                  </div>
                  
                  <p style="margin-top: 20px;">If you did not expect this, you can manage your family members in the settings.</p>
                  
                  <p style="text-align: center; margin-top: 30px;">
                    <a href="${settingsUrl}" class="button">View Settings</a>
                  </p>
                </div>
                <div class="footer">
                  <p>© CoParrent - Making co-parenting easier</p>
                </div>
              </div>
            </body>
            </html>
          `,
        }),
      });

      const result = await parseJsonSafely(emailResponse);
      const resendMessageId = typeof result?.id === "string" ? result.id : null;

      if (!emailResponse.ok) {
        const errorMessage =
          typeof result?.message === "string"
            ? result.message
            : `Resend API returned ${emailResponse.status}`;
        logStep("Resend API error", {
          status: emailResponse.status,
          error: result,
          to: recipient.recipientEmail,
        });
        await logSendAudit(supabaseClient, {
          actorUserId: authContext.actorUserId,
          actorProfileId: authContext.actorProfileId,
          actorRoleAtAction: authContext.actorRoleAtAction,
          authMode: authContext.mode,
          familyId,
          invitationId: invitation?.id ?? null,
          familyMemberId: thirdPartyMembership?.id ?? familyMemberId ?? null,
          recipientEmail: recipient.recipientEmail,
          recipientProfileId: recipient.recipientProfileId,
          thirdPartyEmail,
          thirdPartyName,
          success: false,
          resendMessageId,
          errorMessage,
        });
        sendResults.push({ email: recipient.recipientEmail, success: false, error: errorMessage });
      } else {
        logStep("Email sent successfully", {
          messageId: resendMessageId,
          to: recipient.recipientEmail,
        });
        await logSendAudit(supabaseClient, {
          actorUserId: authContext.actorUserId,
          actorProfileId: authContext.actorProfileId,
          actorRoleAtAction: authContext.actorRoleAtAction,
          authMode: authContext.mode,
          familyId,
          invitationId: invitation?.id ?? null,
          familyMemberId: thirdPartyMembership?.id ?? familyMemberId ?? null,
          recipientEmail: recipient.recipientEmail,
          recipientProfileId: recipient.recipientProfileId,
          thirdPartyEmail,
          thirdPartyName,
          success: true,
          resendMessageId,
        });
        sendResults.push({ email: recipient.recipientEmail, success: true });
      }
    }

    const successfulSends = sendResults.filter((result) => result.success).length;
    const failedSends = sendResults.length - successfulSends;

    return jsonResponse(
      {
        success: failedSends === 0,
        sent_count: successfulSends,
        failed_count: failedSends,
      },
      corsHeaders,
      successfulSends > 0 ? 200 : 502,
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return jsonResponse({ success: false, error: "An unexpected error occurred" }, corsHeaders, 500);
  }
};

serve(handler);
