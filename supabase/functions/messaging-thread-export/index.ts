import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import {
  buildMessagingThreadExportPackage,
  getMessagingThreadExportReceiptPayloadJson,
  getMessagingThreadExportArtifactPayloadJson,
  getMessagingThreadExportManifestJson,
  getMessagingThreadExportPayloadJson,
  MESSAGING_THREAD_EXPORT_ARTIFACT_TYPE,
  MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
  MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
  MESSAGING_THREAD_EXPORT_INTEGRITY_MODEL_VERSION,
  MESSAGING_THREAD_EXPORT_LEGACY_SIGNATURE_ALGORITHM,
  MESSAGING_THREAD_EXPORT_PDF_ARTIFACT_TYPE,
  MESSAGING_THREAD_EXPORT_SCHEMA_VERSION,
  MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM,
  parseMessagingThreadEvidencePackage,
  sha256Hex,
  sha256HexFromBytes,
  signMessagingThreadExportReceiptPayload,
  stableStringifyForIntegrity,
  type MessagingThreadTimelineSourceItem,
  type MessagingThreadExportReceipt,
  verifyLegacyMessagingThreadExportReceiptSignature,
  verifyMessagingThreadExportReceiptSignature,
} from "../_shared/messagingThreadExportIntegrity.ts";
import { generateMessagingThreadExportPdf } from "../_shared/messagingThreadExportPdf.ts";
import {
  downloadImmutableCourtExportObject,
  getCourtExportObjectLockBucketName,
  uploadImmutableCourtExportObject,
} from "../_shared/courtExportS3.ts";
import {
  requireCourtExportPowerAccess,
} from "../_shared/courtExportAccess.ts";
import {
  getActiveMembershipForUser,
  HttpError,
  requireAuthenticatedProfile,
} from "../_shared/callHelpers.ts";

const LOG_PREFIX = "MESSAGING-THREAD-EXPORT";

type MessageThreadRow = {
  created_at: string;
  family_id: string | null;
  id: string;
  name: string | null;
  participant_a_id: string | null;
  participant_b_id: string | null;
  thread_type: "family_channel" | "direct_message" | "group_chat";
};

type ThreadMessageRow = {
  content: string;
  created_at: string;
  id: string;
  sender_id: string;
  sender_role: string;
  thread_id: string;
};

type ProfileRow = {
  email: string | null;
  full_name: string | null;
  id: string;
};

type CallSessionRow = {
  answered_at: string | null;
  call_type: "audio" | "video";
  callee_display_name: string | null;
  callee_profile_id: string;
  created_at: string;
  family_id: string;
  id: string;
  initiator_display_name: string | null;
  initiator_profile_id: string;
  status: "accepted" | "cancelled" | "declined" | "ended" | "failed" | "missed" | "ringing";
  thread_id: string | null;
};

type CallEventRow = {
  actor_display_name: string | null;
  actor_profile_id: string | null;
  call_session_id: string;
  created_at: string;
  event_type: "accepted" | "created" | "declined" | "missed" | "ringing";
  id: string;
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
  created_by_user_id: string | null;
  created_by_profile_id: string;
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
  pdf_hash_algorithm: string | null;
  pdf_bytes_size: number | null;
  pdf_generated_at: string | null;
  pdf_object_lock_mode: string | null;
  pdf_retain_until: string | null;
  pdf_storage_bucket: string | null;
  pdf_storage_key: string | null;
  pdf_storage_provider: string | null;
  pdf_storage_version_id: string | null;
  record_count: number;
  record_range_end: string | null;
  record_range_start: string | null;
  receipt_json: Record<string, unknown> | null;
  signing_key_id: string | null;
  receipt_signature: string | null;
  receipt_signature_algorithm: string | null;
  source_id: string | null;
  source_type: "message_thread";
  thread_id: string | null;
  thread_type: "family_channel" | "direct_message" | "group_chat" | null;
};

type VerificationMode =
  | "provided_pdf_artifact"
  | "provided_package_json"
  // Deprecated backward-compat alias. This now maps to full evidence-package JSON
  // verification and does not represent a manifest-only verification mode.
  | "provided_manifest_json"
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
      export_format?: "json_manifest" | "pdf";
      family_id?: string;
      thread_id?: string;
    }
  | {
      action: "list";
      family_id?: string;
      limit?: number;
      thread_id?: string;
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
      provided_pdf_base64?: string;
      provided_package_json?: string;
      // Deprecated backward-compat alias for `provided_package_json`.
      provided_manifest_json?: string;
      verification_mode?: VerificationMode;
    };

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

const normalizeDisplayName = (
  profile: { email?: string | null; full_name?: string | null } | null | undefined,
  fallback = "Family member",
) => {
  const fullName = profile?.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const emailName = profile?.email?.split("@")[0]?.trim();
  if (emailName) {
    return emailName;
  }

  return fallback;
};

const requireFamilyId = (familyId: string | undefined) => {
  if (!familyId) {
    throw new HttpError(400, "family_id is required.");
  }

  return familyId;
};

const requireThreadId = (threadId: string | undefined) => {
  if (!threadId) {
    throw new HttpError(400, "thread_id is required.");
  }

  return threadId;
};

