import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import {
  buildFamilyCourtRecordExportPackage,
  COURT_RECORD_EXPORT_ARTIFACT_TYPE,
  COURT_RECORD_EXPORT_CANONICALIZATION_VERSION,
  COURT_RECORD_EXPORT_HASH_ALGORITHM,
  COURT_RECORD_EXPORT_INTEGRITY_MODEL_VERSION,
  COURT_RECORD_EXPORT_PDF_ARTIFACT_TYPE,
  COURT_RECORD_EXPORT_SCHEMA_VERSION,
  COURT_RECORD_EXPORT_SIGNATURE_ALGORITHM,
  getFamilyCourtRecordArtifactPayloadJson,
  getFamilyCourtRecordManifestJson,
  getFamilyCourtRecordPayloadJson,
  getFamilyCourtRecordReceiptPayloadJson,
  parseFamilyCourtRecordEvidencePackage,
  signFamilyCourtRecordExportReceiptPayload,
  type FamilyCourtRecordCallSessionEntry,
  type FamilyCourtRecordCanonicalExportPayload,
  type FamilyCourtRecordChild,
  type FamilyCourtRecordDocumentAccessLog,
  type FamilyCourtRecordDocumentReference,
  type FamilyCourtRecordExchangeCheckin,
  type FamilyCourtRecordExpense,
  type FamilyCourtRecordParticipant,
  type FamilyCourtRecordExportReceipt,
  type FamilyCourtRecordExportSection,
  type FamilyCourtRecordScheduleOverview,
  type FamilyCourtRecordScheduleRequest,
  verifyFamilyCourtRecordExportReceiptSignature,
} from "../_shared/courtRecordExportIntegrity.ts";
import { generateCourtRecordExportPdf } from "../_shared/courtRecordExportPdf.ts";
import {
  downloadImmutableCourtExportObject,
  getCourtExportObjectLockBucketName,
  uploadImmutableCourtExportObject,
} from "../_shared/courtExportS3.ts";
import {
  requireCourtExportPowerAccess,
  requireFamilyCourtRecordExportRole,
} from "../_shared/courtExportAccess.ts";
import {
  getActiveMembershipForUser,
  HttpError,
  requireAuthenticatedProfile,
  resolveDisplayName,
} from "../_shared/callHelpers.ts";
import {
  sha256Hex,
  sha256HexFromBytes,
  stableStringifyForIntegrity,
} from "../_shared/messagingThreadExportIntegrity.ts";

const LOG_PREFIX = "COURT-RECORD-EXPORT";

type VerificationMode =
  | "provided_pdf_artifact"
  | "provided_package_json"
  | "stored_pdf_artifact"
  | "stored_signature"
  | "stored_source";

type VerificationStatus =
  | "artifact_hash_unavailable"
  | "artifact_not_found"
  | "export_not_found"
  | "match"
  | "mismatch"
  | "not_authorized"
  | "pdf_hash_unavailable"
  | "receipt_not_found"
  | "signature_invalid"
  | "verification_not_supported";

type ExportRequest =
  | {
      action: "create";
      date_range?: { end?: string; start?: string };
      export_format?: "json_manifest" | "pdf";
      export_scope?: "family_unified";
      family_id?: string;
      include_sections?: FamilyCourtRecordExportSection[];
    }
  | {
      action: "list";
      export_scope?: "family_unified";
      family_id?: string;
      limit?: number;
    }
  | {
      action: "download";
      artifact_kind?: "json_evidence_package" | "pdf";
      export_id?: string;
      family_id?: string;
    }
  | {
      action: "verify";
      export_id?: string;
      family_id?: string;
      provided_package_json?: string;
      provided_pdf_base64?: string;
      verification_mode?: VerificationMode;
    };

type ProfileRow = {
  email: string | null;
  full_name: string | null;
  id: string;
  user_id: string;
};

type FamilyMemberRow = {
  profile_id: string;
  role: string;
  status: string;
  user_id: string;
  profiles?: {
    email: string | null;
    full_name: string | null;
    id: string;
  } | null;
};

type MessageThreadRow = {
  family_id: string | null;
  id: string;
  name: string | null;
  thread_type: string;
};

type ThreadMessageRow = {
  content: string;
  created_at: string;
  id: string;
  sender_id: string;
  sender_role: string;
  thread_id: string;
};

type CallSessionRow = {
  answered_at: string | null;
  call_type: "audio" | "video";
  callee_display_name: string | null;
  callee_profile_id: string;
  created_at: string;
  ended_at: string | null;
  failed_reason: string | null;
  family_id: string;
  id: string;
  initiator_display_name: string | null;
  initiator_profile_id: string;
  source: string;
  status: string;
  thread_id: string | null;
};

type CallEventRow = {
  actor_display_name: string | null;
  actor_profile_id: string | null;
  call_session_id: string;
  created_at: string;
  event_type: string;
  id: string;
  payload: Record<string, unknown> | null;
};

type ChildRow = {
  id: string;
  name: string;
};

type DocumentRow = {
  category: string;
  child_id: string | null;
  created_at: string;
  description: string | null;
  family_id: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  id: string;
  title: string;
  uploaded_by: string;
};

type DocumentAccessLogRow = {
  accessed_by: string;
  action: string;
  created_at: string;
  document_id: string;
  id: string;
};

type ExpenseRow = {
  amount: number;
  category: string;
  child_id: string | null;
  created_at: string;
  description: string;
  expense_date: string;
  id: string;
  notes: string | null;
  split_percentage: number | null;
};

type ScheduleRequestRow = {
  created_at: string;
  id: string;
  original_date: string;
  proposed_date: string | null;
  reason: string | null;
  recipient_id: string;
  requester_id: string;
  request_type: string;
  status: string;
  updated_at: string;
};

type ScheduleRow = {
  exchange_location: string | null;
  exchange_time: string | null;
  holidays: unknown;
  id: string;
  pattern: string;
  start_date: string;
};

type ExchangeCheckinRow = {
  checked_in_at: string;
  exchange_date: string;
  id: string;
  note: string | null;
  user_id: string;
};

type CourtExportRow = {
  artifact_hash: string | null;
  artifact_hash_algorithm: string | null;
  artifact_object_lock_mode: string | null;
  artifact_retain_until: string | null;
  artifact_storage_bucket: string | null;
  artifact_storage_key: string | null;
  artifact_storage_provider: string | null;
  artifact_storage_version_id: string | null;
  artifact_type: string | null;
  canonicalization_version: string | null;
  content_hash: string;
  created_by_profile_id: string;
  created_by_user_id: string | null;
  export_format: "json_manifest" | "pdf";
  export_scope: "family_unified" | "message_thread";
  exported_at: string;
  family_id: string;
  hash_algorithm: string;
  id: string;
  included_sections: string[] | null;
  integrity_model_version: string | null;
  manifest_hash: string | null;
  manifest_hash_algorithm: string | null;
  manifest_json: Record<string, unknown>;
  pdf_artifact_hash: string | null;
  pdf_bytes_size: number | null;
  pdf_generated_at: string | null;
  pdf_hash_algorithm: string | null;
  pdf_object_lock_mode: string | null;
  pdf_retain_until: string | null;
  pdf_storage_bucket: string | null;
  pdf_storage_key: string | null;
  pdf_storage_provider: string | null;
  pdf_storage_version_id: string | null;
  receipt_json: Record<string, unknown> | null;
  receipt_signature: string | null;
  receipt_signature_algorithm: string | null;
  record_count: number;
  record_range_end: string | null;
  record_range_start: string | null;
  signing_key_id: string | null;
  source_id: string | null;
  source_type: "family_unified" | "message_thread";
  thread_id: string | null;
  thread_type: string | null;
};

type CourtExportStorageLayer = {
  bucket: string | null;
  key: string | null;
  object_lock_mode: string | null;
  provider: string | null;
  retain_until: string | null;
  version_id: string | null;
};

type VerificationLayer = {
  algorithm: string | null;
  computed: string | null;
  label: string;
  matches: boolean | null;
  note: string | null;
  status: "match" | "mismatch" | "not_supported" | "unavailable";
  stored: string | null;
};

type SignatureVerificationLayer = {
  algorithm: string | null;
  note: string | null;
  present: boolean;
  status: "match" | "mismatch" | "not_supported";
  valid: boolean | null;
};

type FamilyCourtRecordExportSummary = {
  artifact_hash: string | null;
  artifact_hash_algorithm: string | null;
  artifact_storage: CourtExportStorageLayer;
  canonicalization_version: string | null;
  content_hash: string;
  counts: Record<string, number> | null;
  export_format: "json_manifest" | "pdf";
  export_scope: "family_unified";
  exported_at: string;
  family_id: string;
  hash_algorithm: string;
  id: string;
  included_sections: string[];
  integrity_model_version: string | null;
  manifest_hash: string | null;
  manifest_hash_algorithm: string | null;
  pdf_artifact_hash: string | null;
  pdf_bytes_size: number | null;
  pdf_generated_at: string | null;
  pdf_hash_algorithm: string | null;
  pdf_storage: CourtExportStorageLayer;
  record_count: number;
  record_range_end: string | null;
  record_range_start: string | null;
  requested_range_end: string | null;
  requested_range_start: string | null;
  signature_algorithm: string | null;
  signature_present: boolean;
  signing_key_id: string | null;
};

const SUPPORTED_FAMILY_EXPORT_SECTIONS: FamilyCourtRecordExportSection[] = [
  "messages",
  "call_activity",
  "schedule_requests",
  "exchange_checkins",
  "document_references",
  "document_access_logs",
  "expenses",
  "schedule_overview",
  "children",
];

