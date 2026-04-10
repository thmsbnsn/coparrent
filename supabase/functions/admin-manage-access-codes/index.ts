import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

const LOG_PREFIX = "ADMIN-MANAGE-ACCESS-CODES";
const AUDIENCE_TAGS = ["friend", "family", "promoter", "partner", "custom"] as const;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PREFIX = "CPR";
const CODE_SEGMENT_LENGTHS = [4, 4, 4, 4] as const;
const MAX_BATCH_ISSUE_COUNT = 25;
const MAX_REDEMPTIONS_PER_CODE = 100;
const HASH_RETRY_LIMIT = 8;

type AudienceTag = (typeof AUDIENCE_TAGS)[number];
type AccessCodeStatus = "active" | "expired" | "exhausted" | "inactive";

interface AccessCodeRow {
  access_reason: string;
  active: boolean;
  audience_tag: AudienceTag;
  code_preview: string;
  created_at: string;
  created_by: string | null;
  expires_at: string | null;
  grant_tier: string;
  id: string;
  label: string;
  max_redemptions: number;
  redeemed_count: number;
  updated_at: string;
}

interface AccessCodeSummary {
  access_reason: string;
  active: boolean;
  audience_tag: AudienceTag;
  code_preview: string;
  created_at: string;
  created_by: string | null;
  expires_at: string | null;
  grant_tier: string;
  id: string;
  label: string;
  max_redemptions: number;
  redeemed_count: number;
  remaining_redemptions: number;
  status: AccessCodeStatus;
  updated_at: string;
}

const IssueAccessCodeSchema = z.object({
  access_reason: z.string().trim().min(1, "Access reason is required").max(255, "Access reason is too long"),
  audience_tag: z.enum(AUDIENCE_TAGS).default("custom"),
  expires_at: z.string().trim().max(64, "Expiration is too long").nullable().optional(),
  label: z.string().trim().min(1, "Label is required").max(120, "Label is too long"),
  max_redemptions: z.coerce
    .number()
    .int("Redemption limit must be an integer")
    .min(1, "Redemption limit must be at least 1")
    .max(MAX_REDEMPTIONS_PER_CODE, `Redemption limit must be ${MAX_REDEMPTIONS_PER_CODE} or less`)
    .default(1),
  quantity: z.coerce
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(MAX_BATCH_ISSUE_COUNT, `Quantity must be ${MAX_BATCH_ISSUE_COUNT} or less`)
    .default(1),
});

const ListAccessCodeSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const DeactivateAccessCodeSchema = z.object({
  code_id: z.string().uuid("A valid access code id is required"),
});

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[${LOG_PREFIX}] ${step}${detailsStr}`);
};

const jsonResponse = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
    status,
  });

const decodeRequestBody = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

const buildRawAccessCode = () => {
  const segments = CODE_SEGMENT_LENGTHS.map((segmentLength) => {
    const buffer = new Uint8Array(segmentLength);
    crypto.getRandomValues(buffer);

    return Array.from(buffer, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
  });

  return `${CODE_PREFIX}-${segments.join("-")}`;
};

const buildCodePreview = (rawCode: string) => `${rawCode.slice(0, 8)}...${rawCode.slice(-4)}`;

const hashAccessCode = async (rawCode: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawCode.trim().toUpperCase()),
  );

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const deriveAccessCodeStatus = (row: AccessCodeRow): AccessCodeStatus => {
  if (!row.active) {
    return "inactive";
  }

  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return "expired";
  }

  if (row.redeemed_count >= row.max_redemptions) {
    return "exhausted";
  }

  return "active";
};

const mapAccessCodeSummary = (row: AccessCodeRow): AccessCodeSummary => ({
  access_reason: row.access_reason,
  active: row.active,
  audience_tag: row.audience_tag,
  code_preview: row.code_preview,
  created_at: row.created_at,
  created_by: row.created_by,
  expires_at: row.expires_at,
  grant_tier: row.grant_tier,
  id: row.id,
  label: row.label,
  max_redemptions: row.max_redemptions,
  redeemed_count: row.redeemed_count,
  remaining_redemptions: Math.max(row.max_redemptions - row.redeemed_count, 0),
  status: deriveAccessCodeStatus(row),
  updated_at: row.updated_at,
});

const parseExpiration = (expiresAt: string | null | undefined) => {
  if (!expiresAt) {
    return null;
  }

  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Expiration must be a valid date");
  }

  if (parsed.getTime() <= Date.now()) {
    throw new Error("Expiration must be in the future");
  }

  return parsed.toISOString();
};

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, 503, { error: "Service unavailable" });
  }

  const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, 401, { error: "Authentication required" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !userData.user) {
      return jsonResponse(req, 401, { error: "Authentication failed" });
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    const { data: adminRole, error: adminRoleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRoleError) {
      logStep("Admin verification failed", { error: adminRoleError.message, userId: user.id });
      return jsonResponse(req, 500, { error: "Unable to verify admin access" });
    }

    if (!adminRole) {
      logStep("Access denied", { userId: user.id });
      return jsonResponse(req, 403, { error: "Access denied" });
    }

    const body = await decodeRequestBody(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "list") {
      const parsed = ListAccessCodeSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse(req, 400, { error: "Invalid list request" });
      }

      const { data, error } = await supabaseClient
        .from("access_pass_codes")
        .select(
          "id, code_preview, label, audience_tag, access_reason, grant_tier, max_redemptions, redeemed_count, active, expires_at, created_by, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(parsed.data.limit);

      if (error) {
        logStep("List failed", { error: error.message });
        return jsonResponse(req, 500, { error: "Failed to load access codes" });
      }

      const codes = ((data as AccessCodeRow[] | null) ?? []).map(mapAccessCodeSummary);
      return jsonResponse(req, 200, { codes });
    }

    if (action === "issue") {
      const parsed = IssueAccessCodeSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse(req, 400, {
          error: parsed.error.issues[0]?.message ?? "Invalid issuance request",
        });
      }

      let expiresAt: string | null;
      try {
        expiresAt = parseExpiration(parsed.data.expires_at);
      } catch (error) {
        return jsonResponse(req, 400, {
          error: error instanceof Error ? error.message : "Invalid expiration",
        });
      }

      const issuedCodes: Array<AccessCodeSummary & { code: string }> = [];

      for (let index = 0; index < parsed.data.quantity; index += 1) {
        let insertedRow: AccessCodeRow | null = null;
        let rawCode = "";

        for (let attempt = 0; attempt < HASH_RETRY_LIMIT; attempt += 1) {
          rawCode = buildRawAccessCode();
          const codeHash = await hashAccessCode(rawCode);

          const { data, error } = await supabaseClient
            .from("access_pass_codes")
            .insert({
              access_reason: parsed.data.access_reason,
              active: true,
              audience_tag: parsed.data.audience_tag,
              code_hash: codeHash,
              code_preview: buildCodePreview(rawCode),
              created_by: user.id,
              expires_at: expiresAt,
              grant_tier: "power",
              label: parsed.data.label,
              max_redemptions: parsed.data.max_redemptions,
              redeemed_count: 0,
            })
            .select(
              "id, code_preview, label, audience_tag, access_reason, grant_tier, max_redemptions, redeemed_count, active, expires_at, created_by, created_at, updated_at",
            );

          if (error) {
            if (error.code === "23505") {
              continue;
            }

            logStep("Issue failed", { error: error.message });
            return jsonResponse(req, 500, { error: "Failed to issue access code" });
          }

          insertedRow = ((data as AccessCodeRow[] | null) ?? [])[0] ?? null;
          if (insertedRow) {
            issuedCodes.push({
              ...mapAccessCodeSummary(insertedRow),
              code: rawCode,
            });
            break;
          }
        }

        if (!insertedRow) {
          logStep("Issue failed after retries", { userId: user.id });
          return jsonResponse(req, 500, { error: "Unable to issue a unique access code" });
        }
      }

      logStep("Issued access codes", { quantity: issuedCodes.length, userId: user.id });
      return jsonResponse(req, 200, {
        issued_codes: issuedCodes,
        quantity: issuedCodes.length,
      });
    }

    if (action === "deactivate") {
      const parsed = DeactivateAccessCodeSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse(req, 400, {
          error: parsed.error.issues[0]?.message ?? "Invalid deactivate request",
        });
      }

      const { data, error } = await supabaseClient
        .from("access_pass_codes")
        .update({ active: false })
        .eq("id", parsed.data.code_id)
        .select(
          "id, code_preview, label, audience_tag, access_reason, grant_tier, max_redemptions, redeemed_count, active, expires_at, created_by, created_at, updated_at",
        );

      if (error) {
        logStep("Deactivate failed", { codeId: parsed.data.code_id, error: error.message });
        return jsonResponse(req, 500, { error: "Failed to deactivate access code" });
      }

      const updatedRow = ((data as AccessCodeRow[] | null) ?? [])[0] ?? null;
      if (!updatedRow) {
        return jsonResponse(req, 404, { error: "Access code not found" });
      }

      logStep("Deactivated access code", { codeId: updatedRow.id, userId: user.id });
      return jsonResponse(req, 200, {
        code: mapAccessCodeSummary(updatedRow),
      });
    }

    return jsonResponse(req, 400, { error: "Invalid action" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    logStep("Unexpected error", { message });
    return jsonResponse(req, 500, { error: "Internal server error" });
  }
});