const requireExportId = (exportId: string | undefined) => {
  if (!exportId) {
    throw new HttpError(400, "export_id is required.");
  }

  return exportId;
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

const getLegacyReceiptSigningSecret = () => {
  const secret = Deno.env.get("MESSAGING_THREAD_EXPORT_SIGNING_KEY")?.trim();
  return secret ? secret : null;
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

const LEGACY_COURT_EXPORT_ARTIFACT_BUCKET = "court-export-artifacts";

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

const sanitizeArtifactFileSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "record";

const buildArtifactPaths = (options: {
  exportId: string;
  exportedAt: string;
  familyId: string;
  threadDisplayName: string;
  threadId: string;
}) => {
  const bucket = getCourtExportObjectLockBucketName();
  const safeThreadName = sanitizeArtifactFileSegment(options.threadDisplayName);
  const pdfFileName = `${safeThreadName}-${options.exportId}.pdf`;
  const packageFileName = `${safeThreadName}-${options.exportId}-evidence-package.json`;
  const timestampSegment = options.exportedAt
    .replace(/[:.]/g, "-")
    .replace(/\+/g, "plus");
  const basePath = `families/${options.familyId}/court-exports/${options.exportId}/${timestampSegment}`;

  return {
    evidencePackage: {
      bucket,
      contentType: "application/json; charset=utf-8",
      fileName: packageFileName,
      path: `${basePath}/${packageFileName}`,
    },
    pdf: {
      bucket,
      contentType: "application/pdf",
      fileName: pdfFileName,
      path: `${basePath}/${pdfFileName}`,
    },
  };
};

async function loadThread(
  supabaseAdmin: ReturnType<typeof createClient>,
  familyId: string,
  threadId: string,
): Promise<MessageThreadRow> {
  const { data, error } = await supabaseAdmin
    .from("message_threads")
    .select("id, family_id, thread_type, participant_a_id, participant_b_id, name, created_at")
    .eq("id", threadId)
    .eq("family_id", familyId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data) {
    throw new HttpError(404, "The selected thread was not found in the requested family.");
  }

  return data as MessageThreadRow;
}

async function assertThreadAccess(
  supabaseAdmin: ReturnType<typeof createClient>,
  profileId: string,
  thread: MessageThreadRow,
) {
  if (thread.thread_type === "family_channel") {
    return;
  }

  if (thread.thread_type === "direct_message") {
    if (
      profileId === thread.participant_a_id ||
      profileId === thread.participant_b_id
    ) {
      return;
    }

    throw new HttpError(403, "You are not authorized to access that direct thread.");
  }

  const { data, error } = await supabaseAdmin
    .from("group_chat_participants")
    .select("thread_id")
    .eq("thread_id", thread.id)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data) {
    throw new HttpError(403, "You are not authorized to access that group thread.");
  }
}

async function resolveThreadDisplayName(
  supabaseAdmin: ReturnType<typeof createClient>,
  exporterProfileId: string,
  thread: MessageThreadRow,
) {
  if (thread.thread_type === "family_channel") {
    return "Family Channel";
  }

  if (thread.thread_type === "group_chat") {
    return thread.name || "Group Chat";
  }

  const otherParticipantId =
    thread.participant_a_id === exporterProfileId
      ? thread.participant_b_id
      : thread.participant_a_id;

  if (!otherParticipantId) {
    return "Direct Message";
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", otherParticipantId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  return normalizeDisplayName(data as ProfileRow | null, "Direct Message");
}

async function loadTimelineItems(
  supabaseAdmin: ReturnType<typeof createClient>,
  thread: MessageThreadRow,
): Promise<MessagingThreadTimelineSourceItem[]> {
  const conversationStartedEvent: MessagingThreadTimelineSourceItem = {
    id: `conversation-started-${thread.id}`,
    kind: "system",
    timestamp: thread.created_at,
    event: {
      actorId: null,
      actorName: null,
      eventType: "conversation_started",
      id: `conversation-started-${thread.id}`,
      note:
        thread.thread_type === "family_channel"
          ? "This family record is active and ready for documented communication."
          : thread.thread_type === "group_chat"
            ? "This group conversation is active and ready for documented communication."
            : "This direct conversation is active and ready for documented communication.",
      timestamp: thread.created_at,
    },
  };

  const { data: messageRows, error: messagesError } = await supabaseAdmin
    .from("thread_messages")
    .select("id, thread_id, sender_id, sender_role, content, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw new HttpError(500, messagesError.message);
  }

  const senderIds = [
    ...new Set(((messageRows as ThreadMessageRow[] | null) ?? []).map((row) => row.sender_id)),
  ];

  const senderProfiles =
    senderIds.length > 0
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", senderIds)
      : { data: [], error: null };

  if (senderProfiles.error) {
    throw new HttpError(500, senderProfiles.error.message);
  }

  const senderNames = new Map(
    (((senderProfiles.data as ProfileRow[] | null) ?? [])).map((profile) => [
      profile.id,
      normalizeDisplayName(profile),
    ]),
  );

  const messageItems: MessagingThreadTimelineSourceItem[] = (
    (messageRows as ThreadMessageRow[] | null) ?? []
  ).map((message) => ({
    id: message.id,
    kind: "message",
    timestamp: message.created_at,
    message: {
      id: message.id,
      created_at: message.created_at,
      sender_id: message.sender_id,
      sender_name: senderNames.get(message.sender_id) || "Family member",
      sender_role: message.sender_role,
      content: message.content,
    },
  }));

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("call_sessions")
    .select(
      "id, family_id, thread_id, created_at, answered_at, call_type, status, initiator_profile_id, initiator_display_name, callee_profile_id, callee_display_name",
    )
    .eq("family_id", thread.family_id)
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });

  if (sessionsError) {
    throw new HttpError(500, sessionsError.message);
  }

  const sessionRows = (sessions as CallSessionRow[] | null) ?? [];
  const sessionIds = sessionRows.map((session) => session.id);
  const callEventsBySession = new Map<string, CallEventRow[]>();

  if (sessionIds.length > 0) {
    const { data: callEvents, error: callEventsError } = await supabaseAdmin
      .from("call_events")
      .select("id, call_session_id, actor_profile_id, actor_display_name, event_type, created_at")
      .in("call_session_id", sessionIds)
      .in("event_type", ["accepted", "created", "declined", "missed", "ringing"])
      .order("created_at", { ascending: true });

    if (callEventsError) {
      throw new HttpError(500, callEventsError.message);
    }

    ((callEvents as CallEventRow[] | null) ?? []).forEach((event) => {
      const existing = callEventsBySession.get(event.call_session_id) || [];
      existing.push(event);
      callEventsBySession.set(event.call_session_id, existing);
    });
  }

  const systemItems: MessagingThreadTimelineSourceItem[] = [conversationStartedEvent];

  sessionRows.forEach((session) => {
    const sessionEvents = callEventsBySession.get(session.id) || [];
    const initialCallEvent =
      sessionEvents.find((event) => event.event_type === "created") ||
      sessionEvents.find((event) => event.event_type === "ringing");
    const acceptedEvent = sessionEvents.find((event) => event.event_type === "accepted");
    const declinedEvent = sessionEvents.find((event) => event.event_type === "declined");
    const missedEvent = sessionEvents.find((event) => event.event_type === "missed");

    systemItems.push({
      id: `call-attempt-${session.id}`,
      kind: "system",
      timestamp: initialCallEvent?.created_at ?? session.created_at,
      event: {
        actorId: initialCallEvent?.actor_profile_id ?? session.initiator_profile_id,
        actorName:
          initialCallEvent?.actor_display_name ??
          session.initiator_display_name ??
          "Family member",
        callType: session.call_type,
        eventType: "call_attempt",
        id: `call-attempt-${session.id}`,
        note: `${session.call_type === "video" ? "Video" : "Audio"} call started.`,
        timestamp: initialCallEvent?.created_at ?? session.created_at,
      },
    });

    if (acceptedEvent || session.status === "accepted" || session.status === "ended") {
      systemItems.push({
        id: `call-answered-${session.id}`,
        kind: "system",
        timestamp: acceptedEvent?.created_at ?? session.answered_at ?? session.created_at,
        event: {
          actorId: acceptedEvent?.actor_profile_id ?? session.callee_profile_id,
          actorName:
            acceptedEvent?.actor_display_name ??
            session.callee_display_name ??
            "Family member",
          callType: session.call_type,
          eventType: "call_answered",
          id: `call-answered-${session.id}`,
          note: `${session.call_type === "video" ? "Video" : "Audio"} call connected.`,
          timestamp: acceptedEvent?.created_at ?? session.answered_at ?? session.created_at,
        },
      });
      return;
    }

    if (declinedEvent || session.status === "declined") {
      systemItems.push({
        id: `call-declined-${session.id}`,
        kind: "system",
        timestamp: declinedEvent?.created_at ?? session.created_at,
        event: {
          actorId: declinedEvent?.actor_profile_id ?? session.callee_profile_id,
          actorName:
            declinedEvent?.actor_display_name ??
            session.callee_display_name ??
            "Family member",
          callType: session.call_type,
          eventType: "call_declined",
          id: `call-declined-${session.id}`,
          note: "The call was declined.",
          timestamp: declinedEvent?.created_at ?? session.created_at,
        },
      });
      return;
    }

    if (missedEvent || session.status === "missed") {
      systemItems.push({
        id: `call-missed-${session.id}`,
        kind: "system",
        timestamp: missedEvent?.created_at ?? session.created_at,
        event: {
          actorId: missedEvent?.actor_profile_id ?? null,
          actorName: missedEvent?.actor_display_name ?? null,
          callType: session.call_type,
          eventType: "call_missed",
          id: `call-missed-${session.id}`,
          note: "No answer.",
          timestamp: missedEvent?.created_at ?? session.created_at,
        },
      });
    }
  });

  return [...systemItems, ...messageItems];
}