const COURT_EXPORT_SELECT_COLUMNS = [
  "id",
  "family_id",
  "created_by_user_id",
  "created_by_profile_id",
  "source_type",
  "source_id",
  "export_scope",
  "thread_id",
  "thread_type",
  "export_format",
  "hash_algorithm",
  "content_hash",
  "integrity_model_version",
  "canonicalization_version",
  "manifest_hash_algorithm",
  "manifest_hash",
  "artifact_hash_algorithm",
  "artifact_hash",
  "artifact_type",
  "artifact_storage_provider",
  "artifact_storage_bucket",
  "artifact_storage_key",
  "artifact_storage_version_id",
  "artifact_object_lock_mode",
  "artifact_retain_until",
  "pdf_hash_algorithm",
  "pdf_artifact_hash",
  "pdf_bytes_size",
  "pdf_generated_at",
  "pdf_storage_provider",
  "pdf_storage_bucket",
  "pdf_storage_key",
  "pdf_storage_version_id",
  "pdf_object_lock_mode",
  "pdf_retain_until",
  "signing_key_id",
  "receipt_signature_algorithm",
  "receipt_signature",
  "receipt_json",
  "manifest_json",
  "record_count",
  "record_range_start",
  "record_range_end",
  "included_sections",
  "exported_at",
].join(", ");

const logStep = (step: string, details?: Record<string, unknown>) => {
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[${LOG_PREFIX}] ${step}${suffix}`);
};

const jsonResponse = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
    status,
  });

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const encodeBase64 = (value: Uint8Array) => {
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < value.length; index += chunkSize) {
    const chunk = value.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  const encoded = globalThis.btoa?.(binary);
  if (!encoded) {
    throw new Error("Base64 encoding is unavailable in this environment.");
  }

  return encoded;
};

const decodeBase64ToBytes = (value: string) => {
  const normalizedValue = value.trim().replace(/\s+/g, "");
  if (!normalizedValue) {
    throw new HttpError(400, "A non-empty base64 artifact payload is required.");
  }

  const base64Value = normalizedValue
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(normalizedValue.length / 4) * 4, "=");
  const binary = globalThis.atob?.(base64Value);
  if (!binary) {
    throw new Error("Base64 decoding is unavailable in this environment.");
  }

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const getApplicationBuildId = () =>
  Deno.env.get("VERCEL_GIT_COMMIT_SHA") ??
  Deno.env.get("DENO_DEPLOYMENT_ID") ??
  null;

type ReceiptSigningConfig = {
  keyId: string;
  privateKeyPkcs8Base64: string | null;
  publicKeySpkiBase64: string;
};

const parseSigningPublicKeys = () => {
  const rawValue = Deno.env.get("MESSAGING_THREAD_EXPORT_SIGNING_PUBLIC_KEYS_JSON")?.trim();
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    return Object.entries(parsed).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (typeof value === "string" && value.trim()) {
        accumulator[key] = value.trim();
      }
      return accumulator;
    }, {});
  } catch {
    return null;
  }
};

const getReceiptSigningConfig = (options?: { requirePrivateKey?: boolean }) => {
  const keyId = Deno.env.get("MESSAGING_THREAD_EXPORT_SIGNING_KEY_ID")?.trim();
  const publicKeySpkiBase64 = Deno.env
    .get("MESSAGING_THREAD_EXPORT_SIGNING_PUBLIC_KEY_SPKI_B64")
    ?.trim();
  const privateKeyPkcs8Base64 = Deno.env
    .get("MESSAGING_THREAD_EXPORT_SIGNING_PRIVATE_KEY_PKCS8_B64")
    ?.trim();

  if (!keyId || !publicKeySpkiBase64 || (options?.requirePrivateKey && !privateKeyPkcs8Base64)) {
    return null;
  }

  return {
    keyId,
    privateKeyPkcs8Base64: privateKeyPkcs8Base64 ?? null,
    publicKeySpkiBase64,
  } satisfies ReceiptSigningConfig;
};

const getReceiptVerificationPublicKey = (signingKeyId: string | null | undefined) => {
  const currentConfig = getReceiptSigningConfig();
  const configuredPublicKeys = parseSigningPublicKeys();

  if (signingKeyId && configuredPublicKeys?.[signingKeyId]) {
    return configuredPublicKeys[signingKeyId];
  }

  if (!currentConfig) {
    return null;
  }

  if (!signingKeyId || signingKeyId === currentConfig.keyId) {
    return currentConfig.publicKeySpkiBase64;
  }

  return null;
};

const requireFamilyId = (familyId: string | undefined) => {
  if (!familyId) {
    throw new HttpError(400, "family_id is required.");
  }

  return familyId;
};

const requireExportId = (exportId: string | undefined) => {
  if (!exportId) {
    throw new HttpError(400, "export_id is required.");
  }

  return exportId;
};

const requireDateRange = (
  dateRange: { end?: string; start?: string } | undefined,
) => {
  const start = dateRange?.start?.trim();
  const end = dateRange?.end?.trim();

  if (!start || !end) {
    throw new HttpError(400, "date_range.start and date_range.end are required.");
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    throw new HttpError(400, "date_range must contain valid ISO timestamps with start <= end.");
  }

  return {
    end: endDate.toISOString(),
    start: startDate.toISOString(),
  };
};

const requireIncludedSections = (sections: FamilyCourtRecordExportSection[] | undefined) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new HttpError(400, "include_sections is required.");
  }

  const normalizedSections = [...new Set(sections)];
  const unsupportedSection = normalizedSections.find(
    (section) => !SUPPORTED_FAMILY_EXPORT_SECTIONS.includes(section),
  );

  if (unsupportedSection) {
    throw new HttpError(400, `Unsupported export section: ${unsupportedSection}`);
  }

  return normalizedSections;
};

const sanitizeArtifactFileSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "court-record-export";

const buildArtifactPaths = (options: {
  exportId: string;
  exportedAt: string;
  familyId: string;
}) => {
  const bucket = getCourtExportObjectLockBucketName();
  const timestampSegment = options.exportedAt
    .replace(/[:.]/g, "-")
    .replace(/\+/g, "plus");
  const basePath = `families/${options.familyId}/court-exports/${options.exportId}/${timestampSegment}`;

  return {
    evidencePackage: {
      bucket,
      contentType: "application/json; charset=utf-8",
      fileName: `court-record-export-${sanitizeArtifactFileSegment(options.exportId)}-evidence-package.json`,
      key: `${basePath}/court-record-export-evidence-package.json`,
      provider: "aws_s3_object_lock" as const,
    },
    pdf: {
      bucket,
      contentType: "application/pdf",
      fileName: `court-record-export-${sanitizeArtifactFileSegment(options.exportId)}.pdf`,
      key: `${basePath}/court-record-export.pdf`,
      provider: "aws_s3_object_lock" as const,
    },
  };
};

const isWithinRange = (value: string | null | undefined, range: { end: string; start: string }) => {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const normalized = parsed.toISOString();
  return normalized >= range.start && normalized <= range.end;
};

const toDateOnly = (value: string) => value.split("T")[0];

async function loadFamilyParticipants(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("family_members")
    .select(`
      profile_id,
      role,
      status,
      user_id,
      profiles!family_members_profile_id_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq("family_id", familyId)
    .eq("status", "active");

  if (error) {
    throw new HttpError(500, error.message);
  }

  const rows = (data as FamilyMemberRow[] | null) ?? [];
  const participants = rows.map<FamilyCourtRecordParticipant>((row) => ({
    email: row.profiles?.email ?? null,
    full_name: row.profiles?.full_name ?? null,
    membership_role: row.role,
    profile_id: row.profile_id,
  }));
  const profileMap = new Map<string, ProfileRow>();

  rows.forEach((row) => {
    if (row.profiles?.id) {
      profileMap.set(row.profile_id, {
        email: row.profiles.email ?? null,
        full_name: row.profiles.full_name ?? null,
        id: row.profiles.id,
        user_id: row.user_id,
      });
    }
  });

  return {
    participants: participants.sort((left, right) =>
      (left.full_name ?? left.email ?? left.profile_id).localeCompare(
        right.full_name ?? right.email ?? right.profile_id,
      ),
    ),
    profileMap,
  };
}

async function loadChildren(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("children")
    .select("id, name")
    .eq("family_id", familyId)
    .order("name", { ascending: true });

  if (error) {
    throw new HttpError(500, error.message);
  }

  const children = ((data as ChildRow[] | null) ?? []).map<FamilyCourtRecordChild>((child) => ({
    id: child.id,
    name: child.name,
  }));

  return {
    childMap: new Map(children.map((child) => [child.id, child.name])),
    children,
  };
}

async function loadMessages(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
  range: { end: string; start: string },
  profileMap: Map<string, ProfileRow>,
) {
  const { data: threads, error: threadError } = await supabaseAdmin
    .from("message_threads")
    .select("id, name, thread_type, family_id")
    .eq("family_id", familyId);

  if (threadError) {
    throw new HttpError(500, threadError.message);
  }

  const threadRows = (threads as MessageThreadRow[] | null) ?? [];
  const threadIds = threadRows.map((thread) => thread.id);
  const threadMap = new Map(threadRows.map((thread) => [thread.id, thread]));

  if (threadIds.length === 0) {
    return [];
  }

  const { data: messages, error } = await supabaseAdmin
    .from("thread_messages")
    .select("id, thread_id, sender_id, sender_role, content, created_at")
    .in("thread_id", threadIds)
    .gte("created_at", range.start)
    .lte("created_at", range.end)
    .order("created_at", { ascending: true });

  if (error) {
    throw new HttpError(500, error.message);
  }

  return ((messages as ThreadMessageRow[] | null) ?? []).map((message) => {
    const senderProfile = profileMap.get(message.sender_id);
    const thread = threadMap.get(message.thread_id);

    return {
      content: message.content,
      created_at: message.created_at,
      id: message.id,
      sender_id: message.sender_id,
      sender_name: resolveDisplayName(senderProfile ?? {}),
      sender_role: message.sender_role,
      thread_id: message.thread_id,
      thread_name: thread?.name ?? null,
      thread_type: thread?.thread_type ?? "unknown",
    };
  });
}

