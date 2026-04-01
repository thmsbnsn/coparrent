export const MESSAGING_THREAD_EXPORT_SCHEMA_VERSION =
  "coparrent.messaging-thread-export/v3";
export const MESSAGING_THREAD_EXPORT_INTEGRITY_MODEL_VERSION =
  "coparrent.messaging-thread-export-receipt/v4";
export const MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION =
  "coparrent.messaging-thread-export-canonical/v2";
export const MESSAGING_THREAD_EXPORT_PACKAGE_SCHEMA_VERSION =
  "coparrent.messaging-thread-export-package/v4";
export const MESSAGING_THREAD_EXPORT_HASH_ALGORITHM = "sha256";
export const MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM = "ed25519";
export const MESSAGING_THREAD_EXPORT_LEGACY_SIGNATURE_ALGORITHM =
  "hmac-sha256";
export const MESSAGING_THREAD_EXPORT_ARTIFACT_TYPE = "json_evidence_package";
export const MESSAGING_THREAD_EXPORT_PDF_ARTIFACT_TYPE =
  "server_generated_pdf_artifact";

const HASH_ALGORITHM_LABEL = "SHA-256";

const ROLE_LABELS: Record<string, string> = {
  guardian: "Guardian",
  parent: "Parent",
  third_party: "Family Member",
  child: "Child",
};

export type MessagingThreadExportThreadType =
  | "direct_message"
  | "family_channel"
  | "group_chat";

export type MessagingThreadExportEntry =
  | {
      sequence: number;
      entry_id: string;
      kind: "message";
      timestamp: string;
      sender_id: string;
      sender_name: string;
      sender_role: string;
      sender_role_label: string;
      content: string;
    }
  | {
      sequence: number;
      entry_id: string;
      kind: "system";
      timestamp: string;
      event_type: string;
      actor_id: string | null;
      actor_name: string;
      note: string;
      call_type: string | null;
    };

export interface MessagingThreadCanonicalExportPayload {
  schema_version: string;
  canonicalization_version: string;
  source_type: "message_thread";
  family_id: string;
  thread: {
    id: string;
    thread_type: MessagingThreadExportThreadType;
  };
  entries: MessagingThreadExportEntry[];
}

export interface MessagingThreadExportManifest {
  schema_version: string;
  integrity_model_version: string;
  canonicalization_version: string;
  source_type: "message_thread";
  export_id: string;
  thread_id: string;
  thread_type: MessagingThreadExportThreadType;
  thread_display_name: string;
  family_id: string;
  export_format: "json_manifest" | "pdf";
  export_generated_at: string;
  exported_by_profile_id: string;
  application_build_id: string | null;
  total_entries: number;
  total_messages: number;
  total_system_events: number;
  record_start: string | null;
  record_end: string | null;
  included_message_ids: string[];
  included_system_event_ids: string[];
  included_timeline_entry_ids: string[];
  artifact_storage_bucket: string | null;
  artifact_storage_path: string | null;
  pdf_hash_algorithm: string | null;
  pdf_artifact_hash: string | null;
  pdf_bytes_size: number | null;
  pdf_generated_at: string | null;
  pdf_storage_bucket: string | null;
  pdf_storage_path: string | null;
  verification_notes: string[];
}

export interface MessagingThreadExportReceiptPayload {
  schema_version: string;
  integrity_model_version: string;
  canonicalization_version: string;
  source_type: "message_thread";
  source_id: string;
  thread_id: string;
  thread_type: MessagingThreadExportThreadType;
  thread_display_name: string;
  family_id: string;
  export_format: "json_manifest" | "pdf";
  exported_at: string;
  created_by_user_id: string | null;
  created_by_profile_id: string;
  application_build_id: string | null;
  record_count: number;
  total_messages: number;
  total_system_events: number;
  record_start: string | null;
  record_end: string | null;
  canonical_hash_algorithm: string;
  canonical_content_hash: string;
  manifest_hash_algorithm: string;
  manifest_hash: string;
  artifact_hash_algorithm: string;
  artifact_hash: string;
  artifact_type: string;
  artifact_storage_bucket: string | null;
  artifact_storage_path: string | null;
  pdf_hash_algorithm: string | null;
  pdf_artifact_hash: string | null;
  pdf_artifact_type: string | null;
  pdf_bytes_size: number | null;
  pdf_generated_at: string | null;
  pdf_storage_bucket: string | null;
  pdf_storage_path: string | null;
  signing_key_id: string | null;
}