async function createExportPackage(
  supabaseAdmin: ReturnType<typeof createClient>,
  options: {
    applicationBuildId?: string | null;
    exportFormat?: "json_manifest" | "pdf";
    exportId?: string;
    exportedAt?: string;
    exportedByUserId?: string | null;
    exportedByProfileId?: string;
    familyId: string;
    signReceipt?: boolean;
    threadDisplayName?: string;
    threadId: string;
    viewerProfileId: string;
  },
) {
  const thread = await loadThread(supabaseAdmin, options.familyId, options.threadId);
  await assertThreadAccess(supabaseAdmin, options.viewerProfileId, thread);

  const displayName =
    options.threadDisplayName ??
    (await resolveThreadDisplayName(supabaseAdmin, options.viewerProfileId, thread));
  const timelineItems = await loadTimelineItems(supabaseAdmin, thread);
  const exportId = options.exportId ?? crypto.randomUUID();
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const artifactPaths = buildArtifactPaths({
    exportId,
    exportedAt,
    familyId: options.familyId,
    threadDisplayName: displayName,
    threadId: thread.id,
  });
  const buildArgs = {
    applicationBuildId: options.applicationBuildId ?? getApplicationBuildId(),
    exportFormat: options.exportFormat ?? "pdf",
    artifactStorage: {
      bucket: artifactPaths.evidencePackage.bucket,
      path: artifactPaths.evidencePackage.path,
    },
    exportId,
    exportedAt,
    exportedByUserId: options.exportedByUserId ?? null,
    exportedByProfileId: options.exportedByProfileId ?? options.viewerProfileId,
    familyId: options.familyId,
    thread: {
      display_name: displayName,
      id: thread.id,
      thread_type: thread.thread_type,
    },
    timelineItems,
  } as const;

  const signingConfig = options.signReceipt
    ? getReceiptSigningConfig({ requirePrivateKey: true })
    : getReceiptSigningConfig();

  if (options.signReceipt && !signingConfig?.privateKeyPkcs8Base64) {
    throw new HttpError(
      503,
      "Messaging export receipt signing is not configured in this environment.",
    );
  }

  const preSignaturePackage = await buildMessagingThreadExportPackage({
    ...buildArgs,
    receiptSignature: signingConfig
      ? {
          algorithm: MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM,
          signingKeyId: signingConfig.keyId,
          value: "",
        }
      : null,
  });

  const pdfArtifact =
    buildArgs.exportFormat === "pdf"
      ? (() => {
          const pdfBytes = generateMessagingThreadExportPdf({
            packageData: preSignaturePackage,
            receiptId: exportId,
            signingKeyId: signingConfig?.keyId ?? null,
            signatureAlgorithm: signingConfig
              ? MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM
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
            hashAlgorithm: MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
            storageBucket: artifactPaths.pdf.bucket,
            storagePath: artifactPaths.pdf.path,
          };
        })()
      : null;

  if (pdfArtifact) {
    pdfArtifact.hash = await sha256HexFromBytes(pdfArtifact.bytes);
  }

  if (!options.signReceipt) {
    return {
      artifactPaths,
      packageData: await buildMessagingThreadExportPackage({
        ...buildArgs,
        pdfArtifact:
          pdfArtifact && {
            bytesSize: pdfArtifact.bytesSize,
            generatedAt: pdfArtifact.generatedAt,
            hash: pdfArtifact.hash,
            hashAlgorithm: pdfArtifact.hashAlgorithm,
            storageBucket: pdfArtifact.storageBucket,
            storagePath: pdfArtifact.storagePath,
          },
      }),
      pdfArtifact,
    };
  }

  const signingReadyPackage = await buildMessagingThreadExportPackage({
    ...buildArgs,
    pdfArtifact:
      pdfArtifact && {
        bytesSize: pdfArtifact.bytesSize,
        generatedAt: pdfArtifact.generatedAt,
        hash: pdfArtifact.hash,
        hashAlgorithm: pdfArtifact.hashAlgorithm,
        storageBucket: pdfArtifact.storageBucket,
        storagePath: pdfArtifact.storagePath,
      },
    receiptSignature: {
      algorithm: MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM,
      signingKeyId: signingConfig!.keyId,
      value: "",
    },
  });
  const receiptSignature = await signMessagingThreadExportReceiptPayload(
    signingReadyPackage.receiptPayloadJson,
    signingConfig!.privateKeyPkcs8Base64!,
  );

  const packageData = await buildMessagingThreadExportPackage({
    ...buildArgs,
    pdfArtifact:
      pdfArtifact && {
        bytesSize: pdfArtifact.bytesSize,
        generatedAt: pdfArtifact.generatedAt,
        hash: pdfArtifact.hash,
        hashAlgorithm: pdfArtifact.hashAlgorithm,
        storageBucket: pdfArtifact.storageBucket,
        storagePath: pdfArtifact.storagePath,
      },
    receiptSignature: {
      algorithm: MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM,
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
    key: options.artifactPaths.evidencePackage.path,
  });

  const pdfArtifact = options.pdfArtifact
    ? await uploadImmutableCourtExportObject({
        bytes: options.pdfArtifact.bytes,
        contentType: options.pdfArtifact.contentType,
        key: options.pdfArtifact.storagePath,
      })
    : null;

  return {
    evidencePackage,
    pdfArtifact,
  };
}

const getStoredArtifactPath = (
  receipt: MessagingThreadExportReceipt,
  row: CourtExportRow,
  artifactKind: "json_evidence_package" | "pdf",
) => {
  const rowBucket =
    artifactKind === "pdf" ? row.pdf_storage_bucket : row.artifact_storage_bucket;
  const rowPath =
    artifactKind === "pdf" ? row.pdf_storage_key : row.artifact_storage_key;
  const rowProvider =
    artifactKind === "pdf" ? row.pdf_storage_provider : row.artifact_storage_provider;
  const rowVersionId =
    artifactKind === "pdf" ? row.pdf_storage_version_id : row.artifact_storage_version_id;
  const bucketKey =
    artifactKind === "pdf" ? "pdf_storage_bucket" : "artifact_storage_bucket";
  const pathKey =
    artifactKind === "pdf" ? "pdf_storage_path" : "artifact_storage_path";

  const storageBucket =
    rowBucket ??
    (typeof (receipt as Record<string, unknown>)[bucketKey] === "string"
      ? ((receipt as Record<string, unknown>)[bucketKey] as string)
      : LEGACY_COURT_EXPORT_ARTIFACT_BUCKET);
  const storagePath =
    rowPath ??
    (typeof (receipt as Record<string, unknown>)[pathKey] === "string"
      ? ((receipt as Record<string, unknown>)[pathKey] as string)
      : null);

  if (storagePath && rowProvider === "aws_s3_object_lock" && rowVersionId) {
    return {
      bucket: storageBucket,
      provider: rowProvider,
      path: storagePath,
      versionId: rowVersionId,
    };
  }

  if (storagePath) {
    return {
      bucket: storageBucket,
      provider: rowProvider,
      path: storagePath,
      versionId: rowVersionId,
    };
  }

  const manifest = getManifestFromRow(row);
  const exportId =
    typeof manifest.export_id === "string" ? manifest.export_id : row.id;
  const threadDisplayName =
    typeof manifest.thread_display_name === "string"
      ? manifest.thread_display_name
      : "recorded-thread";

  const artifactPaths = buildArtifactPaths({
    exportId,
    exportedAt: row.exported_at,
    familyId: row.family_id,
    threadDisplayName,
    threadId: row.thread_id ?? row.source_id ?? row.id,
  });

  return artifactKind === "pdf"
    ? {
        bucket: artifactPaths.pdf.bucket,
        provider: null,
        path: artifactPaths.pdf.path,
        versionId: null,
      }
    : {
        bucket: artifactPaths.evidencePackage.bucket,
        provider: null,
        path: artifactPaths.evidencePackage.path,
        versionId: null,
      };
};

async function downloadStoredArtifact(
  supabaseAdmin: ReturnType<typeof createClient>,
  options: {
    artifactKind: "json_evidence_package" | "pdf";
    exportRecord: CourtExportRow;
    receipt: MessagingThreadExportReceipt;
  },
) {
  const artifactPath = getStoredArtifactPath(
    options.receipt,
    options.exportRecord,
    options.artifactKind,
  );
  let bytes: Uint8Array;
  let contentType: string;

  if (artifactPath.provider === "aws_s3_object_lock" && artifactPath.versionId) {
    const download = await downloadImmutableCourtExportObject({
      bucket: artifactPath.bucket,
      key: artifactPath.path,
      versionId: artifactPath.versionId,
    });
    bytes = download.bytes;
    contentType = download.contentType;
  } else {
    const { data, error } = await supabaseAdmin.storage
      .from(artifactPath.bucket)
      .download(artifactPath.path);

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
  const fileName = artifactPath.path.split("/").pop() ?? `${options.exportRecord.id}.bin`;
  const hashAlgorithm =
    options.artifactKind === "pdf"
      ? options.receipt.pdf_hash_algorithm
      : options.receipt.artifact_hash_algorithm;
  const hash =
    options.artifactKind === "pdf"
      ? options.receipt.pdf_artifact_hash
      : options.receipt.artifact_hash;

  return {
    base64: encodeBase64(bytes),
    bucket: artifactPath.bucket,
    bytes,
    bytesSize: bytes.byteLength,
    contentType,
    fileName,
    hash,
    hashAlgorithm,
    path: artifactPath.path,
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
      source_type: "message_thread",
      source_id: packageData.manifest.thread_id,
      export_scope: "message_thread",
      thread_id: packageData.manifest.thread_id,
      thread_type: packageData.manifest.thread_type,
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
      record_count: packageData.manifest.total_entries,
      record_range_start: packageData.manifest.record_start,
      record_range_end: packageData.manifest.record_end,
      exported_at: packageData.manifest.export_generated_at,
    })
    .select(COURT_EXPORT_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new HttpError(500, error?.message ?? "Unable to persist the export record.");
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

const getReceiptFromRow = (row: CourtExportRow): MessagingThreadExportReceipt => {
  const receipt = asRecord(row.receipt_json);
  if (receipt) {
    return receipt as MessagingThreadExportReceipt;
  }

  const manifest = getManifestFromRow(row);
  return {
    artifact_hash: row.artifact_hash,
    artifact_hash_algorithm: row.artifact_hash_algorithm,
    artifact_type: row.artifact_type,
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
    canonical_content_hash: row.content_hash,
    canonical_hash_algorithm: row.hash_algorithm,
    canonicalization_version:
      row.canonicalization_version ?? MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
    created_by_user_id: row.created_by_user_id,
    created_by_profile_id: row.created_by_profile_id,
    export_format: row.export_format,
    exported_at: row.exported_at,
    family_id: row.family_id,
    integrity_model_version:
      row.integrity_model_version ?? MESSAGING_THREAD_EXPORT_INTEGRITY_MODEL_VERSION,
    manifest_hash: row.manifest_hash,
    manifest_hash_algorithm: row.manifest_hash_algorithm,
    pdf_artifact_hash: row.pdf_artifact_hash,
    pdf_artifact_type: row.pdf_artifact_hash
      ? MESSAGING_THREAD_EXPORT_PDF_ARTIFACT_TYPE
      : null,
    pdf_bytes_size: row.pdf_bytes_size,
    pdf_generated_at:
      row.pdf_generated_at ??
      (typeof manifest.pdf_generated_at === "string" ? manifest.pdf_generated_at : null),
    pdf_hash_algorithm:
      row.pdf_hash_algorithm ??
      (typeof manifest.pdf_hash_algorithm === "string" ? manifest.pdf_hash_algorithm : null),
    pdf_storage_bucket:
      row.pdf_storage_bucket ??
      (typeof manifest.pdf_storage_bucket === "string"
        ? manifest.pdf_storage_bucket
        : null),
    pdf_storage_path:
      row.pdf_storage_key ??
      (typeof manifest.pdf_storage_path === "string"
        ? manifest.pdf_storage_path
        : null),
    signing_key_id: row.signing_key_id,
    receipt_signature: row.receipt_signature,
    receipt_signature_algorithm: row.receipt_signature_algorithm,
    record_count: row.record_count,
    record_end: row.record_range_end ?? (typeof manifest.record_end === "string" ? manifest.record_end : null),
    record_start: row.record_range_start ?? (typeof manifest.record_start === "string" ? manifest.record_start : null),
    schema_version:
      typeof manifest.schema_version === "string"
        ? manifest.schema_version
        : MESSAGING_THREAD_EXPORT_SCHEMA_VERSION,
    source_id: row.source_id ?? row.thread_id ?? "",
    source_type: row.source_type,
    thread_display_name:
      typeof manifest.thread_display_name === "string"
        ? manifest.thread_display_name
        : "Recorded thread",
    thread_id:
      typeof manifest.thread_id === "string"
        ? manifest.thread_id
        : row.thread_id ?? row.source_id ?? "",
    thread_type: row.thread_type ?? (typeof manifest.thread_type === "string" ? manifest.thread_type as MessageThreadRow["thread_type"] : "direct_message"),
    total_messages:
      typeof manifest.total_messages === "number" ? manifest.total_messages : row.record_count,
    total_system_events:
      typeof manifest.total_system_events === "number" ? manifest.total_system_events : 0,
  };
};

const buildExportSummary = (row: CourtExportRow) => {
  const manifest = getManifestFromRow(row);
  const receipt = getReceiptFromRow(row);

  return {
    content_hash: row.content_hash,
    export_format: row.export_format,
    exported_at: row.exported_at,
    family_id: row.family_id,
    hash_algorithm: row.hash_algorithm,
    id: row.id,
    integrity_model_version:
      typeof receipt.integrity_model_version === "string"
        ? receipt.integrity_model_version
        : row.integrity_model_version,
    canonicalization_version:
      typeof receipt.canonicalization_version === "string"
        ? receipt.canonicalization_version
        : row.canonicalization_version,
    manifest_hash:
      typeof receipt.manifest_hash === "string"
        ? receipt.manifest_hash
        : row.manifest_hash,
    manifest_hash_algorithm:
      typeof receipt.manifest_hash_algorithm === "string"
        ? receipt.manifest_hash_algorithm
        : row.manifest_hash_algorithm,
    artifact_hash:
      typeof receipt.artifact_hash === "string"
        ? receipt.artifact_hash
        : row.artifact_hash,
    artifact_hash_algorithm:
      typeof receipt.artifact_hash_algorithm === "string"
        ? receipt.artifact_hash_algorithm
        : row.artifact_hash_algorithm,
    artifact_type:
      typeof receipt.artifact_type === "string"
        ? receipt.artifact_type
        : row.artifact_type,
    pdf_artifact_hash:
      typeof receipt.pdf_artifact_hash === "string"
        ? receipt.pdf_artifact_hash
        : row.pdf_artifact_hash,
    pdf_hash_algorithm:
      typeof receipt.pdf_hash_algorithm === "string"
        ? receipt.pdf_hash_algorithm
        : row.pdf_hash_algorithm,
    pdf_bytes_size:
      typeof receipt.pdf_bytes_size === "number"
        ? receipt.pdf_bytes_size
        : row.pdf_bytes_size,
    pdf_generated_at:
      typeof receipt.pdf_generated_at === "string"
        ? receipt.pdf_generated_at
        : row.pdf_generated_at,
    record_count: row.record_count,
    signature_algorithm:
      typeof receipt.receipt_signature_algorithm === "string"
        ? receipt.receipt_signature_algorithm
        : row.receipt_signature_algorithm,
    signing_key_id:
      typeof receipt.signing_key_id === "string"
        ? receipt.signing_key_id
        : row.signing_key_id,
    signature_present: Boolean(
      typeof receipt.receipt_signature === "string"
        ? receipt.receipt_signature
        : row.receipt_signature,
    ),
    artifact_storage: {
      bucket: row.artifact_storage_bucket,
      key: row.artifact_storage_key,
      object_lock_mode: row.artifact_object_lock_mode,
      provider: row.artifact_storage_provider,
      retain_until: row.artifact_retain_until,
      version_id: row.artifact_storage_version_id,
    },
    pdf_storage: {
      bucket: row.pdf_storage_bucket,
      key: row.pdf_storage_key,
      object_lock_mode: row.pdf_object_lock_mode,
      provider: row.pdf_storage_provider,
      retain_until: row.pdf_retain_until,
      version_id: row.pdf_storage_version_id,
    },
    export_scope: row.export_scope,
    thread_display_name:
      typeof manifest.thread_display_name === "string"
        ? manifest.thread_display_name
        : "Recorded thread",
    thread_id:
      typeof manifest.thread_id === "string"
        ? manifest.thread_id
        : row.thread_id ?? row.source_id,
    thread_type:
      typeof manifest.thread_type === "string" ? manifest.thread_type : "direct_message",
    total_messages:
      typeof manifest.total_messages === "number" ? manifest.total_messages : row.record_count,
    total_system_events:
      typeof manifest.total_system_events === "number" ? manifest.total_system_events : 0,
  };
};

const buildVerificationLayer = (options: {
  algorithm: string | null;
  computed: string | null;
  label: string;
  note?: string | null;
  stored: string | null;
}) => {
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
  receipt: MessagingThreadExportReceipt;
}) => {
  const receipt = options.receipt;
  const algorithm =
    typeof receipt.receipt_signature_algorithm === "string"
      ? receipt.receipt_signature_algorithm
      : null;
  const signature =
    typeof receipt.receipt_signature === "string" ? receipt.receipt_signature : null;
  const signingKeyId =
    typeof receipt.signing_key_id === "string" ? receipt.signing_key_id : null;

  if (!signature || !algorithm) {
    return {
      algorithm,
      note: `This ${options.contextLabel} does not include a server signature.`,
      present: false,
      status: "not_supported",
      valid: null,
    };
  }

  if (
    algorithm !== MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM &&
    algorithm !== MESSAGING_THREAD_EXPORT_LEGACY_SIGNATURE_ALGORITHM
  ) {
    return {
      algorithm,
      note: `The ${options.contextLabel} uses an unsupported signature algorithm.`,
      present: true,
      status: "not_supported",
      valid: null,
    };
  }

  if (algorithm === MESSAGING_THREAD_EXPORT_LEGACY_SIGNATURE_ALGORITHM) {
    const signingSecret = getLegacyReceiptSigningSecret();
    if (!signingSecret) {
      return {
        algorithm,
        note: "Legacy receipt-signature verification is not configured in this environment.",
        present: true,
        status: "not_supported",
        valid: null,
      };
    }

    const valid = await verifyLegacyMessagingThreadExportReceiptSignature(
      getMessagingThreadExportReceiptPayloadJson(receipt),
      signingSecret,
      signature,
    );

    return {
      algorithm,
      note: valid
        ? `The ${options.contextLabel} legacy server signature is valid.`
        : `The ${options.contextLabel} legacy server signature did not validate.`,
      present: true,
      status: valid ? "match" : "mismatch",
      valid,
    };
  }

  const verificationPublicKey = getReceiptVerificationPublicKey(signingKeyId);
  if (!verificationPublicKey) {
    return {
      algorithm,
      note: signingKeyId
        ? `The server verification key for signing key ${signingKeyId} is not configured in this environment.`
        : "The server receipt-signature verification key is not configured in this environment.",
      present: true,
      status: "not_supported",
      valid: null,
    };
  }

  const valid = await verifyMessagingThreadExportReceiptSignature(
    getMessagingThreadExportReceiptPayloadJson(receipt),
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
  artifactLayer: ReturnType<typeof buildVerificationLayer>;
  exportRecord: CourtExportRow;
  manifestLayer: ReturnType<typeof buildVerificationLayer>;
  pdfLayer: ReturnType<typeof buildVerificationLayer>;
  signatureLayer: Awaited<ReturnType<typeof verifyReceiptSignatureLayer>>;
  verificationMode: VerificationMode;
  contentLayer: ReturnType<typeof buildVerificationLayer>;
}): Record<string, unknown> => {
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
    await getActiveMembershipForUser(supabaseAdmin, familyId, user.id);
    await requireCourtExportPowerAccess(supabaseAdmin, profile);

    logStep("request", {
      action: body.action,
      exportId: "export_id" in body ? body.export_id ?? null : null,
      familyId,
      profileId: profile.id,
      threadId: "thread_id" in body ? body.thread_id ?? null : null,
      userId: user.id,
    });

    if (body.action === "create") {
      const threadId = requireThreadId(body.thread_id);
      const exportFormat = body.export_format ?? "pdf";
      const exportArtifacts = await createExportPackage(supabaseAdmin, {
        exportFormat,
        exportedByUserId: user.id,
        familyId,
        signReceipt: true,
        threadId,
        viewerProfileId: profile.id,
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
          canonicalization_version: exportArtifacts.packageData.receipt.canonicalization_version,
          content_hash: exportArtifacts.packageData.contentHash,
          family_id: familyId,
          hash_algorithm: exportRecord.hash_algorithm,
          integrity_model_version: exportArtifacts.packageData.receipt.integrity_model_version,
          manifest_hash: exportArtifacts.packageData.receipt.manifest_hash,
          pdf_artifact_hash: exportArtifacts.packageData.receipt.pdf_artifact_hash,
          pdf_storage_key: storedArtifacts.pdfArtifact?.key ?? null,
          record_count: exportRecord.record_count,
          signing_key_id: exportArtifacts.packageData.receipt.signing_key_id,
          signature_present: Boolean(exportArtifacts.packageData.receipt.receipt_signature),
          source_id: exportRecord.source_id,
          source_type: exportRecord.source_type,
          storage_provider: storedArtifacts.evidencePackage.provider,
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
      const threadId = requireThreadId(body.thread_id);
      const thread = await loadThread(supabaseAdmin, familyId, threadId);
      await assertThreadAccess(supabaseAdmin, profile.id, thread);

      const limit = Math.min(Math.max(body.limit ?? 10, 1), 20);
      const { data, error } = await supabaseAdmin
        .from("court_exports")
        .select(COURT_EXPORT_SELECT_COLUMNS)
        .eq("family_id", familyId)
        .eq("export_scope", "message_thread")
        .eq("source_type", "message_thread")
        .eq("source_id", threadId)
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

      const exportThreadId = exportRecord.thread_id ?? exportRecord.source_id;
      if (!exportThreadId) {
        throw new HttpError(500, "The stored export record is missing thread metadata.");
      }
      const thread = await loadThread(supabaseAdmin, familyId, exportThreadId);
      await assertThreadAccess(supabaseAdmin, profile.id, thread);
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
      const exportRecord = await loadCourtExport(supabaseAdmin, familyId, exportId);
      const verificationMode: VerificationMode =
        // `provided_manifest_json` remains accepted as a backward-compat alias for
        // uploaded evidence-package JSON verification.
        body.verification_mode === "provided_manifest_json"
          ? "provided_package_json"
          : body.verification_mode ?? "stored_source";

      if (!exportRecord) {
        return jsonResponse(req, 404, {
          success: false,
          status: "receipt_not_found",
          error: "The selected export receipt could not be found.",
        });
      }

      const exportThreadId = exportRecord.thread_id ?? exportRecord.source_id;
      if (!exportThreadId) {
        throw new HttpError(500, "The stored export record is missing thread metadata.");
      }
      const thread = await loadThread(supabaseAdmin, familyId, exportThreadId);
      await assertThreadAccess(supabaseAdmin, profile.id, thread);

      const receipt = getReceiptFromRow(exportRecord);
      const storedManifest = getManifestFromRow(exportRecord);
      const storedManifestJson = getMessagingThreadExportManifestJson({
        manifest: storedManifest,
        manifest_json:
          typeof exportRecord.manifest_json === "string"
            ? exportRecord.manifest_json
            : undefined,
      }) ?? stableStringifyForIntegrity(storedManifest);
      const storedReceiptSignatureLayer = await verifyReceiptSignatureLayer({
        contextLabel: "stored export receipt",
        receipt,
      });
      const unsupportedPdfLayer = buildVerificationLayer({
        algorithm:
          typeof receipt.pdf_hash_algorithm === "string"
            ? receipt.pdf_hash_algorithm
            : exportRecord.pdf_hash_algorithm,
        computed: null,
        label: "PDF artifact hash",
        note: "This verification mode does not recalculate the stored PDF artifact hash.",
        stored:
          typeof receipt.pdf_artifact_hash === "string"
            ? receipt.pdf_artifact_hash
            : exportRecord.pdf_artifact_hash,
      });

      if (verificationMode === "stored_signature") {
        const manifestLayer = buildVerificationLayer({
          algorithm:
            typeof receipt.manifest_hash_algorithm === "string"
              ? receipt.manifest_hash_algorithm
              : exportRecord.manifest_hash_algorithm,
          computed: await sha256Hex(storedManifestJson),
          label: "Manifest hash",
          stored:
            typeof receipt.manifest_hash === "string"
              ? receipt.manifest_hash
              : exportRecord.manifest_hash,
        });

        const responseBody = buildVerificationResponse({
          artifactLayer: buildVerificationLayer({
            algorithm:
              typeof receipt.artifact_hash_algorithm === "string"
                ? receipt.artifact_hash_algorithm
                : exportRecord.artifact_hash_algorithm,
            computed: null,
            label: "JSON evidence package hash",
            note: "Receipt-signature verification does not recalculate the JSON evidence package hash.",
            stored:
              typeof receipt.artifact_hash === "string"
                ? receipt.artifact_hash
                : exportRecord.artifact_hash,
          }),
          contentLayer: buildVerificationLayer({
            algorithm:
              typeof receipt.canonical_hash_algorithm === "string"
                ? receipt.canonical_hash_algorithm
                : exportRecord.hash_algorithm,
            computed: null,
            label: "Canonical content hash",
            note: "Receipt-signature verification does not recalculate source content.",
            stored:
              typeof receipt.canonical_content_hash === "string"
                ? receipt.canonical_content_hash
                : exportRecord.content_hash,
          }),
          exportRecord,
          manifestLayer,
          pdfLayer: unsupportedPdfLayer,
          signatureLayer: storedReceiptSignatureLayer,
          verificationMode,
        });

        const responseStatus = responseBody.status as VerificationStatus;
        await logAudit(supabaseAdmin, {
          action:
            responseStatus === "match"
              ? "COURT_EXPORT_VERIFIED"
              : responseStatus === "signature_invalid"
                ? "COURT_EXPORT_VERIFY_SIGNATURE_INVALID"
                : "COURT_EXPORT_VERIFY_UNSUPPORTED",
          actorProfileId: profile.id,
          actorUserId: user.id,
          entityId: exportRecord.id,
          metadata: {
            family_id: familyId,
            signature_status: storedReceiptSignatureLayer.status,
            signing_key_id:
              typeof receipt.signing_key_id === "string" ? receipt.signing_key_id : exportRecord.signing_key_id,
            verification_mode: verificationMode,
            status: responseStatus,
          },
        });

        return jsonResponse(req, 200, responseBody);
      }

      if (verificationMode === "stored_pdf_artifact") {
        let storedPdfArtifact;
        try {
          storedPdfArtifact = await downloadStoredArtifact(supabaseAdmin, {
            artifactKind: "pdf",
            exportRecord,
            receipt,
          });
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

        const pdfLayer = buildVerificationLayer({
          algorithm:
            typeof receipt.pdf_hash_algorithm === "string"
              ? receipt.pdf_hash_algorithm
              : exportRecord.pdf_hash_algorithm,
          computed: await sha256HexFromBytes(storedPdfArtifact.bytes),
          label: "PDF artifact hash",
          stored:
            typeof receipt.pdf_artifact_hash === "string"
              ? receipt.pdf_artifact_hash
              : exportRecord.pdf_artifact_hash,
        });

        const responseBody = buildVerificationResponse({
          artifactLayer: buildVerificationLayer({
            algorithm:
              typeof receipt.artifact_hash_algorithm === "string"
                ? receipt.artifact_hash_algorithm
                : exportRecord.artifact_hash_algorithm,
            computed: null,
            label: "JSON evidence package hash",
            note: "PDF verification does not recalculate the JSON evidence package hash.",
            stored:
              typeof receipt.artifact_hash === "string"
                ? receipt.artifact_hash
                : exportRecord.artifact_hash,
          }),
          contentLayer: buildVerificationLayer({
            algorithm:
              typeof receipt.canonical_hash_algorithm === "string"
                ? receipt.canonical_hash_algorithm
                : exportRecord.hash_algorithm,
            computed: null,
            label: "Canonical content hash",
            note: "PDF verification does not recalculate the canonical record payload.",
            stored:
              typeof receipt.canonical_content_hash === "string"
                ? receipt.canonical_content_hash
                : exportRecord.content_hash,
          }),
          exportRecord,
          manifestLayer: buildVerificationLayer({
            algorithm:
              typeof receipt.manifest_hash_algorithm === "string"
                ? receipt.manifest_hash_algorithm
                : exportRecord.manifest_hash_algorithm,
            computed: null,
            label: "Manifest hash",
            note: "PDF verification does not recalculate the manifest hash.",
            stored:
              typeof receipt.manifest_hash === "string"
                ? receipt.manifest_hash
                : exportRecord.manifest_hash,
          }),
          pdfLayer,
          signatureLayer: storedReceiptSignatureLayer,
          verificationMode,
        });
        const responseStatus = responseBody.status as VerificationStatus;

        await logAudit(supabaseAdmin, {
          action:
            responseStatus === "match"
              ? "COURT_EXPORT_VERIFIED"
              : responseStatus === "signature_invalid"
                ? "COURT_EXPORT_VERIFY_SIGNATURE_INVALID"
                : responseStatus === "verification_not_supported"
                  ? "COURT_EXPORT_VERIFY_UNSUPPORTED"
                  : "COURT_EXPORT_VERIFY_MISMATCH",
          actorProfileId: profile.id,
          actorUserId: user.id,
          entityId: exportRecord.id,
          metadata: {
            family_id: familyId,
            pdf_hash_status: pdfLayer.status,
            signature_status: storedReceiptSignatureLayer.status,
            signing_key_id:
              typeof receipt.signing_key_id === "string" ? receipt.signing_key_id : exportRecord.signing_key_id,
            status: responseStatus,
            verification_mode: verificationMode,
          },
        });

        return jsonResponse(req, 200, responseBody);
      }

      if (verificationMode === "provided_pdf_artifact") {
        if (!body.provided_pdf_base64) {
          throw new HttpError(400, "provided_pdf_base64 is required for uploaded PDF verification.");
        }

        const providedPdfBytes = decodeBase64ToBytes(body.provided_pdf_base64);
        const pdfLayer = buildVerificationLayer({
          algorithm:
            typeof receipt.pdf_hash_algorithm === "string"
              ? receipt.pdf_hash_algorithm
              : exportRecord.pdf_hash_algorithm,
          computed: await sha256HexFromBytes(providedPdfBytes),
          label: "PDF artifact hash",
          stored:
            typeof receipt.pdf_artifact_hash === "string"
              ? receipt.pdf_artifact_hash
              : exportRecord.pdf_artifact_hash,
        });

        const responseBody = buildVerificationResponse({
          artifactLayer: buildVerificationLayer({
            algorithm:
              typeof receipt.artifact_hash_algorithm === "string"
                ? receipt.artifact_hash_algorithm
                : exportRecord.artifact_hash_algorithm,
            computed: null,
            label: "JSON evidence package hash",
            note: "Uploaded PDF verification does not recalculate the JSON evidence package hash.",
            stored:
              typeof receipt.artifact_hash === "string"
                ? receipt.artifact_hash
                : exportRecord.artifact_hash,
          }),
          contentLayer: buildVerificationLayer({
            algorithm:
              typeof receipt.canonical_hash_algorithm === "string"
                ? receipt.canonical_hash_algorithm
                : exportRecord.hash_algorithm,
            computed: null,
            label: "Canonical content hash",
            note: "Uploaded PDF verification does not recalculate the canonical record payload.",
            stored:
              typeof receipt.canonical_content_hash === "string"
                ? receipt.canonical_content_hash
                : exportRecord.content_hash,
          }),
          exportRecord,
          manifestLayer: buildVerificationLayer({
            algorithm:
              typeof receipt.manifest_hash_algorithm === "string"
                ? receipt.manifest_hash_algorithm
                : exportRecord.manifest_hash_algorithm,
            computed: null,
            label: "Manifest hash",
            note: "Uploaded PDF verification does not recalculate the manifest hash.",
            stored:
              typeof receipt.manifest_hash === "string"
                ? receipt.manifest_hash
                : exportRecord.manifest_hash,
          }),
          pdfLayer,
          signatureLayer: storedReceiptSignatureLayer,
          verificationMode,
        });
        const responseStatus = responseBody.status as VerificationStatus;

        await logAudit(supabaseAdmin, {
          action:
            responseStatus === "match"
              ? "COURT_EXPORT_VERIFIED"
              : responseStatus === "signature_invalid"
                ? "COURT_EXPORT_VERIFY_SIGNATURE_INVALID"
                : responseStatus === "verification_not_supported"
                  ? "COURT_EXPORT_VERIFY_UNSUPPORTED"
                  : "COURT_EXPORT_VERIFY_MISMATCH",
          actorProfileId: profile.id,
          actorUserId: user.id,
          entityId: exportRecord.id,
          metadata: {
            family_id: familyId,
            pdf_hash_status: pdfLayer.status,
            signature_status: storedReceiptSignatureLayer.status,
            signing_key_id:
              typeof receipt.signing_key_id === "string" ? receipt.signing_key_id : exportRecord.signing_key_id,
            status: responseStatus,
            verification_mode: verificationMode,
          },
        });

        return jsonResponse(req, 200, responseBody);
      }

      if (verificationMode === "provided_package_json") {
        // Continue accepting the legacy alias payload key for backward compatibility.
        const providedPackageJson = body.provided_package_json ?? body.provided_manifest_json;
        if (!providedPackageJson) {
          throw new HttpError(400, "provided_package_json is required for uploaded package verification.");
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(providedPackageJson);
        } catch {
          throw new HttpError(400, "The provided evidence package file is not valid JSON.");
        }

        const parsedPackage = parseMessagingThreadEvidencePackage(parsed);
        const canonicalPayloadJson = getMessagingThreadExportPayloadJson(parsed);
        if (!canonicalPayloadJson || !parsedPackage?.canonicalPayload) {
          throw new HttpError(400, "The provided evidence package does not contain a canonical payload.");
        }

        const manifestJson = getMessagingThreadExportManifestJson(parsed);
        const artifactPayloadJson = getMessagingThreadExportArtifactPayloadJson(parsed);
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
          algorithm:
            typeof receipt.canonical_hash_algorithm === "string"
              ? receipt.canonical_hash_algorithm
              : exportRecord.hash_algorithm,
          computed: await sha256Hex(canonicalPayloadJson),
          label: "Canonical content hash",
          stored:
            typeof receipt.canonical_content_hash === "string"
              ? receipt.canonical_content_hash
              : exportRecord.content_hash,
        });
        const manifestLayer = buildVerificationLayer({
          algorithm:
            typeof receipt.manifest_hash_algorithm === "string"
              ? receipt.manifest_hash_algorithm
              : exportRecord.manifest_hash_algorithm,
          computed: manifestJson ? await sha256Hex(manifestJson) : null,
          label: "Manifest hash",
          note: manifestJson
            ? null
            : "The uploaded evidence package does not include the manifest string required for manifest-hash verification.",
          stored:
            typeof receipt.manifest_hash === "string"
              ? receipt.manifest_hash
              : exportRecord.manifest_hash,
        });
        const artifactLayer = buildVerificationLayer({
          algorithm:
            typeof receipt.artifact_hash_algorithm === "string"
              ? receipt.artifact_hash_algorithm
              : exportRecord.artifact_hash_algorithm,
          computed: artifactPayloadJson ? await sha256Hex(artifactPayloadJson) : null,
          label: "JSON evidence package hash",
          note: artifactPayloadJson
            ? null
            : "The uploaded evidence package does not include the deterministic JSON artifact payload required for artifact-hash verification.",
          stored:
            typeof receipt.artifact_hash === "string"
              ? receipt.artifact_hash
              : exportRecord.artifact_hash,
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
        const responseStatus = responseBody.status as VerificationStatus;

        await logAudit(supabaseAdmin, {
          action:
            responseStatus === "match"
              ? "COURT_EXPORT_VERIFIED"
              : responseStatus === "signature_invalid"
                ? "COURT_EXPORT_VERIFY_SIGNATURE_INVALID"
                : responseStatus === "verification_not_supported"
                  ? "COURT_EXPORT_VERIFY_UNSUPPORTED"
                  : "COURT_EXPORT_VERIFY_MISMATCH",
          actorProfileId: profile.id,
          actorUserId: user.id,
          entityId: exportRecord.id,
          metadata: {
            artifact_hash_status: artifactLayer.status,
            computed_hash: contentLayer.computed,
            family_id: familyId,
            manifest_hash_status: manifestLayer.status,
            signature_status: providedReceiptSignatureLayer.status,
            signing_key_id:
              typeof receipt.signing_key_id === "string" ? receipt.signing_key_id : exportRecord.signing_key_id,
            status: responseStatus,
            verification_mode: verificationMode,
          },
        });

        return jsonResponse(req, 200, responseBody);
      }

      const regeneratedPackage = await createExportPackage(supabaseAdmin, {
        applicationBuildId:
          typeof storedManifest.application_build_id === "string"
            ? storedManifest.application_build_id
            : null,
        exportFormat: exportRecord.export_format,
        exportId:
          typeof storedManifest.export_id === "string"
            ? storedManifest.export_id
            : exportRecord.id,
        exportedAt:
          typeof storedManifest.export_generated_at === "string"
            ? storedManifest.export_generated_at
            : exportRecord.exported_at,
        exportedByUserId:
          typeof receipt.created_by_user_id === "string"
            ? receipt.created_by_user_id
            : exportRecord.created_by_user_id,
        exportedByProfileId: exportRecord.created_by_profile_id,
        familyId,
        signReceipt: false,
        threadDisplayName:
          typeof storedManifest.thread_display_name === "string"
            ? storedManifest.thread_display_name
            : undefined,
        threadId: exportRecord.thread_id ?? exportRecord.source_id ?? "",
        viewerProfileId: profile.id,
      });

      const contentLayer = buildVerificationLayer({
        algorithm:
          typeof receipt.canonical_hash_algorithm === "string"
            ? receipt.canonical_hash_algorithm
            : exportRecord.hash_algorithm,
        computed: regeneratedPackage.packageData.contentHash,
        label: "Canonical content hash",
        stored:
          typeof receipt.canonical_content_hash === "string"
            ? receipt.canonical_content_hash
            : exportRecord.content_hash,
      });
      const manifestLayer = buildVerificationLayer({
        algorithm:
          typeof receipt.manifest_hash_algorithm === "string"
            ? receipt.manifest_hash_algorithm
            : exportRecord.manifest_hash_algorithm,
        computed: regeneratedPackage.packageData.manifestHash,
        label: "Manifest hash",
        stored:
          typeof receipt.manifest_hash === "string"
            ? receipt.manifest_hash
            : exportRecord.manifest_hash,
      });
      const artifactLayer = buildVerificationLayer({
        algorithm:
          typeof receipt.artifact_hash_algorithm === "string"
            ? receipt.artifact_hash_algorithm
            : exportRecord.artifact_hash_algorithm,
        computed:
          typeof receipt.artifact_type === "string" &&
          receipt.artifact_type !== MESSAGING_THREAD_EXPORT_ARTIFACT_TYPE
            ? null
            : regeneratedPackage.packageData.artifactHash,
        label: "JSON evidence package hash",
        note:
          typeof receipt.artifact_type === "string" &&
          receipt.artifact_type !== MESSAGING_THREAD_EXPORT_ARTIFACT_TYPE
            ? "The stored receipt references an artifact type that this verifier does not support."
            : null,
        stored:
          typeof receipt.artifact_hash === "string"
            ? receipt.artifact_hash
            : exportRecord.artifact_hash,
      });

      const responseBody = buildVerificationResponse({
        artifactLayer,
        contentLayer,
        exportRecord,
        manifestLayer,
        pdfLayer: unsupportedPdfLayer,
        signatureLayer: storedReceiptSignatureLayer,
        verificationMode,
      });
      const responseStatus = responseBody.status as VerificationStatus;

      await logAudit(supabaseAdmin, {
        action:
          responseStatus === "match"
            ? "COURT_EXPORT_VERIFIED"
            : responseStatus === "signature_invalid"
              ? "COURT_EXPORT_VERIFY_SIGNATURE_INVALID"
              : responseStatus === "verification_not_supported"
                ? "COURT_EXPORT_VERIFY_UNSUPPORTED"
                : "COURT_EXPORT_VERIFY_MISMATCH",
        actorProfileId: profile.id,
        actorUserId: user.id,
        entityId: exportRecord.id,
        metadata: {
          artifact_hash_status: artifactLayer.status,
          computed_hash: contentLayer.computed,
          family_id: familyId,
          manifest_hash_status: manifestLayer.status,
          signature_status: storedReceiptSignatureLayer.status,
          signing_key_id:
            typeof receipt.signing_key_id === "string" ? receipt.signing_key_id : exportRecord.signing_key_id,
          status: responseStatus,
          verification_mode: verificationMode,
        },
      });

      return jsonResponse(req, 200, responseBody);
    }

    throw new HttpError(400, "Unsupported export action.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message =
      error instanceof HttpError
        ? error.message
        : "Unable to process the message-thread export request.";

    console.error(`[${LOG_PREFIX}]`, error);

    if (requestAction === "verify" && status === 403) {
      return jsonResponse(req, 403, {
        success: false,
        status: "not_authorized",
        error: message,
      });
    }

    return jsonResponse(req, status, {
      success: false,
      error: message,
    });
  }
});