async function loadCallActivity(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
  range: { end: string; start: string },
) {
  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("call_sessions")
    .select(
      "id, family_id, thread_id, created_at, answered_at, ended_at, call_type, status, source, failed_reason, initiator_profile_id, initiator_display_name, callee_profile_id, callee_display_name",
    )
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });

  if (sessionsError) {
    throw new HttpError(500, sessionsError.message);
  }

  const sessionRows = (sessions as CallSessionRow[] | null) ?? [];
  if (sessionRows.length === 0) {
    return [];
  }

  const sessionIds = sessionRows.map((session) => session.id);
  const { data: events, error: eventsError } = await supabaseAdmin
    .from("call_events")
    .select("id, call_session_id, actor_profile_id, actor_display_name, event_type, payload, created_at")
    .in("call_session_id", sessionIds)
    .order("created_at", { ascending: true });

  if (eventsError) {
    throw new HttpError(500, eventsError.message);
  }

  const eventsBySession = new Map<string, CallEventRow[]>();
  ((events as CallEventRow[] | null) ?? []).forEach((event) => {
    const existing = eventsBySession.get(event.call_session_id) ?? [];
    existing.push(event);
    eventsBySession.set(event.call_session_id, existing);
  });

  return sessionRows
    .filter((session) => {
      const sessionEvents = eventsBySession.get(session.id) ?? [];
      return (
        isWithinRange(session.created_at, range) ||
        isWithinRange(session.answered_at, range) ||
        isWithinRange(session.ended_at, range) ||
        sessionEvents.some((event) => isWithinRange(event.created_at, range))
      );
    })
    .map<FamilyCourtRecordCallSessionEntry>((session) => ({
      answered_at: session.answered_at,
      call_type: session.call_type,
      callee_display_name: session.callee_display_name,
      callee_profile_id: session.callee_profile_id,
      created_at: session.created_at,
      ended_at: session.ended_at,
      failed_reason: session.failed_reason,
      id: session.id,
      initiator_display_name: session.initiator_display_name,
      initiator_profile_id: session.initiator_profile_id,
      source: session.source,
      status: session.status,
      thread_id: session.thread_id,
      events: (eventsBySession.get(session.id) ?? []).map((event) => ({
        actor_id: event.actor_profile_id,
        actor_name: event.actor_display_name,
        created_at: event.created_at,
        event_type: event.event_type,
        id: event.id,
        payload: event.payload ?? {},
      })),
    }));
}

async function loadDocuments(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
  range: { end: string; start: string },
  childMap: Map<string, string>,
  profileMap: Map<string, ProfileRow>,
) {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id, title, description, family_id, file_name, file_type, file_size, uploaded_by, category, created_at, child_id")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new HttpError(500, error.message);
  }

  const rows = (data as DocumentRow[] | null) ?? [];
  if (rows.length === 0) {
    return {
      accessLogs: [] as FamilyCourtRecordDocumentAccessLog[],
      references: [] as FamilyCourtRecordDocumentReference[],
    };
  }

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const { data: logs, error: logsError } = await supabaseAdmin
    .from("document_access_logs")
    .select("id, document_id, accessed_by, action, created_at")
    .in("document_id", rows.map((row) => row.id))
    .gte("created_at", range.start)
    .lte("created_at", range.end)
    .order("created_at", { ascending: true });

  if (logsError) {
    throw new HttpError(500, logsError.message);
  }

  const accessLogs = ((logs as DocumentAccessLogRow[] | null) ?? []).map<FamilyCourtRecordDocumentAccessLog>((log) => ({
    accessed_by_name: resolveDisplayName(profileMap.get(log.accessed_by) ?? {}),
    action: log.action,
    created_at: log.created_at,
    document_id: log.document_id,
    document_title: rowsById.get(log.document_id)?.title ?? "Unknown Document",
    id: log.id,
  }));

  const accessedDocumentIds = new Set(accessLogs.map((log) => log.document_id));
  const references = rows
    .filter((row) => isWithinRange(row.created_at, range) || accessedDocumentIds.has(row.id))
    .map<FamilyCourtRecordDocumentReference>((row) => ({
      category: row.category,
      child_name: row.child_id ? childMap.get(row.child_id) ?? null : null,
      created_at: row.created_at,
      description: row.description,
      file_name: row.file_name,
      file_size: row.file_size,
      file_type: row.file_type,
      id: row.id,
      title: row.title,
      uploaded_by_name: resolveDisplayName(profileMap.get(row.uploaded_by) ?? {}),
    }));

  return {
    accessLogs,
    references,
  };
}

async function loadExpenses(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
  range: { end: string; start: string },
  childMap: Map<string, string>,
) {
  const { data, error } = await supabaseAdmin
    .from("expenses")
    .select("id, amount, description, category, expense_date, split_percentage, notes, created_at, child_id")
    .eq("family_id", familyId)
    .gte("expense_date", toDateOnly(range.start))
    .lte("expense_date", toDateOnly(range.end))
    .order("expense_date", { ascending: true });

  if (error) {
    throw new HttpError(500, error.message);
  }

  return ((data as ExpenseRow[] | null) ?? []).map<FamilyCourtRecordExpense>((expense) => ({
    amount: expense.amount,
    category: expense.category,
    child_name: expense.child_id ? childMap.get(expense.child_id) ?? null : null,
    created_at: expense.created_at,
    description: expense.description,
    expense_date: expense.expense_date,
    id: expense.id,
    notes: expense.notes,
    split_percentage: expense.split_percentage,
  }));
}

async function loadScheduleRequests(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
  range: { end: string; start: string },
  profileMap: Map<string, ProfileRow>,
) {
  const { data, error } = await supabaseAdmin
    .from("schedule_requests")
    .select("id, created_at, original_date, proposed_date, reason, requester_id, recipient_id, request_type, status, updated_at")
    .eq("family_id", familyId)
    .gte("created_at", range.start)
    .lte("created_at", range.end)
    .order("created_at", { ascending: true });

  if (error) {
    throw new HttpError(500, error.message);
  }

  return ((data as ScheduleRequestRow[] | null) ?? []).map<FamilyCourtRecordScheduleRequest>((request) => ({
    created_at: request.created_at,
    id: request.id,
    original_date: request.original_date,
    proposed_date: request.proposed_date,
    reason: request.reason,
    recipient_name: resolveDisplayName(profileMap.get(request.recipient_id) ?? {}),
    requester_name: resolveDisplayName(profileMap.get(request.requester_id) ?? {}),
    request_type: request.request_type,
    status: request.status,
    updated_at: request.updated_at,
  }));
}

async function loadScheduleOverview(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("custody_schedules")
    .select("id, pattern, start_date, exchange_time, exchange_location, holidays")
    .eq("family_id", familyId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data) {
    return null;
  }

  return {
    exchange_location: data.exchange_location,
    exchange_time: data.exchange_time,
    holidays: data.holidays,
    id: data.id,
    pattern: data.pattern,
    start_date: data.start_date,
  } satisfies FamilyCourtRecordScheduleOverview;
}

async function loadExchangeCheckins(
  supabaseAdmin: ReturnType<typeof createClient>,
  scheduleId: string | null,
  range: { end: string; start: string },
  profileMap: Map<string, ProfileRow>,
) {
  if (!scheduleId) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("exchange_checkins")
    .select("id, exchange_date, checked_in_at, note, user_id")
    .eq("schedule_id", scheduleId)
    .gte("exchange_date", toDateOnly(range.start))
    .lte("exchange_date", toDateOnly(range.end))
    .order("exchange_date", { ascending: true });

  if (error) {
    throw new HttpError(500, error.message);
  }

  return ((data as ExchangeCheckinRow[] | null) ?? []).map<FamilyCourtRecordExchangeCheckin>((checkin) => ({
    checked_in_at: checkin.checked_in_at,
    exchange_date: checkin.exchange_date,
    id: checkin.id,
    note: checkin.note,
    user_name: resolveDisplayName(profileMap.get(checkin.user_id) ?? {}),
  }));
}

async function buildCanonicalPayload(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
  range: { end: string; start: string },
  includedSections: FamilyCourtRecordExportSection[],
) {
  const { participants, profileMap } = await loadFamilyParticipants(supabaseAdmin, familyId);
  const { childMap, children } = await loadChildren(supabaseAdmin, familyId);
  const scheduleOverview = includedSections.includes("schedule_overview")
    ? await loadScheduleOverview(supabaseAdmin, familyId)
    : null;

  const [
    messages,
    callActivity,
    documents,
    expenses,
    scheduleRequests,
    exchangeCheckins,
  ] = await Promise.all([
    includedSections.includes("messages")
      ? loadMessages(supabaseAdmin, familyId, range, profileMap)
      : Promise.resolve([]),
    includedSections.includes("call_activity")
      ? loadCallActivity(supabaseAdmin, familyId, range)
      : Promise.resolve([]),
    includedSections.includes("document_references") || includedSections.includes("document_access_logs")
      ? loadDocuments(supabaseAdmin, familyId, range, childMap, profileMap)
      : Promise.resolve({ accessLogs: [], references: [] }),
    includedSections.includes("expenses")
      ? loadExpenses(supabaseAdmin, familyId, range, childMap)
      : Promise.resolve([]),
    includedSections.includes("schedule_requests")
      ? loadScheduleRequests(supabaseAdmin, familyId, range, profileMap)
      : Promise.resolve([]),
    includedSections.includes("exchange_checkins")
      ? loadExchangeCheckins(supabaseAdmin, scheduleOverview?.id ?? null, range, profileMap)
      : Promise.resolve([]),
  ]);

  return {
    call_activity: callActivity,
    children: includedSections.includes("children") ? children : [],
    document_access_logs: includedSections.includes("document_access_logs")
      ? documents.accessLogs
      : [],
    document_references: includedSections.includes("document_references")
      ? documents.references
      : [],
    exchange_checkins: exchangeCheckins,
    expenses,
    messages,
    parties: participants,
    schedule_overview: includedSections.includes("schedule_overview")
      ? scheduleOverview
      : null,
    schedule_requests: scheduleRequests,
  } satisfies Omit<
    FamilyCourtRecordCanonicalExportPayload,
    | "schema_version"
    | "canonicalization_version"
    | "source_type"
    | "export_scope"
    | "family_id"
    | "requested_range"
    | "included_sections"
  >;
}