export interface MessagingThreadExportReceipt
  extends MessagingThreadExportReceiptPayload {
  receipt_signature_algorithm: string | null;
  receipt_signature: string | null;
}

export interface MessagingThreadExportEvidencePackage {
  package_schema_version: string;
  receipt: MessagingThreadExportReceipt;
  manifest: MessagingThreadExportManifest;
  manifest_json: string;
  canonical_payload: MessagingThreadCanonicalExportPayload;
  canonical_payload_json: string;
  artifact_payload_json: string;
  verification_instructions: string[];
}

export interface MessagingThreadExportPackage {
  canonicalPayload: MessagingThreadCanonicalExportPayload;
  canonicalPayloadJson: string;
  contentHash: string;
  manifest: MessagingThreadExportManifest;
  manifestJson: string;
  manifestHash: string;
  artifactPayloadJson: string;
  artifactHash: string;
  receiptPayload: MessagingThreadExportReceiptPayload;
  receiptPayloadJson: string;
  receipt: MessagingThreadExportReceipt;
  evidencePackage: MessagingThreadExportEvidencePackage;
  evidencePackageJson: string;
  hashAlgorithm: string;
  manifestHashAlgorithm: string;
  artifactHashAlgorithm: string;
}

export interface MessagingThreadExportParsedEvidencePackage {
  receipt: MessagingThreadExportReceipt | null;
  manifest: MessagingThreadExportManifest | null;
  manifestJson: string | null;
  canonicalPayload: MessagingThreadCanonicalExportPayload | null;
  canonicalPayloadJson: string | null;
  artifactPayloadJson: string | null;
}

export interface MessagingThreadExportVerificationResult {
  computedHash: string;
  matches: boolean;
  reason: string | null;
}

export type MessagingThreadTimelineSourceItem =
  | {
      id: string;
      kind: "message";
      timestamp: string;
      message: {
        id: string;
        created_at: string;
        sender_id: string;
        sender_name: string;
        sender_role: string;
        content: string;
      };
    }
  | {
      id: string;
      kind: "system";
      timestamp: string;
      event: {
        id: string;
        timestamp: string;
        eventType: string;
        actorId: string | null;
        actorName: string | null;
        note: string;
        callType?: string | null;
      };
    };

interface BuildMessagingThreadExportPackageArgs {
  applicationBuildId?: string | null;
  artifactStorage?: {
    bucket: string;
    path: string;
  } | null;
  exportFormat?: "json_manifest" | "pdf";
  exportId: string;
  exportedAt: string;
  exportedByUserId?: string | null;
  exportedByProfileId: string;
  familyId: string;
  pdfArtifact?: {
    bytesSize: number;
    generatedAt: string;
    hash: string;
    hashAlgorithm?: string;
    storageBucket: string;
    storagePath: string;
  } | null;
  receiptSignature?: {
    algorithm: string;
    signingKeyId?: string | null;
    value: string;
  } | null;
  thread: {
    display_name: string;
    id: string;
    thread_type: MessagingThreadExportThreadType;
  };
  timelineItems: MessagingThreadTimelineSourceItem[];
}

const normalizeRoleLabel = (role: string) => ROLE_LABELS[role] || "Member";

/**
 * Canonicalization contract for Messaging Hub evidence exports:
 * - object keys are recursively sorted before serialization
 * - arrays remain in authoritative order after deterministic sorting
 * - record ordering is timestamp ASC, then entry-id ASC, with system records
 *   before messages for same timestamp/id pairs
 * - timestamps are normalized to UTC ISO-8601 strings via Date.toISOString()
 * - nullable fields are preserved as explicit null values
 * - exporter-specific metadata, thread display labels, render formatting, and
 *   UI-only wording are excluded from the canonical content hash
 * - message content is hashed exactly as recorded; no trimming or locale-aware
 *   formatting is applied
 */
const normalizeForCanonicalJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForCanonicalJson(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeForCanonicalJson(
          (value as Record<string, unknown>)[key],
        );
        return accumulator;
      }, {});
  }

  return value;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const encodeUtf8 = (value: string) => new TextEncoder().encode(value);

const decodeBase64 = (value: string) => {
  const normalizedValue = value.trim().replace(/\s+/g, "");
  if (!normalizedValue) {
    throw new Error("A non-empty base64-encoded key is required.");
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

const encodeBase64Url = (value: ArrayBuffer) => {
  const binary = Array.from(new Uint8Array(value), (byte) =>
    String.fromCharCode(byte),
  ).join("");
  const base64 = globalThis.btoa?.(binary);
  if (!base64) {
    throw new Error("Base64 encoding is unavailable in this environment.");
  }

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const normalizeIsoTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid timestamp supplied for export canonicalization: ${value}`);
  }

  return parsedDate.toISOString();
};

export const stableStringifyForIntegrity = (value: unknown) =>
  JSON.stringify(normalizeForCanonicalJson(value));

const digestHex = async (
  algorithm: AlgorithmIdentifier,
  value: string | BufferSource,
  mode: "digest" | "sign",
  key?: CryptoKey,
) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Cryptographic integrity operations are unavailable in this environment.");
  }

  const buffer =
    mode === "digest"
      ? await subtle.digest(
          algorithm,
          typeof value === "string" ? encodeUtf8(value) : value,
        )
      : await subtle.sign(
          algorithm,
          key!,
          typeof value === "string" ? encodeUtf8(value) : value,
        );

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const sha256Hex = async (value: string) =>
  digestHex(HASH_ALGORITHM_LABEL, value, "digest");

export const sha256HexFromBytes = async (value: BufferSource) =>
  digestHex(HASH_ALGORITHM_LABEL, value, "digest");

const importLegacyReceiptSignatureKey = async (secret: string) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Cryptographic integrity operations are unavailable in this environment.");
  }

  return subtle.importKey(
    "raw",
    encodeUtf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
};

const importEd25519PrivateKey = async (privateKeyPkcs8Base64: string) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Cryptographic integrity operations are unavailable in this environment.");
  }

  return subtle.importKey(
    "pkcs8",
    decodeBase64(privateKeyPkcs8Base64),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
};

const importEd25519PublicKey = async (publicKeySpkiBase64: string) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Cryptographic integrity operations are unavailable in this environment.");
  }

  return subtle.importKey(
    "spki",
    decodeBase64(publicKeySpkiBase64),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
};

export const signMessagingThreadExportReceiptPayload = async (
  receiptPayloadJson: string,
  privateKeyPkcs8Base64: string,
) => {
  const normalizedPrivateKey = privateKeyPkcs8Base64.trim();
  if (!normalizedPrivateKey) {
    throw new Error("A non-empty server signing private key is required.");
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Cryptographic integrity operations are unavailable in this environment.");
  }

  const key = await importEd25519PrivateKey(normalizedPrivateKey);
  const signature = await subtle.sign("Ed25519", key, encodeUtf8(receiptPayloadJson));
  return encodeBase64Url(signature);
};

export const verifyMessagingThreadExportReceiptSignature = async (
  receiptPayloadJson: string,
  publicKeySpkiBase64: string,
  signature: string | null | undefined,
) => {
  if (!signature) {
    return false;
  }

  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      throw new Error("Cryptographic integrity operations are unavailable in this environment.");
    }

    const key = await importEd25519PublicKey(publicKeySpkiBase64);
    return subtle.verify(
      "Ed25519",
      key,
      decodeBase64(signature),
      encodeUtf8(receiptPayloadJson),
    );
  } catch {
    return false;
  }
};

export const signLegacyMessagingThreadExportReceiptPayload = async (
  receiptPayloadJson: string,
  secret: string,
) => {
  const normalizedSecret = secret.trim();
  if (!normalizedSecret) {
    throw new Error("A non-empty legacy server signing secret is required.");
  }

  const key = await importLegacyReceiptSignatureKey(normalizedSecret);
  return digestHex("HMAC", receiptPayloadJson, "sign", key);
};

export const verifyLegacyMessagingThreadExportReceiptSignature = async (
  receiptPayloadJson: string,
  secret: string,
  signature: string | null | undefined,
) => {
  if (!signature) {
    return false;
  }

  const computedSignature = await signLegacyMessagingThreadExportReceiptPayload(
    receiptPayloadJson,
    secret,
  );

  return computedSignature === signature;
};

export const getMessagingThreadExportReceiptPayloadJson = (
  receipt: MessagingThreadExportReceipt | MessagingThreadExportReceiptPayload,
) => {
  const {
    receipt_signature: _receiptSignature,
    receipt_signature_algorithm: _receiptSignatureAlgorithm,
    ...receiptPayload
  } = receipt as MessagingThreadExportReceipt;

  return stableStringifyForIntegrity(receiptPayload);
};

export const sortMessagingThreadTimeline = (
  timelineItems: MessagingThreadTimelineSourceItem[],
) =>
  [...timelineItems].sort((left, right) => {
    const leftTimestamp = normalizeIsoTimestamp(left.timestamp) ?? "";
    const rightTimestamp = normalizeIsoTimestamp(right.timestamp) ?? "";
    const timeDifference =
      new Date(leftTimestamp).getTime() - new Date(rightTimestamp).getTime();

    if (timeDifference !== 0) {
      return timeDifference;
    }

    if (left.kind === right.kind) {
      return left.id.localeCompare(right.id);
    }

    return left.kind === "system" ? -1 : 1;
  });

const getVerificationNotes = () => [
  "Generated from server-authoritative thread records scoped to the selected family.",
  "The canonical content hash covers the normalized record payload only. Export metadata is hashed separately in the receipt layers.",
  "The paired JSON evidence package includes the canonical payload string and receipt metadata required for later verification.",
  "The server-signed export receipt covers the canonical record hash, manifest hash, JSON evidence-package hash, and exact PDF artifact hash.",
  "The exact PDF artifact hash is computed from the final server-generated PDF bytes after rendering.",
  "The PDF file does not contain an embedded Acrobat-style digital signature. Verification is performed against the stored server-signed receipt.",
  "This export is tamper-evident evidence support. It is not notarization, legal certification, or legal advice.",
];

const getArtifactPayloadJson = (options: {
  canonicalPayload: MessagingThreadCanonicalExportPayload;
  canonicalPayloadJson: string;
  manifest: MessagingThreadExportManifest;
  manifestJson: string;
  verificationInstructions: string[];
}) =>
  stableStringifyForIntegrity({
    canonical_payload: options.canonicalPayload,
    canonical_payload_json: options.canonicalPayloadJson,
    manifest: options.manifest,
    manifest_json: options.manifestJson,
    verification_instructions: options.verificationInstructions,
  });

export const buildMessagingThreadExportPackage = async ({
  applicationBuildId = null,
  artifactStorage = null,
  exportFormat = "pdf",
  exportId,
  exportedAt,
  exportedByUserId = null,
  exportedByProfileId,
  familyId,
  pdfArtifact = null,
  receiptSignature = null,
  thread,
  timelineItems,
}: BuildMessagingThreadExportPackageArgs): Promise<MessagingThreadExportPackage> => {
  if (!familyId) {
    throw new Error("Messaging exports require an explicit family scope.");
  }

  if (!thread?.id) {
    throw new Error("Messaging exports require an active thread.");
  }

  if (!exportedByProfileId) {
    throw new Error("Messaging exports require the exporting profile id.");
  }

  if (!exportId) {
    throw new Error("Messaging exports require an export id.");
  }

  const normalizedExportedAt = normalizeIsoTimestamp(exportedAt);
  if (!normalizedExportedAt) {
    throw new Error("Messaging exports require a valid export timestamp.");
  }

  const orderedTimelineItems = sortMessagingThreadTimeline(timelineItems);
  const canonicalEntries: MessagingThreadExportEntry[] = orderedTimelineItems.map(
    (item, index) => {
      if (item.kind === "message") {
        const normalizedMessageTimestamp = normalizeIsoTimestamp(
          item.message.created_at,
        );

        if (!normalizedMessageTimestamp) {
          throw new Error("Message entries require a valid created_at timestamp.");
        }

        return {
          sequence: index + 1,
          entry_id: item.message.id,
          kind: "message",
          timestamp: normalizedMessageTimestamp,
          sender_id: item.message.sender_id,
          sender_name: item.message.sender_name,
          sender_role: item.message.sender_role,
          sender_role_label: normalizeRoleLabel(item.message.sender_role),
          content: item.message.content,
        };
      }

      const normalizedSystemTimestamp = normalizeIsoTimestamp(item.event.timestamp);
      if (!normalizedSystemTimestamp) {
        throw new Error("System entries require a valid timestamp.");
      }

      return {
        sequence: index + 1,
        entry_id: item.event.id,
        kind: "system",
        timestamp: normalizedSystemTimestamp,
        event_type: item.event.eventType,
        actor_id: item.event.actorId ?? null,
        actor_name: item.event.actorName || "System",
        note: item.event.note,
        call_type: item.event.callType ?? null,
      };
    },
  );

  const canonicalPayload: MessagingThreadCanonicalExportPayload = {
    schema_version: MESSAGING_THREAD_EXPORT_SCHEMA_VERSION,
    canonicalization_version: MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
    source_type: "message_thread",
    family_id: familyId,
    thread: {
      id: thread.id,
      thread_type: thread.thread_type,
    },
    entries: canonicalEntries,
  };

  const canonicalPayloadJson = stableStringifyForIntegrity(canonicalPayload);
  const contentHash = await sha256Hex(canonicalPayloadJson);
  const recordStart = canonicalEntries[0]?.timestamp ?? null;
  const recordEnd =
    canonicalEntries[canonicalEntries.length - 1]?.timestamp ?? null;
  const verificationNotes = getVerificationNotes();

  const manifest: MessagingThreadExportManifest = {
    schema_version: MESSAGING_THREAD_EXPORT_SCHEMA_VERSION,
    integrity_model_version: MESSAGING_THREAD_EXPORT_INTEGRITY_MODEL_VERSION,
    canonicalization_version: MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
    source_type: "message_thread",
    export_id: exportId,
    thread_id: thread.id,
    thread_type: thread.thread_type,
    thread_display_name: thread.display_name,
    family_id: familyId,
    export_format: exportFormat,
    export_generated_at: normalizedExportedAt,
    exported_by_profile_id: exportedByProfileId,
    application_build_id: applicationBuildId,
    total_entries: canonicalEntries.length,
    total_messages: canonicalEntries.filter((entry) => entry.kind === "message").length,
    total_system_events: canonicalEntries.filter((entry) => entry.kind === "system").length,
    record_start: recordStart,
    record_end: recordEnd,
    included_message_ids: canonicalEntries
      .filter((entry) => entry.kind === "message")
      .map((entry) => entry.entry_id),
    included_system_event_ids: canonicalEntries
      .filter((entry) => entry.kind === "system")
      .map((entry) => entry.entry_id),
    included_timeline_entry_ids: canonicalEntries.map((entry) => entry.entry_id),
    artifact_storage_bucket: artifactStorage?.bucket ?? null,
    artifact_storage_path: artifactStorage?.path ?? null,
    pdf_hash_algorithm: pdfArtifact?.hashAlgorithm ?? null,
    pdf_artifact_hash: pdfArtifact?.hash ?? null,
    pdf_bytes_size: pdfArtifact?.bytesSize ?? null,
    pdf_generated_at: pdfArtifact?.generatedAt ?? null,
    pdf_storage_bucket: pdfArtifact?.storageBucket ?? null,
    pdf_storage_path: pdfArtifact?.storagePath ?? null,
    verification_notes: verificationNotes,
  };

  const manifestJson = stableStringifyForIntegrity(manifest);
  const manifestHash = await sha256Hex(manifestJson);
  const artifactPayloadJson = getArtifactPayloadJson({
    canonicalPayload,
    canonicalPayloadJson,
    manifest,
    manifestJson,
    verificationInstructions: verificationNotes,
  });
  const artifactHash = await sha256Hex(artifactPayloadJson);

  const receiptPayload: MessagingThreadExportReceiptPayload = {
    schema_version: MESSAGING_THREAD_EXPORT_SCHEMA_VERSION,
    integrity_model_version: MESSAGING_THREAD_EXPORT_INTEGRITY_MODEL_VERSION,
    canonicalization_version: MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
    source_type: "message_thread",
    source_id: thread.id,
    thread_id: thread.id,
    thread_type: thread.thread_type,
    thread_display_name: thread.display_name,
    family_id: familyId,
    export_format: exportFormat,
    exported_at: normalizedExportedAt,
    created_by_user_id: exportedByUserId,
    created_by_profile_id: exportedByProfileId,
    application_build_id: applicationBuildId,
    record_count: canonicalEntries.length,
    total_messages: manifest.total_messages,
    total_system_events: manifest.total_system_events,
    record_start: recordStart,
    record_end: recordEnd,
    canonical_hash_algorithm: MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
    canonical_content_hash: contentHash,
    manifest_hash_algorithm: MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
    manifest_hash: manifestHash,
    artifact_hash_algorithm: MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
    artifact_hash: artifactHash,
    artifact_type: MESSAGING_THREAD_EXPORT_ARTIFACT_TYPE,
    artifact_storage_bucket: artifactStorage?.bucket ?? null,
    artifact_storage_path: artifactStorage?.path ?? null,
    pdf_hash_algorithm: pdfArtifact?.hashAlgorithm ?? null,
    pdf_artifact_hash: pdfArtifact?.hash ?? null,
    pdf_artifact_type: pdfArtifact ? MESSAGING_THREAD_EXPORT_PDF_ARTIFACT_TYPE : null,
    pdf_bytes_size: pdfArtifact?.bytesSize ?? null,
    pdf_generated_at: pdfArtifact?.generatedAt ?? null,
    pdf_storage_bucket: pdfArtifact?.storageBucket ?? null,
    pdf_storage_path: pdfArtifact?.storagePath ?? null,
    signing_key_id: receiptSignature?.signingKeyId ?? null,
  };

  const receiptPayloadJson = stableStringifyForIntegrity(receiptPayload);

  const receipt: MessagingThreadExportReceipt = {
    ...receiptPayload,
    receipt_signature_algorithm: receiptSignature?.algorithm ?? null,
    receipt_signature: receiptSignature?.value ?? null,
  };

  const evidencePackage: MessagingThreadExportEvidencePackage = {
    package_schema_version: MESSAGING_THREAD_EXPORT_PACKAGE_SCHEMA_VERSION,
    receipt,
    manifest,
    manifest_json: manifestJson,
    canonical_payload: canonicalPayload,
    canonical_payload_json: canonicalPayloadJson,
    artifact_payload_json: artifactPayloadJson,
    verification_instructions: verificationNotes,
  };

  return {
    canonicalPayload,
    canonicalPayloadJson,
    contentHash,
    manifest,
    manifestJson,
    manifestHash,
    artifactPayloadJson,
    artifactHash,
    receiptPayload,
    receiptPayloadJson,
    receipt,
    evidencePackage,
    evidencePackageJson: stableStringifyForIntegrity(evidencePackage),
    hashAlgorithm: MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
    manifestHashAlgorithm: MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
    artifactHashAlgorithm: MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
  };
};

export const verifyMessagingThreadExportPackage = async (
  canonicalPayload:
    | MessagingThreadCanonicalExportPayload
    | string,
  expectedReceipt:
    | Pick<
        MessagingThreadExportReceipt,
        "canonical_content_hash" | "canonical_hash_algorithm"
      >
    | {
        canonical_payload_hash: string;
        hash_algorithm: string;
      },
): Promise<MessagingThreadExportVerificationResult> => {
  const hashAlgorithm =
    "canonical_hash_algorithm" in expectedReceipt
      ? expectedReceipt.canonical_hash_algorithm
      : expectedReceipt.hash_algorithm;
  const expectedHash =
    "canonical_content_hash" in expectedReceipt
      ? expectedReceipt.canonical_content_hash
      : expectedReceipt.canonical_payload_hash;

  if (hashAlgorithm !== MESSAGING_THREAD_EXPORT_HASH_ALGORITHM) {
    return {
      computedHash: "",
      matches: false,
      reason: `Unsupported hash algorithm: ${hashAlgorithm}`,
    };
  }

  const canonicalPayloadJson =
    typeof canonicalPayload === "string"
      ? canonicalPayload
      : stableStringifyForIntegrity(canonicalPayload);
  const computedHash = await sha256Hex(canonicalPayloadJson);

  return {
    computedHash,
    matches: computedHash === expectedHash,
    reason:
      computedHash === expectedHash
        ? null
        : "Canonical payload hash does not match the stored receipt.",
  };
};

export const parseMessagingThreadEvidencePackage = (
  value: unknown,
): MessagingThreadExportParsedEvidencePackage | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const receipt = asRecord(record.receipt) as MessagingThreadExportReceipt | null;
  const manifest = asRecord(record.manifest) as MessagingThreadExportManifest | null;
  const canonicalPayload = asRecord(
    record.canonical_payload,
  ) as MessagingThreadCanonicalExportPayload | null;

  return {
    receipt,
    manifest,
    manifestJson:
      typeof record.manifest_json === "string" ? record.manifest_json : null,
    canonicalPayload,
    canonicalPayloadJson:
      typeof record.canonical_payload_json === "string"
        ? record.canonical_payload_json
        : null,
    artifactPayloadJson:
      typeof record.artifact_payload_json === "string"
        ? record.artifact_payload_json
        : null,
  };
};

export const getMessagingThreadExportPayloadJson = (value: unknown): string | null => {
  const parsedPackage = parseMessagingThreadEvidencePackage(value);
  if (parsedPackage?.canonicalPayloadJson) {
    return parsedPackage.canonicalPayloadJson;
  }

  if (parsedPackage?.canonicalPayload) {
    return stableStringifyForIntegrity(parsedPackage.canonicalPayload);
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (
    typeof record.schema_version === "string" &&
    record.source_type === "message_thread" &&
    record.thread &&
    record.entries
  ) {
    return stableStringifyForIntegrity(record);
  }

  return null;
};

export const getMessagingThreadExportManifestJson = (value: unknown): string | null => {
  const parsedPackage = parseMessagingThreadEvidencePackage(value);
  if (parsedPackage?.manifestJson) {
    return parsedPackage.manifestJson;
  }

  if (parsedPackage?.manifest) {
    return stableStringifyForIntegrity(parsedPackage.manifest);
  }

  return null;
};

export const getMessagingThreadExportArtifactPayloadJson = (
  value: unknown,
): string | null => {
  const parsedPackage = parseMessagingThreadEvidencePackage(value);
  if (parsedPackage?.artifactPayloadJson) {
    return parsedPackage.artifactPayloadJson;
  }

  if (
    parsedPackage?.canonicalPayload &&
    parsedPackage.canonicalPayloadJson &&
    parsedPackage.manifest &&
    parsedPackage.manifestJson
  ) {
    return getArtifactPayloadJson({
      canonicalPayload: parsedPackage.canonicalPayload,
      canonicalPayloadJson: parsedPackage.canonicalPayloadJson,
      manifest: parsedPackage.manifest,
      manifestJson: parsedPackage.manifestJson,
      verificationInstructions: parsedPackage.manifest.verification_notes ?? [],
    });
  }

  return null;
};