async function createExportPackage(
  supabaseAdmin: ReturnType<typeof createClient>,
  options: {
    exportFormat?: "json_manifest" | "pdf";
    exportId?: string;
    exportedAt?: string;
    exportedByProfileId: string;
    exportedByUserId: string | null;
    familyId: string;
    includedSections: FamilyCourtRecordExportSection[];
    range: { end: string; start: string };
    signReceipt?: boolean;
  },
) {
  const exportId = options.exportId ?? crypto.randomUUID();
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const artifactPaths = buildArtifactPaths({
    exportId,
    exportedAt,
    familyId: options.familyId,
  });
  const canonicalPayloadData = await buildCanonicalPayload(
    supabaseAdmin,
    options.familyId,
    options.range,
    options.includedSections,
  );

  const buildArgs = {
    applicationBuildId: getApplicationBuildId(),
    artifactStorage: {
      bucket: artifactPaths.evidencePackage.bucket,
      key: artifactPaths.evidencePackage.key,
      provider: artifactPaths.evidencePackage.provider,
    },
    canonicalPayloadData,
    exportFormat: options.exportFormat ?? "pdf",
    exportId,
    exportedAt,
    exportedByProfileId: options.exportedByProfileId,
    exportedByUserId: options.exportedByUserId,
    familyId: options.familyId,
    includedSections: options.includedSections,
    requestedRange: options.range,
  } as const;

  const signingConfig = options.signReceipt
    ? getReceiptSigningConfig({ requirePrivateKey: true })
    : getReceiptSigningConfig();

  if (options.signReceipt && !signingConfig?.privateKeyPkcs8Base64) {
    throw new HttpError(503, "Court-record export receipt signing is not configured in this environment.");
  }

  const preSignaturePackage = await buildFamilyCourtRecordExportPackage({
    ...buildArgs,
    receiptSignature: signingConfig
      ? {
          algorithm: COURT_RECORD_EXPORT_SIGNATURE_ALGORITHM,
          signingKeyId: signingConfig.keyId,
          value: "",
        }
      : null,
  });

  const pdfArtifact =
    buildArgs.exportFormat === "pdf"
      ? (() => {
          const pdfBytes = generateCourtRecordExportPdf({
            packageData: preSignaturePackage,
            receiptId: exportId,
            signingKeyId: signingConfig?.keyId ?? null,
            signatureAlgorithm: signingConfig
              ? COURT_RECORD_EXPORT_SIGNATURE_ALGORITHM
              : null,
          });

          return {
            base64: encodeBase64(pdfBytes),
            bytes: pdfBytes,
            bytesSize: pdfBytes.byteLength,
            contentType: artifactPaths.pdf.contentType,
            fileName: artifactPaths.pdf.fileName,
            generatedAt: exportedAt,
            hash: "",
            hashAlgorithm: COURT_RECORD_EXPORT_HASH_ALGORITHM,
            storageBucket: artifactPaths.pdf.bucket,
            storageKey: artifactPaths.pdf.key,
            storageProvider: artifactPaths.pdf.provider,
          };
        })()
      : null;

  if (pdfArtifact) {
    pdfArtifact.hash = await sha256HexFromBytes(pdfArtifact.bytes);
  }

  if (!options.signReceipt) {
    return {
      artifactPaths,
      packageData: await buildFamilyCourtRecordExportPackage({
        ...buildArgs,
        pdfArtifact:
          pdfArtifact && {
            bytesSize: pdfArtifact.bytesSize,
            generatedAt: pdfArtifact.generatedAt,
            hash: pdfArtifact.hash,
            hashAlgorithm: pdfArtifact.hashAlgorithm,
            storageBucket: pdfArtifact.storageBucket,
            storageKey: pdfArtifact.storageKey,
            storageProvider: pdfArtifact.storageProvider,
          },
      }),
      pdfArtifact,
    };
  }

  const signingReadyPackage = await buildFamilyCourtRecordExportPackage({
    ...buildArgs,
    pdfArtifact:
      pdfArtifact && {
        bytesSize: pdfArtifact.bytesSize,
        generatedAt: pdfArtifact.generatedAt,
        hash: pdfArtifact.hash,
        hashAlgorithm: pdfArtifact.hashAlgorithm,
        storageBucket: pdfArtifact.storageBucket,
        storageKey: pdfArtifact.storageKey,
        storageProvider: pdfArtifact.storageProvider,
      },
    receiptSignature: {
      algorithm: COURT_RECORD_EXPORT_SIGNATURE_ALGORITHM,
      signingKeyId: signingConfig!.keyId,
      value: "",
    },
  });

  const receiptSignature = await signFamilyCourtRecordExportReceiptPayload(
    signingReadyPackage.receiptPayloadJson,
    signingConfig!.privateKeyPkcs8Base64!,
  );

  const packageData = await buildFamilyCourtRecordExportPackage({
    ...buildArgs,
    pdfArtifact:
      pdfArtifact && {
        bytesSize: pdfArtifact.bytesSize,
        generatedAt: pdfArtifact.generatedAt,
        hash: pdfArtifact.hash,
        hashAlgorithm: pdfArtifact.hashAlgorithm,
        storageBucket: pdfArtifact.storageBucket,
        storageKey: pdfArtifact.storageKey,
        storageProvider: pdfArtifact.storageProvider,
      },
    receiptSignature: {
      algorithm: COURT_RECORD_EXPORT_SIGNATURE_ALGORITHM,
      signingKeyId: signingConfig!.keyId,
      value: receiptSignature,
    },
  });

  return {
    artifactPaths,
    packageData,
    pdfArtifact,
  };
}

async function storeExportArtifacts(
  options: Awaited<ReturnType<typeof createExportPackage>>,
) {
  const evidencePackageBytes = new TextEncoder().encode(options.packageData.evidencePackageJson);
  const evidencePackage = await uploadImmutableCourtExportObject({
    bytes: evidencePackageBytes,
    contentType: options.artifactPaths.evidencePackage.contentType,
    key: options.artifactPaths.evidencePackage.key,
  });

  const pdfArtifact = options.pdfArtifact
    ? await uploadImmutableCourtExportObject({
        bytes: options.pdfArtifact.bytes,
        contentType: options.pdfArtifact.contentType,
        key: options.pdfArtifact.storageKey,
      })
    : null;

  return {
    evidencePackage,
    pdfArtifact,
  };
}

async function persistCourtExport(
  supabaseAdmin: ReturnType<typeof createClient>,
  exportArtifacts: Awaited<ReturnType<typeof createExportPackage>>,
  storedArtifacts: Awaited<ReturnType<typeof storeExportArtifacts>>,
) {
  const { packageData } = exportArtifacts;

  const { data, error } = await supabaseAdmin
    .from("court_exports")
    .insert({
      id: packageData.manifest.export_id,
      family_id: packageData.manifest.family_id,
      created_by_user_id: packageData.receipt.created_by_user_id,
      created_by_profile_id: packageData.manifest.exported_by_profile_id,
      source_type: "family_unified",
      source_id: null,
      export_scope: "family_unified",
      thread_id: null,
      thread_type: null,
      export_format: packageData.receipt.export_format,
      hash_algorithm: packageData.hashAlgorithm,
      content_hash: packageData.contentHash,
      integrity_model_version: packageData.receipt.integrity_model_version,
      canonicalization_version: packageData.receipt.canonicalization_version,
      manifest_hash_algorithm: packageData.receipt.manifest_hash_algorithm,
      manifest_hash: packageData.receipt.manifest_hash,
      artifact_hash_algorithm: packageData.receipt.artifact_hash_algorithm,
      artifact_hash: packageData.receipt.artifact_hash,
      artifact_type: packageData.receipt.artifact_type,
      artifact_storage_provider: storedArtifacts.evidencePackage.provider,
      artifact_storage_bucket: storedArtifacts.evidencePackage.bucket,
      artifact_storage_key: storedArtifacts.evidencePackage.key,
      artifact_storage_version_id: storedArtifacts.evidencePackage.versionId,
      artifact_object_lock_mode: storedArtifacts.evidencePackage.objectLockMode,
      artifact_retain_until: storedArtifacts.evidencePackage.retainUntil,
      pdf_hash_algorithm: packageData.receipt.pdf_hash_algorithm,
      pdf_artifact_hash: packageData.receipt.pdf_artifact_hash,
      pdf_bytes_size: packageData.receipt.pdf_bytes_size,
      pdf_generated_at: packageData.receipt.pdf_generated_at,
      pdf_storage_provider: storedArtifacts.pdfArtifact?.provider ?? null,
      pdf_storage_bucket: storedArtifacts.pdfArtifact?.bucket ?? null,
      pdf_storage_key: storedArtifacts.pdfArtifact?.key ?? null,
      pdf_storage_version_id: storedArtifacts.pdfArtifact?.versionId ?? null,
      pdf_object_lock_mode: storedArtifacts.pdfArtifact?.objectLockMode ?? null,
      pdf_retain_until: storedArtifacts.pdfArtifact?.retainUntil ?? null,
      signing_key_id: packageData.receipt.signing_key_id,
      receipt_signature_algorithm: packageData.receipt.receipt_signature_algorithm,
      receipt_signature: packageData.receipt.receipt_signature,
      receipt_json: packageData.receipt,
      manifest_json: packageData.manifest,
      record_count: packageData.manifest.counts.total_records,
      record_range_start: packageData.manifest.record_start,
      record_range_end: packageData.manifest.record_end,
      included_sections: packageData.manifest.included_sections,
      exported_at: packageData.manifest.export_generated_at,
    })
    .select(COURT_EXPORT_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new HttpError(500, error?.message ?? "Unable to persist the court export record.");
  }

  return data as CourtExportRow;
}

async function loadCourtExport(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
  exportId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("court_exports")
    .select(COURT_EXPORT_SELECT_COLUMNS)
    .eq("id", exportId)
    .eq("family_id", familyId)
    .eq("export_scope", "family_unified")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data) {
    return null;
  }

  return data as CourtExportRow;
}

const getManifestFromRow = (row: CourtExportRow) =>
  (asRecord(row.manifest_json) ?? {}) as Record<string, unknown>;

const getIncludedSectionsFromRow = (row: CourtExportRow) => {
  const fromRow = Array.isArray(row.included_sections)
    ? row.included_sections.filter(
        (section): section is FamilyCourtRecordExportSection =>
          typeof section === "string" &&
          SUPPORTED_FAMILY_EXPORT_SECTIONS.includes(section as FamilyCourtRecordExportSection),
      )
    : [];
  if (fromRow.length > 0) {
    return fromRow;
  }

  const manifest = getManifestFromRow(row);
  const manifestSections = Array.isArray(manifest.included_sections)
    ? manifest.included_sections.filter(
        (section): section is FamilyCourtRecordExportSection =>
          typeof section === "string" &&
          SUPPORTED_FAMILY_EXPORT_SECTIONS.includes(section as FamilyCourtRecordExportSection),
      )
    : [];

  return manifestSections;
};

const getRequestedRangeFromManifest = (row: CourtExportRow) => {
  const manifest = getManifestFromRow(row);
  const start =
    typeof manifest.requested_range_start === "string" ? manifest.requested_range_start : null;
  const end =
    typeof manifest.requested_range_end === "string" ? manifest.requested_range_end : null;

  if (!start || !end) {
    return null;
  }

  return {
    end,
    start,
  };
};

const getReceiptFromRow = (row: CourtExportRow): FamilyCourtRecordExportReceipt => {
  const receipt = asRecord(row.receipt_json);
  if (receipt) {
    return receipt as FamilyCourtRecordExportReceipt;
  }

  const manifest = getManifestFromRow(row);
  const includedSections = getIncludedSectionsFromRow(row);
  const counts = asRecord(manifest.counts);

  return {
    schema_version:
      typeof manifest.schema_version === "string"
        ? manifest.schema_version
        : COURT_RECORD_EXPORT_SCHEMA_VERSION,
    integrity_model_version:
      row.integrity_model_version ?? COURT_RECORD_EXPORT_INTEGRITY_MODEL_VERSION,
    canonicalization_version:
      row.canonicalization_version ?? COURT_RECORD_EXPORT_CANONICALIZATION_VERSION,
    source_type: "family_unified",
    export_scope: "family_unified",
    family_id: row.family_id,
    export_format: row.export_format,
    exported_at: row.exported_at,
    created_by_user_id: row.created_by_user_id,
    created_by_profile_id: row.created_by_profile_id,
    application_build_id:
      typeof manifest.application_build_id === "string" ? manifest.application_build_id : null,
    requested_range_start:
      typeof manifest.requested_range_start === "string"
        ? manifest.requested_range_start
        : row.exported_at,
    requested_range_end:
      typeof manifest.requested_range_end === "string"
        ? manifest.requested_range_end
        : row.exported_at,
    record_start:
      row.record_range_start ??
      (typeof manifest.record_start === "string" ? manifest.record_start : null),
    record_end:
      row.record_range_end ??
      (typeof manifest.record_end === "string" ? manifest.record_end : null),
    included_sections: includedSections,
    counts: {
      call_activity: typeof counts?.call_activity === "number" ? counts.call_activity : 0,
      children: typeof counts?.children === "number" ? counts.children : 0,
      document_access_logs:
        typeof counts?.document_access_logs === "number" ? counts.document_access_logs : 0,
      document_references:
        typeof counts?.document_references === "number" ? counts.document_references : 0,
      exchange_checkins:
        typeof counts?.exchange_checkins === "number" ? counts.exchange_checkins : 0,
      expenses: typeof counts?.expenses === "number" ? counts.expenses : 0,
      messages: typeof counts?.messages === "number" ? counts.messages : 0,
      schedule_overview:
        typeof counts?.schedule_overview === "number" ? counts.schedule_overview : 0,
      schedule_requests:
        typeof counts?.schedule_requests === "number" ? counts.schedule_requests : 0,
      total_records:
        typeof counts?.total_records === "number" ? counts.total_records : row.record_count,
    },
    canonical_hash_algorithm: row.hash_algorithm,
    canonical_content_hash: row.content_hash,
    manifest_hash_algorithm: row.manifest_hash_algorithm ?? COURT_RECORD_EXPORT_HASH_ALGORITHM,
    manifest_hash: row.manifest_hash,
    artifact_hash_algorithm: row.artifact_hash_algorithm ?? COURT_RECORD_EXPORT_HASH_ALGORITHM,
    artifact_hash: row.artifact_hash,
    artifact_type: row.artifact_type ?? COURT_RECORD_EXPORT_ARTIFACT_TYPE,
    artifact_storage_provider:
      row.artifact_storage_provider ??
      (typeof manifest.artifact_storage_provider === "string"
        ? manifest.artifact_storage_provider
        : null),
    artifact_storage_bucket:
      row.artifact_storage_bucket ??
      (typeof manifest.artifact_storage_bucket === "string"
        ? manifest.artifact_storage_bucket
        : null),
    artifact_storage_path:
      row.artifact_storage_key ??
      (typeof manifest.artifact_storage_path === "string"
        ? manifest.artifact_storage_path
        : null),
    pdf_hash_algorithm: row.pdf_hash_algorithm,
    pdf_artifact_hash: row.pdf_artifact_hash,
    pdf_artifact_type: row.pdf_artifact_hash ? COURT_RECORD_EXPORT_PDF_ARTIFACT_TYPE : null,
    pdf_bytes_size: row.pdf_bytes_size,
    pdf_generated_at:
      row.pdf_generated_at ??
      (typeof manifest.pdf_generated_at === "string" ? manifest.pdf_generated_at : null),
    pdf_storage_provider:
      row.pdf_storage_provider ??
      (typeof manifest.pdf_storage_provider === "string" ? manifest.pdf_storage_provider : null),
    pdf_storage_bucket:
      row.pdf_storage_bucket ??
      (typeof manifest.pdf_storage_bucket === "string" ? manifest.pdf_storage_bucket : null),
    pdf_storage_path:
      row.pdf_storage_key ??
      (typeof manifest.pdf_storage_path === "string" ? manifest.pdf_storage_path : null),
    signing_key_id: row.signing_key_id,
    receipt_signature_algorithm: row.receipt_signature_algorithm,
    receipt_signature: row.receipt_signature,
  };
};

const buildStorageLayer = (options: {
  bucket: string | null;
  key: string | null;
  objectLockMode: string | null;
  provider: string | null;
  retainUntil: string | null;
  versionId: string | null;
}): CourtExportStorageLayer => ({
  bucket: options.bucket,
  key: options.key,
  object_lock_mode: options.objectLockMode,
  provider: options.provider,
  retain_until: options.retainUntil,
  version_id: options.versionId,
});

const buildExportSummary = (row: CourtExportRow): FamilyCourtRecordExportSummary => {
  const receipt = getReceiptFromRow(row);
  const manifest = getManifestFromRow(row);
  const counts = asRecord(manifest.counts);
  const includedSections = getIncludedSectionsFromRow(row);

  return {
    artifact_hash: row.artifact_hash,
    artifact_hash_algorithm: row.artifact_hash_algorithm,
    artifact_storage: buildStorageLayer({
      bucket: row.artifact_storage_bucket,
      key: row.artifact_storage_key,
      objectLockMode: row.artifact_object_lock_mode,
      provider: row.artifact_storage_provider,
      retainUntil: row.artifact_retain_until,
      versionId: row.artifact_storage_version_id,
    }),
    canonicalization_version: row.canonicalization_version,
    content_hash: row.content_hash,
    counts:
      counts && Object.keys(counts).length > 0
        ? Object.fromEntries(
            Object.entries(counts).filter(([, value]) => typeof value === "number"),
          )
        : null,
    export_format: row.export_format,
    export_scope: "family_unified",
    exported_at: row.exported_at,
    family_id: row.family_id,
    hash_algorithm: row.hash_algorithm,
    id: row.id,
    included_sections: includedSections,
    integrity_model_version: row.integrity_model_version,
    manifest_hash: row.manifest_hash,
    manifest_hash_algorithm: row.manifest_hash_algorithm,
    pdf_artifact_hash: row.pdf_artifact_hash,
    pdf_bytes_size: row.pdf_bytes_size,
    pdf_generated_at: row.pdf_generated_at,
    pdf_hash_algorithm: row.pdf_hash_algorithm,
    pdf_storage: buildStorageLayer({
      bucket: row.pdf_storage_bucket,
      key: row.pdf_storage_key,
      objectLockMode: row.pdf_object_lock_mode,
      provider: row.pdf_storage_provider,
      retainUntil: row.pdf_retain_until,
      versionId: row.pdf_storage_version_id,
    }),
    record_count: row.record_count,
    record_range_end: row.record_range_end,
    record_range_start: row.record_range_start,
    requested_range_end:
      typeof manifest.requested_range_end === "string" ? manifest.requested_range_end : null,
    requested_range_start:
      typeof manifest.requested_range_start === "string" ? manifest.requested_range_start : null,
    signature_algorithm:
      typeof receipt.receipt_signature_algorithm === "string"
        ? receipt.receipt_signature_algorithm
        : row.receipt_signature_algorithm,
    signature_present: Boolean(
      typeof receipt.receipt_signature === "string"
        ? receipt.receipt_signature
        : row.receipt_signature,
    ),
    signing_key_id:
      typeof receipt.signing_key_id === "string" ? receipt.signing_key_id : row.signing_key_id,
  };
};

const getStoredArtifactLocation = (
  row: CourtExportRow,
  receipt: FamilyCourtRecordExportReceipt,
  artifactKind: "json_evidence_package" | "pdf",
) => {
  if (artifactKind === "pdf") {
    return {
      bucket: row.pdf_storage_bucket ?? receipt.pdf_storage_bucket ?? null,
      key: row.pdf_storage_key ?? receipt.pdf_storage_path ?? null,
      provider: row.pdf_storage_provider ?? receipt.pdf_storage_provider ?? null,
      versionId: row.pdf_storage_version_id ?? null,
    };
  }

  return {
    bucket: row.artifact_storage_bucket ?? receipt.artifact_storage_bucket ?? null,
    key: row.artifact_storage_key ?? receipt.artifact_storage_path ?? null,
    provider: row.artifact_storage_provider ?? receipt.artifact_storage_provider ?? null,
    versionId: row.artifact_storage_version_id ?? null,
  };
};

async function downloadStoredArtifact(
  supabaseAdmin: ReturnType<typeof createClient>,
  options: {
    artifactKind: "json_evidence_package" | "pdf";
    exportRecord: CourtExportRow;
    receipt: FamilyCourtRecordExportReceipt;
  },
) {
  const location = getStoredArtifactLocation(
    options.exportRecord,
    options.receipt,
    options.artifactKind,
  );

  if (!location.bucket || !location.key) {
    throw new HttpError(404, "The stored export artifact location is unavailable.");
  }

  let bytes: Uint8Array;
  let contentType: string;

  if (location.provider === "aws_s3_object_lock") {
    if (!location.versionId) {
      throw new HttpError(404, "The immutable artifact version metadata is unavailable.");
    }

    const download = await downloadImmutableCourtExportObject({
      bucket: location.bucket,
      key: location.key,
      versionId: location.versionId,
    });
    bytes = download.bytes;
    contentType = download.contentType;
  } else {
    const { data, error } = await supabaseAdmin.storage
      .from(location.bucket)
      .download(location.key);

    if (error) {
      throw new HttpError(
        error.message.toLowerCase().includes("not found") ? 404 : 500,
        error.message,
      );
    }

    bytes = new Uint8Array(await data.arrayBuffer());
    contentType =
      options.artifactKind === "pdf"
        ? "application/pdf"
        : "application/json; charset=utf-8";
  }

  return {
    base64: encodeBase64(bytes),
    bytes,
    bytesSize: bytes.byteLength,
    contentType,
    fileName: location.key.split("/").pop() ?? `${options.exportRecord.id}.bin`,
    hash:
      options.artifactKind === "pdf"
        ? options.receipt.pdf_artifact_hash
        : options.receipt.artifact_hash,
    hashAlgorithm:
      options.artifactKind === "pdf"
        ? options.receipt.pdf_hash_algorithm
        : options.receipt.artifact_hash_algorithm,
  };
}

const buildVerificationLayer = (options: {
  algorithm: string | null;
  computed: string | null;
  label: string;
  note?: string | null;
  stored: string | null;
}): VerificationLayer => {
  if (!options.stored || !options.algorithm) {
    return {
      algorithm: options.algorithm,
      computed: options.computed,
      label: options.label,
      matches: null,
      note: options.note ?? "No stored value is available for this verification layer.",
      status: "not_supported",
      stored: options.stored,
    };
  }

  if (options.computed === null) {
    return {
      algorithm: options.algorithm,
      computed: null,
      label: options.label,
      matches: null,
      note: options.note ?? "The comparison input was not available.",
      status: "unavailable",
      stored: options.stored,
    };
  }

  const matches = options.computed === options.stored;
  return {
    algorithm: options.algorithm,
    computed: options.computed,
    label: options.label,
    matches,
    note: options.note ?? null,
    status: matches ? "match" : "mismatch",
    stored: options.stored,
  };
};

const verifyReceiptSignatureLayer = async (options: {
  contextLabel: string;
  receipt: FamilyCourtRecordExportReceipt;
}): Promise<SignatureVerificationLayer> => {
  const algorithm =
    typeof options.receipt.receipt_signature_algorithm === "string"
      ? options.receipt.receipt_signature_algorithm
      : null;
  const signature =
    typeof options.receipt.receipt_signature === "string"
      ? options.receipt.receipt_signature
      : null;
  const signingKeyId =
    typeof options.receipt.signing_key_id === "string"
      ? options.receipt.signing_key_id
      : null;

  if (!signature || !algorithm) {
    return {
      algorithm,
      note: `This ${options.contextLabel} does not include a server signature.`,
      present: false,
      status: "not_supported",
      valid: null,
    };
  }

  if (algorithm !== COURT_RECORD_EXPORT_SIGNATURE_ALGORITHM) {
    return {
      algorithm,
      note: `The ${options.contextLabel} uses an unsupported signature algorithm.`,
      present: true,
      status: "not_supported",
      valid: null,
    };
  }

  const verificationPublicKey = getReceiptVerificationPublicKey(signingKeyId);
  if (!verificationPublicKey) {
    return {
      algorithm,
      note: signingKeyId
        ? `The verification key for signing key ${signingKeyId} is not configured in this environment.`
        : "The server verification key is not configured in this environment.",
      present: true,
      status: "not_supported",
      valid: null,
    };
  }

  const valid = await verifyFamilyCourtRecordExportReceiptSignature(
    getFamilyCourtRecordReceiptPayloadJson(options.receipt),
    verificationPublicKey,
    signature,
  );

  return {
    algorithm,
    note: valid
      ? `The ${options.contextLabel} server signature is valid.`
      : `The ${options.contextLabel} server signature did not validate.`,
    present: true,
    status: valid ? "match" : "mismatch",
    valid,
  };
};

const buildVerificationResponse = (options: {
  artifactLayer: VerificationLayer;
  contentLayer: VerificationLayer;
  exportRecord: CourtExportRow;
  manifestLayer: VerificationLayer;
  pdfLayer: VerificationLayer;
  signatureLayer: SignatureVerificationLayer;
  verificationMode: VerificationMode;
}) => {
  let status: VerificationStatus = "match";

  if (options.verificationMode === "stored_signature") {
    if (options.signatureLayer.status === "mismatch") {
      status = "signature_invalid";
    } else if (options.manifestLayer.status === "mismatch") {
      status = "mismatch";
    } else if (
      options.signatureLayer.status === "not_supported" &&
      options.manifestLayer.status === "not_supported"
    ) {
      status = "verification_not_supported";
    }
  } else if (
    options.verificationMode === "stored_pdf_artifact" ||
    options.verificationMode === "provided_pdf_artifact"
  ) {
    if (options.signatureLayer.status === "mismatch") {
      status = "signature_invalid";
    } else if (options.signatureLayer.status === "not_supported") {
      status = "verification_not_supported";
    } else if (options.pdfLayer.status === "mismatch") {
      status = "mismatch";
    } else if (options.pdfLayer.status === "unavailable") {
      status = "pdf_hash_unavailable";
    } else if (options.pdfLayer.status === "not_supported") {
      status = "verification_not_supported";
    }
  } else if (options.signatureLayer.status === "mismatch") {
    status = "signature_invalid";
  } else if (options.signatureLayer.status === "not_supported") {
    status = "verification_not_supported";
  } else if (
    options.contentLayer.status === "mismatch" ||
    options.manifestLayer.status === "mismatch" ||
    options.artifactLayer.status === "mismatch"
  ) {
    status = "mismatch";
  } else if (options.artifactLayer.status === "unavailable") {
    status = "artifact_hash_unavailable";
  } else if (
    options.contentLayer.status === "not_supported" ||
    options.manifestLayer.status === "not_supported" ||
    options.artifactLayer.status === "not_supported"
  ) {
    status = "verification_not_supported";
  }

  return {
    success: true,
    status,
    computed_hash:
      options.verificationMode === "stored_pdf_artifact" ||
      options.verificationMode === "provided_pdf_artifact"
        ? options.pdfLayer.computed
        : options.contentLayer.computed,
    stored_hash:
      options.verificationMode === "stored_pdf_artifact" ||
      options.verificationMode === "provided_pdf_artifact"
        ? options.pdfLayer.stored
        : options.contentLayer.stored,
    export: buildExportSummary(options.exportRecord),
    verification_mode: options.verificationMode,
    verification_layers: {
      artifact_hash: options.artifactLayer,
      canonical_content_hash: options.contentLayer,
      manifest_hash: options.manifestLayer,
      pdf_artifact_hash: options.pdfLayer,
      receipt_signature: options.signatureLayer,
    },
  };
};

async function logAudit(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    action: string;
    actorProfileId: string;
    actorUserId: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabaseAdmin.rpc("log_audit_event_system", {
    _action: params.action,
    _actor_profile_id: params.actorProfileId,
    _actor_user_id: params.actorUserId,
    _entity_id: params.entityId,
    _entity_type: "court_export",
    _metadata: params.metadata ?? {},
  });
}

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, {
      success: false,
      error: "Method not allowed",
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  let requestAction: string | undefined;

  try {
    const { profile, user } = await requireAuthenticatedProfile(req, supabaseAdmin);
    const body = (await req.json()) as ExportRequest;
    requestAction = body.action;

    const familyId = requireFamilyId(body.family_id);
    const membership = await getActiveMembershipForUser(supabaseAdmin, familyId, user.id);
    requireFamilyCourtRecordExportRole(membership);
    await requireCourtExportPowerAccess(supabaseAdmin, profile);

    logStep("request", {
      action: body.action,
      exportId: "export_id" in body ? body.export_id ?? null : null,
      familyId,
      profileId: profile.id,
      userId: user.id,
    });

    if (body.action === "create") {
      if ((body.export_scope ?? "family_unified") !== "family_unified") {
        throw new HttpError(400, "court-record-export only supports export_scope=family_unified.");
      }

      const range = requireDateRange(body.date_range);
      const includedSections = requireIncludedSections(body.include_sections);
      const exportFormat = body.export_format ?? "pdf";
      const exportArtifacts = await createExportPackage(supabaseAdmin, {
        exportFormat,
        exportedByProfileId: profile.id,
        exportedByUserId: user.id,
        familyId,
        includedSections,
        range,
        signReceipt: true,
      });
      const storedArtifacts = await storeExportArtifacts(exportArtifacts);
      const exportRecord = await persistCourtExport(
        supabaseAdmin,
        exportArtifacts,
        storedArtifacts,
      );

      await logAudit(supabaseAdmin, {
        action: "COURT_EXPORT_CREATED",
        actorProfileId: profile.id,
        actorUserId: user.id,
        entityId: exportRecord.id,
        metadata: {
          artifact_hash: exportArtifacts.packageData.receipt.artifact_hash,
          artifact_storage_key: storedArtifacts.evidencePackage.key,
          family_id: familyId,
          included_sections: includedSections,
          pdf_artifact_hash: exportArtifacts.packageData.receipt.pdf_artifact_hash,
          pdf_storage_key: storedArtifacts.pdfArtifact?.key ?? null,
          signing_key_id: exportArtifacts.packageData.receipt.signing_key_id,
          verification_scope: "family_unified",
        },
      });

      return jsonResponse(req, 200, {
        success: true,
        export: buildExportSummary(exportRecord),
        canonical_payload: exportArtifacts.packageData.canonicalPayload,
        canonical_payload_json: exportArtifacts.packageData.canonicalPayloadJson,
        artifact_payload_json: exportArtifacts.packageData.artifactPayloadJson,
        manifest: exportArtifacts.packageData.manifest,
        manifest_json: exportArtifacts.packageData.manifestJson,
        receipt: exportArtifacts.packageData.receipt,
        evidence_package: exportArtifacts.packageData.evidencePackage,
        evidence_package_json: exportArtifacts.packageData.evidencePackageJson,
        pdf_artifact: exportArtifacts.pdfArtifact
          ? {
              base64: exportArtifacts.pdfArtifact.base64,
              bytes_size: exportArtifacts.pdfArtifact.bytesSize,
              content_type: exportArtifacts.pdfArtifact.contentType,
              file_name: exportArtifacts.pdfArtifact.fileName,
              generated_at: exportArtifacts.pdfArtifact.generatedAt,
              hash: exportArtifacts.pdfArtifact.hash,
              hash_algorithm: exportArtifacts.pdfArtifact.hashAlgorithm,
            }
          : null,
      });
    }

    if (body.action === "list") {
      if ((body.export_scope ?? "family_unified") !== "family_unified") {
        throw new HttpError(400, "court-record-export only supports export_scope=family_unified.");
      }

      const limit = Math.min(Math.max(body.limit ?? 10, 1), 20);
      const { data, error } = await supabaseAdmin
        .from("court_exports")
        .select(COURT_EXPORT_SELECT_COLUMNS)
        .eq("family_id", familyId)
        .eq("export_scope", "family_unified")
        .order("exported_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw new HttpError(500, error.message);
      }

      return jsonResponse(req, 200, {
        success: true,
        exports: ((data as CourtExportRow[] | null) ?? []).map(buildExportSummary),
      });
    }

    if (body.action === "download") {
      const exportId = requireExportId(body.export_id);
      const artifactKind = body.artifact_kind ?? "pdf";
      const exportRecord = await loadCourtExport(supabaseAdmin, familyId, exportId);

      if (!exportRecord) {
        return jsonResponse(req, 404, {
          success: false,
          status: "receipt_not_found",
          error: "The selected export receipt could not be found.",
        });
      }

      const receipt = getReceiptFromRow(exportRecord);

      try {
        const artifact = await downloadStoredArtifact(supabaseAdmin, {
          artifactKind,
          exportRecord,
          receipt,
        });

        return jsonResponse(req, 200, {
          success: true,
          artifact: {
            base64: artifact.base64,
            bytes_size: artifact.bytesSize,
            content_type: artifact.contentType,
            file_name: artifact.fileName,
            hash: artifact.hash,
            hash_algorithm: artifact.hashAlgorithm,
            kind: artifactKind,
          },
          export: buildExportSummary(exportRecord),
        });
      } catch (artifactError) {
        if (artifactError instanceof HttpError && artifactError.status === 404) {
          return jsonResponse(req, 404, {
            success: false,
            status: "artifact_not_found",
            error: "The stored export artifact could not be found.",
          });
        }

        throw artifactError;
      }
    }

    if (body.action === "verify") {
      const exportId = requireExportId(body.export_id);
      const verificationMode = body.verification_mode ?? "stored_source";
      const exportRecord = await loadCourtExport(supabaseAdmin, familyId, exportId);

      if (!exportRecord) {
        return jsonResponse(req, 404, {
          success: false,
          status: "receipt_not_found",
          error: "The selected export receipt could not be found.",
        });
      }

      const receipt = getReceiptFromRow(exportRecord);
      const storedManifest = getManifestFromRow(exportRecord);
      const storedManifestJson =
        getFamilyCourtRecordManifestJson(storedManifest) ??
        stableStringifyForIntegrity(storedManifest);
      const storedReceiptSignatureLayer = await verifyReceiptSignatureLayer({
        contextLabel: "stored export receipt",
        receipt,
      });
      const unsupportedPdfLayer = buildVerificationLayer({
        algorithm: receipt.pdf_hash_algorithm ?? exportRecord.pdf_hash_algorithm,
        computed: null,
        label: "PDF artifact hash",
        note: "This verification mode does not recalculate the stored PDF artifact hash.",
        stored: receipt.pdf_artifact_hash ?? exportRecord.pdf_artifact_hash,
      });

      if (verificationMode === "stored_signature") {
        const manifestLayer = buildVerificationLayer({
          algorithm: receipt.manifest_hash_algorithm ?? exportRecord.manifest_hash_algorithm,
          computed: await sha256Hex(storedManifestJson),
          label: "Manifest hash",
          stored: receipt.manifest_hash ?? exportRecord.manifest_hash,
        });

        const responseBody = buildVerificationResponse({
          artifactLayer: buildVerificationLayer({
            algorithm: receipt.artifact_hash_algorithm ?? exportRecord.artifact_hash_algorithm,
            computed: null,
            label: "JSON evidence package hash",
            note: "Receipt-signature verification does not recalculate the JSON evidence package hash.",
            stored: receipt.artifact_hash ?? exportRecord.artifact_hash,
          }),
          contentLayer: buildVerificationLayer({
            algorithm: receipt.canonical_hash_algorithm ?? exportRecord.hash_algorithm,
            computed: null,
            label: "Canonical content hash",
            note: "Receipt-signature verification does not recalculate source content.",
            stored: receipt.canonical_content_hash ?? exportRecord.content_hash,
          }),
          exportRecord,
          manifestLayer,
          pdfLayer: unsupportedPdfLayer,
          signatureLayer: storedReceiptSignatureLayer,
          verificationMode,
        });

        await logAudit(supabaseAdmin, {
          action:
            responseBody.status === "match"
              ? "COURT_EXPORT_VERIFIED"
              : responseBody.status === "signature_invalid"
                ? "COURT_EXPORT_VERIFY_SIGNATURE_INVALID"
                : "COURT_EXPORT_VERIFY_UNSUPPORTED",
          actorProfileId: profile.id,
          actorUserId: user.id,
          entityId: exportRecord.id,
          metadata: {
            family_id: familyId,
            signature_status: storedReceiptSignatureLayer.status,
            status: responseBody.status,
            verification_mode: verificationMode,
          },
        });

        return jsonResponse(req, 200, responseBody);
      }

      if (verificationMode === "stored_source") {
        const requestedRange = getRequestedRangeFromManifest(exportRecord);
        if (!requestedRange) {
          throw new HttpError(500, "The stored export manifest is missing requested range metadata.");
        }

        const includedSections = getIncludedSectionsFromRow(exportRecord);
        const rebuilt = await createExportPackage(supabaseAdmin, {
          exportFormat: exportRecord.export_format,
          exportId: exportRecord.id,
          exportedAt: exportRecord.exported_at,
          exportedByProfileId: exportRecord.created_by_profile_id,
          exportedByUserId: exportRecord.created_by_user_id,
          familyId,
          includedSections,
          range: requestedRange,
          signReceipt: false,
        });

        const contentLayer = buildVerificationLayer({
          algorithm: receipt.canonical_hash_algorithm ?? exportRecord.hash_algorithm,
          computed: rebuilt.packageData.contentHash,
          label: "Canonical content hash",
          stored: receipt.canonical_content_hash ?? exportRecord.content_hash,
        });
        const manifestLayer = buildVerificationLayer({
          algorithm: receipt.manifest_hash_algorithm ?? exportRecord.manifest_hash_algorithm,
          computed: rebuilt.packageData.manifestHash,
          label: "Manifest hash",
          stored: receipt.manifest_hash ?? exportRecord.manifest_hash,
        });
        const artifactLayer = buildVerificationLayer({
          algorithm: receipt.artifact_hash_algorithm ?? exportRecord.artifact_hash_algorithm,
          computed: rebuilt.packageData.artifactHash,
          label: "JSON evidence package hash",
          stored: receipt.artifact_hash ?? exportRecord.artifact_hash,
        });
        const pdfLayer = buildVerificationLayer({
          algorithm: receipt.pdf_hash_algorithm ?? exportRecord.pdf_hash_algorithm,
          computed:
            rebuilt.packageData.receipt.pdf_artifact_hash ??
            rebuilt.pdfArtifact?.hash ??
            null,
          label: "PDF artifact hash",
          note: rebuilt.packageData.receipt.pdf_artifact_hash
            ? null
            : "This export was generated without a stored PDF artifact hash.",
          stored: receipt.pdf_artifact_hash ?? exportRecord.pdf_artifact_hash,
        });

        const responseBody = buildVerificationResponse({
          artifactLayer,
          contentLayer,
          exportRecord,
          manifestLayer,
          pdfLayer,
          signatureLayer: storedReceiptSignatureLayer,
          verificationMode,
        });

        await logAudit(supabaseAdmin, {
          action:
            responseBody.status === "match"
              ? "COURT_EXPORT_VERIFIED"
              : responseBody.status === "signature_invalid"
                ? "COURT_EXPORT_VERIFY_SIGNATURE_INVALID"
                : responseBody.status === "verification_not_supported"
                  ? "COURT_EXPORT_VERIFY_UNSUPPORTED"
                  : "COURT_EXPORT_VERIFY_MISMATCH",
          actorProfileId: profile.id,
          actorUserId: user.id,
          entityId: exportRecord.id,
          metadata: {
            artifact_hash_status: artifactLayer.status,
            family_id: familyId,
            manifest_hash_status: manifestLayer.status,
            pdf_hash_status: pdfLayer.status,
            signature_status: storedReceiptSignatureLayer.status,
            status: responseBody.status,
            verification_mode: verificationMode,
          },
        });

        return jsonResponse(req, 200, responseBody);
      }

      if (verificationMode === "provided_package_json") {
        if (!body.provided_package_json) {
          throw new HttpError(400, "provided_package_json is required for uploaded package verification.");
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(body.provided_package_json);
        } catch {
          throw new HttpError(400, "The provided evidence package file is not valid JSON.");
        }

        const parsedPackage = parseFamilyCourtRecordEvidencePackage(parsed);
        const canonicalPayloadJson = getFamilyCourtRecordPayloadJson(parsed);
        if (!canonicalPayloadJson || !parsedPackage?.canonicalPayload) {
          throw new HttpError(400, "The provided evidence package does not contain a canonical payload.");
        }

        const manifestJson = getFamilyCourtRecordManifestJson(parsed);
        const artifactPayloadJson = getFamilyCourtRecordArtifactPayloadJson(parsed);
        const providedReceipt = parsedPackage.receipt;
        const providedReceiptSignatureLayer = providedReceipt
          ? await verifyReceiptSignatureLayer({
              contextLabel: "uploaded export receipt",
              receipt: providedReceipt,
            })
          : {
              algorithm: null,
              note: "The uploaded evidence package does not include an export receipt signature.",
              present: false,
              status: "not_supported" as const,
              valid: null,
            };

        const contentLayer = buildVerificationLayer({
          algorithm: receipt.canonical_hash_algorithm ?? exportRecord.hash_algorithm,
          computed: await sha256Hex(canonicalPayloadJson),
          label: "Canonical content hash",
          stored: receipt.canonical_content_hash ?? exportRecord.content_hash,
        });
        const manifestLayer = buildVerificationLayer({
          algorithm: receipt.manifest_hash_algorithm ?? exportRecord.manifest_hash_algorithm,
          computed: manifestJson ? await sha256Hex(manifestJson) : null,
          label: "Manifest hash",
          note: manifestJson
            ? null
            : "The uploaded evidence package does not include the manifest string required for manifest-hash verification.",
          stored: receipt.manifest_hash ?? exportRecord.manifest_hash,
        });
        const artifactLayer = buildVerificationLayer({
          algorithm: receipt.artifact_hash_algorithm ?? exportRecord.artifact_hash_algorithm,
          computed: artifactPayloadJson ? await sha256Hex(artifactPayloadJson) : null,
          label: "JSON evidence package hash",
          note: artifactPayloadJson
            ? null
            : "The uploaded evidence package does not include the deterministic JSON artifact payload required for artifact-hash verification.",
          stored: receipt.artifact_hash ?? exportRecord.artifact_hash,
        });

        const responseBody = buildVerificationResponse({
          artifactLayer,
          contentLayer,
          exportRecord,
          manifestLayer,
          pdfLayer: unsupportedPdfLayer,
          signatureLayer: providedReceiptSignatureLayer,
          verificationMode,
        });

        await logAudit(supabaseAdmin, {
          action:
            responseBody.status === "match"
              ? "COURT_EXPORT_VERIFIED"
              : responseBody.status === "signature_invalid"
                ? "COURT_EXPORT_VERIFY_SIGNATURE_INVALID"
                : responseBody.status === "verification_not_supported"
                  ? "COURT_EXPORT_VERIFY_UNSUPPORTED"
                  : "COURT_EXPORT_VERIFY_MISMATCH",
          actorProfileId: profile.id,
          actorUserId: user.id,
          entityId: exportRecord.id,
          metadata: {
            artifact_hash_status: artifactLayer.status,
            family_id: familyId,
            manifest_hash_status: manifestLayer.status,
            signature_status: providedReceiptSignatureLayer.status,
            status: responseBody.status,
            verification_mode: verificationMode,
          },
        });

        return jsonResponse(req, 200, responseBody);
      }

      if (verificationMode === "stored_pdf_artifact") {
        try {
          const artifact = await downloadStoredArtifact(supabaseAdmin, {
            artifactKind: "pdf",
            exportRecord,
            receipt,
          });
          const pdfLayer = buildVerificationLayer({
            algorithm: receipt.pdf_hash_algorithm ?? exportRecord.pdf_hash_algorithm,
            computed: await sha256HexFromBytes(artifact.bytes),
            label: "PDF artifact hash",
            stored: receipt.pdf_artifact_hash ?? exportRecord.pdf_artifact_hash,
          });

          const responseBody = buildVerificationResponse({
            artifactLayer: buildVerificationLayer({
              algorithm: receipt.artifact_hash_algorithm ?? exportRecord.artifact_hash_algorithm,
              computed: null,
              label: "JSON evidence package hash",
              note: "PDF verification does not recalculate the JSON evidence package hash.",
              stored: receipt.artifact_hash ?? exportRecord.artifact_hash,
            }),
            contentLayer: buildVerificationLayer({
              algorithm: receipt.canonical_hash_algorithm ?? exportRecord.hash_algorithm,
              computed: null,
              label: "Canonical content hash",
              note: "PDF verification does not recalculate source content.",
              stored: receipt.canonical_content_hash ?? exportRecord.content_hash,
            }),
            exportRecord,
            manifestLayer: buildVerificationLayer({
              algorithm: receipt.manifest_hash_algorithm ?? exportRecord.manifest_hash_algorithm,
              computed: null,
              label: "Manifest hash",
              note: "PDF verification does not recalculate the manifest hash.",
              stored: receipt.manifest_hash ?? exportRecord.manifest_hash,
            }),
            pdfLayer,
            signatureLayer: storedReceiptSignatureLayer,
            verificationMode,
          });

          await logAudit(supabaseAdmin, {
            action:
              responseBody.status === "match"
                ? "COURT_EXPORT_VERIFIED"
                : responseBody.status === "signature_invalid"
                  ? "COURT_EXPORT_VERIFY_SIGNATURE_INVALID"
                  : responseBody.status === "verification_not_supported"
                    ? "COURT_EXPORT_VERIFY_UNSUPPORTED"
                    : "COURT_EXPORT_VERIFY_MISMATCH",
            actorProfileId: profile.id,
            actorUserId: user.id,
            entityId: exportRecord.id,
            metadata: {
              family_id: familyId,
              pdf_hash_status: pdfLayer.status,
              signature_status: storedReceiptSignatureLayer.status,
              status: responseBody.status,
              verification_mode: verificationMode,
            },
          });

          return jsonResponse(req, 200, responseBody);
        } catch (artifactError) {
          if (artifactError instanceof HttpError && artifactError.status === 404) {
            return jsonResponse(req, 404, {
              success: false,
              status: "artifact_not_found",
              error: "The stored PDF artifact could not be found.",
            });
          }

          throw artifactError;
        }
      }

      if (verificationMode === "provided_pdf_artifact") {
        if (!body.provided_pdf_base64) {
          throw new HttpError(400, "provided_pdf_base64 is required for uploaded PDF verification.");
        }

        const providedPdfBytes = decodeBase64ToBytes(body.provided_pdf_base64);
        const pdfLayer = buildVerificationLayer({
          algorithm: receipt.pdf_hash_algorithm ?? exportRecord.pdf_hash_algorithm,
          computed: await sha256HexFromBytes(providedPdfBytes),
          label: "PDF artifact hash",
          stored: receipt.pdf_artifact_hash ?? exportRecord.pdf_artifact_hash,
        });

        const responseBody = buildVerificationResponse({
          artifactLayer: buildVerificationLayer({
            algorithm: receipt.artifact_hash_algorithm ?? exportRecord.artifact_hash_algorithm,
            computed: null,
            label: "JSON evidence package hash",
            note: "PDF verification does not recalculate the JSON evidence package hash.",
            stored: receipt.artifact_hash ?? exportRecord.artifact_hash,
          }),
          contentLayer: buildVerificationLayer({
            algorithm: receipt.canonical_hash_algorithm ?? exportRecord.hash_algorithm,
            computed: null,
            label: "Canonical content hash",
            note: "PDF verification does not recalculate source content.",
            stored: receipt.canonical_content_hash ?? exportRecord.content_hash,
          }),
          exportRecord,
          manifestLayer: buildVerificationLayer({
            algorithm: receipt.manifest_hash_algorithm ?? exportRecord.manifest_hash_algorithm,
            computed: null,
            label: "Manifest hash",
            note: "PDF verification does not recalculate the manifest hash.",
            stored: receipt.manifest_hash ?? exportRecord.manifest_hash,
          }),
          pdfLayer,
          signatureLayer: storedReceiptSignatureLayer,
          verificationMode,
        });

        await logAudit(supabaseAdmin, {
          action:
            responseBody.status === "match"
              ? "COURT_EXPORT_VERIFIED"
              : responseBody.status === "signature_invalid"
                ? "COURT_EXPORT_VERIFY_SIGNATURE_INVALID"
                : responseBody.status === "verification_not_supported"
                  ? "COURT_EXPORT_VERIFY_UNSUPPORTED"
                  : "COURT_EXPORT_VERIFY_MISMATCH",
          actorProfileId: profile.id,
          actorUserId: user.id,
          entityId: exportRecord.id,
          metadata: {
            family_id: familyId,
            pdf_hash_status: pdfLayer.status,
            signature_status: storedReceiptSignatureLayer.status,
            status: responseBody.status,
            verification_mode: verificationMode,
          },
        });

        return jsonResponse(req, 200, responseBody);
      }

      throw new HttpError(400, `Unsupported verification_mode: ${verificationMode}`);
    }

    throw new HttpError(400, `Unsupported action: ${body.action}`);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected export error";

    logStep("error", {
      action: requestAction ?? "unknown",
      message,
      status,
    });

    return jsonResponse(req, status, {
      success: false,
      error: message,
    });
  }
});
