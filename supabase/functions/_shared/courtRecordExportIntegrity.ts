import {
  MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
  MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM,
  sha256Hex,
  signMessagingThreadExportReceiptPayload,
  stableStringifyForIntegrity,
  verifyMessagingThreadExportReceiptSignature,
} from "./messagingThreadExportIntegrity.ts";

export const COURT_RECORD_EXPORT_SCHEMA_VERSION =
  "coparrent.family-court-record-export/v1";
export const COURT_RECORD_EXPORT_INTEGRITY_MODEL_VERSION =
  "coparrent.family-court-record-export-receipt/v1";
export const COURT_RECORD_EXPORT_CANONICALIZATION_VERSION =
  "coparrent.family-court-record-export-canonical/v1";
export const COURT_RECORD_EXPORT_PACKAGE_SCHEMA_VERSION =
  "coparrent.family-court-record-export-package/v1";
export const COURT_RECORD_EXPORT_HASH_ALGORITHM =
  MESSAGING_THREAD_EXPORT_HASH_ALGORITHM;
export const COURT_RECORD_EXPORT_SIGNATURE_ALGORITHM =
  MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM;
export const COURT_RECORD_EXPORT_ARTIFACT_TYPE = "json_evidence_package";
export const COURT_RECORD_EXPORT_PDF_ARTIFACT_TYPE =
  "server_generated_pdf_artifact";

export type FamilyCourtRecordExportSection =
  | "call_activity"
  | "children"
  | "document_access_logs"
  | "document_references"
  | "exchange_checkins"
  | "expenses"
  | "messages"
  | "schedule_overview"
  | "schedule_requests";

export interface FamilyCourtRecordParticipant {
  email: string | null;
  full_name: string | null;
  membership_role: string;
  profile_id: string;
}

export interface FamilyCourtRecordChild {
  id: string;
  name: string;
}

export interface FamilyCourtRecordMessageEntry {
  content: string;
  created_at: string;
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  thread_id: string;
  thread_name: string | null;
  thread_type: string;
}

export interface FamilyCourtRecordCallEventEntry {
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
  event_type: string;
  id: string;
  payload: Record<string, unknown>;
}

export interface FamilyCourtRecordCallSessionEntry {
  answered_at: string | null;
  call_type: string;
  callee_display_name: string | null;
  callee_profile_id: string;
  created_at: string;
  ended_at: string | null;
  failed_reason: string | null;
  id: string;
  initiator_display_name: string | null;
  initiator_profile_id: string;
  source: string;
  status: string;
  thread_id: string | null;
  events: FamilyCourtRecordCallEventEntry[];
}

export interface FamilyCourtRecordDocumentReference {
  category: string;
  child_name: string | null;
  created_at: string;
  description: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  id: string;
  title: string;
  uploaded_by_name: string | null;
}

export interface FamilyCourtRecordDocumentAccessLog {
  accessed_by_name: string | null;
  action: string;
  created_at: string;
  document_id: string;
  document_title: string;
  id: string;
}

export interface FamilyCourtRecordExpense {
  amount: number;
  category: string;
  child_name: string | null;
  created_at: string;
  description: string;
  expense_date: string;
  id: string;
  notes: string | null;
  split_percentage: number | null;
}

export interface FamilyCourtRecordScheduleRequest {
  created_at: string;
  id: string;
  original_date: string;
  proposed_date: string | null;
  reason: string | null;
  recipient_name: string | null;
  requester_name: string | null;
  request_type: string;
  status: string;
  updated_at: string;
}

export interface FamilyCourtRecordExchangeCheckin {
  checked_in_at: string;
  exchange_date: string;
  id: string;
  note: string | null;
  user_name: string | null;
}

export interface FamilyCourtRecordScheduleOverview {
  exchange_location: string | null;
  exchange_time: string | null;
  holidays: unknown;
  id: string;
  pattern: string;
  start_date: string;
}

export interface FamilyCourtRecordCanonicalExportPayload {
  schema_version: string;
  canonicalization_version: string;
  source_type: "family_unified";
  export_scope: "family_unified";
  family_id: string;
  requested_range: {
    start: string;
    end: string;
  };
  included_sections: FamilyCourtRecordExportSection[];
  parties: FamilyCourtRecordParticipant[];
  children: FamilyCourtRecordChild[];
  messages: FamilyCourtRecordMessageEntry[];
  call_activity: FamilyCourtRecordCallSessionEntry[];
  document_references: FamilyCourtRecordDocumentReference[];
  document_access_logs: FamilyCourtRecordDocumentAccessLog[];
  expenses: FamilyCourtRecordExpense[];
  schedule_requests: FamilyCourtRecordScheduleRequest[];
  exchange_checkins: FamilyCourtRecordExchangeCheckin[];
  schedule_overview: FamilyCourtRecordScheduleOverview | null;
}

export interface FamilyCourtRecordExportCounts {
  call_activity: number;
  children: number;
  document_access_logs: number;
  document_references: number;
  exchange_checkins: number;
  expenses: number;
  messages: number;
  schedule_overview: number;
  schedule_requests: number;
  total_records: number;
}

export interface FamilyCourtRecordExportManifest {
  schema_version: string;
  integrity_model_version: string;
  canonicalization_version: string;
  source_type: "family_unified";
  export_scope: "family_unified";
  export_id: string;
  family_id: string;
  export_format: "json_manifest" | "pdf";
  export_generated_at: string;
  exported_by_profile_id: string;
  application_build_id: string | null;
  requested_range_start: string;
  requested_range_end: string;
  record_start: string | null;
  record_end: string | null;
  included_sections: FamilyCourtRecordExportSection[];
  counts: FamilyCourtRecordExportCounts;
  artifact_storage_provider: string | null;
  artifact_storage_bucket: string | null;
  artifact_storage_path: string | null;
  pdf_hash_algorithm: string | null;
  pdf_artifact_hash: string | null;
  pdf_bytes_size: number | null;
  pdf_generated_at: string | null;
  pdf_storage_provider: string | null;
  pdf_storage_bucket: string | null;
  pdf_storage_path: string | null;
  verification_notes: string[];
}

export interface FamilyCourtRecordExportReceiptPayload {
  schema_version: string;
  integrity_model_version: string;
  canonicalization_version: string;
  source_type: "family_unified";
  export_scope: "family_unified";
  family_id: string;
  export_format: "json_manifest" | "pdf";
  exported_at: string;
  created_by_user_id: string | null;
  created_by_profile_id: string;
  application_build_id: string | null;
  requested_range_start: string;
  requested_range_end: string;
  record_start: string | null;
  record_end: string | null;
  included_sections: FamilyCourtRecordExportSection[];
  counts: FamilyCourtRecordExportCounts;
  canonical_hash_algorithm: string;
  canonical_content_hash: string;
  manifest_hash_algorithm: string;
  manifest_hash: string;
  artifact_hash_algorithm: string;
  artifact_hash: string;
  artifact_type: string;
  artifact_storage_provider: string | null;
  artifact_storage_bucket: string | null;
  artifact_storage_path: string | null;
  pdf_hash_algorithm: string | null;
  pdf_artifact_hash: string | null;
  pdf_artifact_type: string | null;
  pdf_bytes_size: number | null;
  pdf_generated_at: string | null;
  pdf_storage_provider: string | null;
  pdf_storage_bucket: string | null;
  pdf_storage_path: string | null;
  signing_key_id: string | null;
}

export interface FamilyCourtRecordExportReceipt
  extends FamilyCourtRecordExportReceiptPayload {
  receipt_signature_algorithm: string | null;
  receipt_signature: string | null;
}

export interface FamilyCourtRecordExportEvidencePackage {
  package_schema_version: string;
  receipt: FamilyCourtRecordExportReceipt;
  manifest: FamilyCourtRecordExportManifest;
  manifest_json: string;
  canonical_payload: FamilyCourtRecordCanonicalExportPayload;
  canonical_payload_json: string;
  artifact_payload_json: string;
  verification_instructions: string[];
}

export interface FamilyCourtRecordExportPackage {
  artifactHash: string;
  artifactHashAlgorithm: string;
  artifactPayloadJson: string;
  canonicalPayload: FamilyCourtRecordCanonicalExportPayload;
  canonicalPayloadJson: string;
  contentHash: string;
  counts: FamilyCourtRecordExportCounts;
  evidencePackage: FamilyCourtRecordExportEvidencePackage;
  evidencePackageJson: string;
  hashAlgorithm: string;
  manifest: FamilyCourtRecordExportManifest;
  manifestHash: string;
  manifestHashAlgorithm: string;
  manifestJson: string;
  receipt: FamilyCourtRecordExportReceipt;
  receiptPayload: FamilyCourtRecordExportReceiptPayload;
  receiptPayloadJson: string;
}

export interface FamilyCourtRecordVerificationResult {
  computedHash: string;
  matches: boolean;
  reason: string | null;
}

interface BuildFamilyCourtRecordExportPackageArgs {
  applicationBuildId?: string | null;
  artifactStorage?: {
    bucket: string;
    key: string;
    provider?: string | null;
  } | null;
  canonicalPayloadData: Omit<
    FamilyCourtRecordCanonicalExportPayload,
    | "schema_version"
    | "canonicalization_version"
    | "source_type"
    | "export_scope"
    | "family_id"
    | "requested_range"
    | "included_sections"
  >;
  exportFormat?: "json_manifest" | "pdf";
  exportId: string;
  exportedAt: string;
  exportedByProfileId: string;
  exportedByUserId?: string | null;
  familyId: string;
  includedSections: FamilyCourtRecordExportSection[];
  pdfArtifact?: {
    bytesSize: number;
    generatedAt: string;
    hash: string;
    hashAlgorithm?: string;
    storageBucket: string;
    storageKey: string;
    storageProvider?: string | null;
  } | null;
  receiptSignature?: {
    algorithm: string;
    signingKeyId?: string | null;
    value: string;
  } | null;
  requestedRange: {
    start: string;
    end: string;
  };
}

type ParsedFamilyCourtRecordEvidencePackage = {
  artifactPayloadJson: string | null;
  canonicalPayload: FamilyCourtRecordCanonicalExportPayload | null;
  canonicalPayloadJson: string | null;
  manifest: FamilyCourtRecordExportManifest | null;
  manifestJson: string | null;
  receipt: FamilyCourtRecordExportReceipt | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getVerificationNotes = () => [
  "Generated from server-authoritative family records scoped to the requested family_id.",
  "Messages, call events, document references, schedules, exchanges, expenses, and children are assembled on the server for the selected range and sections only.",
  "Call evidence is represented as persisted session and event history only. No recordings or transcripts are included.",
  "Raw document binaries are excluded from this export package. Document references and access history are included instead.",
  "The server-signed export receipt covers the canonical content hash, manifest hash, JSON evidence-package hash, and exact PDF artifact hash.",
  "Storage-level write-once behavior is enforced by immutable object storage for newly generated artifacts.",
  "This export is evidence support and tamper-evident verification tooling. It is not legal advice or legal certification.",
];

const getRecordTimestamps = (
  payload: Omit<
    FamilyCourtRecordCanonicalExportPayload,
    | "schema_version"
    | "canonicalization_version"
    | "source_type"
    | "export_scope"
    | "family_id"
    | "requested_range"
    | "included_sections"
  >,
) => {
  const timestamps: string[] = [];

  payload.messages.forEach((record) => timestamps.push(record.created_at));
  payload.call_activity.forEach((record) => {
    timestamps.push(record.created_at);
    if (record.answered_at) {
      timestamps.push(record.answered_at);
    }
    if (record.ended_at) {
      timestamps.push(record.ended_at);
    }
    record.events.forEach((event) => timestamps.push(event.created_at));
  });
  payload.document_references.forEach((record) => timestamps.push(record.created_at));
  payload.document_access_logs.forEach((record) => timestamps.push(record.created_at));
  payload.expenses.forEach((record) => {
    timestamps.push(record.created_at);
    timestamps.push(record.expense_date);
  });
  payload.schedule_requests.forEach((record) => {
    timestamps.push(record.created_at);
    timestamps.push(record.updated_at);
  });
  payload.exchange_checkins.forEach((record) => {
    timestamps.push(record.exchange_date);
    timestamps.push(record.checked_in_at);
  });
  if (payload.schedule_overview?.start_date) {
    timestamps.push(payload.schedule_overview.start_date);
  }

  const normalized = timestamps
    .map((value) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    })
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right));

  return {
    recordEnd: normalized.at(-1) ?? null,
    recordStart: normalized[0] ?? null,
  };
};

const buildCounts = (
  payload: Omit<
    FamilyCourtRecordCanonicalExportPayload,
    | "schema_version"
    | "canonicalization_version"
    | "source_type"
    | "export_scope"
    | "family_id"
    | "requested_range"
    | "included_sections"
  >,
): FamilyCourtRecordExportCounts => {
  const counts = {
    call_activity: payload.call_activity.length,
    children: payload.children.length,
    document_access_logs: payload.document_access_logs.length,
    document_references: payload.document_references.length,
    exchange_checkins: payload.exchange_checkins.length,
    expenses: payload.expenses.length,
    messages: payload.messages.length,
    schedule_overview: payload.schedule_overview ? 1 : 0,
    schedule_requests: payload.schedule_requests.length,
    total_records: 0,
  };

  counts.total_records =
    counts.call_activity +
    counts.children +
    counts.document_access_logs +
    counts.document_references +
    counts.exchange_checkins +
    counts.expenses +
    counts.messages +
    counts.schedule_overview +
    counts.schedule_requests;

  return counts;
};

const getArtifactPayloadJson = (options: {
  canonicalPayload: FamilyCourtRecordCanonicalExportPayload;
  canonicalPayloadJson: string;
  manifest: FamilyCourtRecordExportManifest;
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

export const buildFamilyCourtRecordExportPackage = async ({
  applicationBuildId = null,
  artifactStorage = null,
  canonicalPayloadData,
  exportFormat = "pdf",
  exportId,
  exportedAt,
  exportedByProfileId,
  exportedByUserId = null,
  familyId,
  includedSections,
  pdfArtifact = null,
  receiptSignature = null,
  requestedRange,
}: BuildFamilyCourtRecordExportPackageArgs): Promise<FamilyCourtRecordExportPackage> => {
  const verificationNotes = getVerificationNotes();
  const counts = buildCounts(canonicalPayloadData);
  const { recordEnd, recordStart } = getRecordTimestamps(canonicalPayloadData);

  const canonicalPayload: FamilyCourtRecordCanonicalExportPayload = {
    schema_version: COURT_RECORD_EXPORT_SCHEMA_VERSION,
    canonicalization_version: COURT_RECORD_EXPORT_CANONICALIZATION_VERSION,
    source_type: "family_unified",
    export_scope: "family_unified",
    family_id: familyId,
    requested_range: requestedRange,
    included_sections: [...includedSections],
    ...canonicalPayloadData,
  };

  const canonicalPayloadJson = stableStringifyForIntegrity(canonicalPayload);
  const contentHash = await sha256Hex(canonicalPayloadJson);

  const manifest: FamilyCourtRecordExportManifest = {
    schema_version: COURT_RECORD_EXPORT_SCHEMA_VERSION,
    integrity_model_version: COURT_RECORD_EXPORT_INTEGRITY_MODEL_VERSION,
    canonicalization_version: COURT_RECORD_EXPORT_CANONICALIZATION_VERSION,
    source_type: "family_unified",
    export_scope: "family_unified",
    export_id: exportId,
    family_id: familyId,
    export_format: exportFormat,
    export_generated_at: exportedAt,
    exported_by_profile_id: exportedByProfileId,
    application_build_id: applicationBuildId,
    requested_range_start: requestedRange.start,
    requested_range_end: requestedRange.end,
    record_start: recordStart,
    record_end: recordEnd,
    included_sections: [...includedSections],
    counts,
    artifact_storage_provider: artifactStorage?.provider ?? null,
    artifact_storage_bucket: artifactStorage?.bucket ?? null,
    artifact_storage_path: artifactStorage?.key ?? null,
    pdf_hash_algorithm: pdfArtifact?.hashAlgorithm ?? null,
    pdf_artifact_hash: pdfArtifact?.hash ?? null,
    pdf_bytes_size: pdfArtifact?.bytesSize ?? null,
    pdf_generated_at: pdfArtifact?.generatedAt ?? null,
    pdf_storage_provider: pdfArtifact?.storageProvider ?? null,
    pdf_storage_bucket: pdfArtifact?.storageBucket ?? null,
    pdf_storage_path: pdfArtifact?.storageKey ?? null,
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

  const receiptPayload: FamilyCourtRecordExportReceiptPayload = {
    schema_version: COURT_RECORD_EXPORT_SCHEMA_VERSION,
    integrity_model_version: COURT_RECORD_EXPORT_INTEGRITY_MODEL_VERSION,
    canonicalization_version: COURT_RECORD_EXPORT_CANONICALIZATION_VERSION,
    source_type: "family_unified",
    export_scope: "family_unified",
    family_id: familyId,
    export_format: exportFormat,
    exported_at: exportedAt,
    created_by_user_id: exportedByUserId,
    created_by_profile_id: exportedByProfileId,
    application_build_id: applicationBuildId,
    requested_range_start: requestedRange.start,
    requested_range_end: requestedRange.end,
    record_start: recordStart,
    record_end: recordEnd,
    included_sections: [...includedSections],
    counts,
    canonical_hash_algorithm: COURT_RECORD_EXPORT_HASH_ALGORITHM,
    canonical_content_hash: contentHash,
    manifest_hash_algorithm: COURT_RECORD_EXPORT_HASH_ALGORITHM,
    manifest_hash: manifestHash,
    artifact_hash_algorithm: COURT_RECORD_EXPORT_HASH_ALGORITHM,
    artifact_hash: artifactHash,
    artifact_type: COURT_RECORD_EXPORT_ARTIFACT_TYPE,
    artifact_storage_provider: artifactStorage?.provider ?? null,
    artifact_storage_bucket: artifactStorage?.bucket ?? null,
    artifact_storage_path: artifactStorage?.key ?? null,
    pdf_hash_algorithm: pdfArtifact?.hashAlgorithm ?? null,
    pdf_artifact_hash: pdfArtifact?.hash ?? null,
    pdf_artifact_type: pdfArtifact ? COURT_RECORD_EXPORT_PDF_ARTIFACT_TYPE : null,
    pdf_bytes_size: pdfArtifact?.bytesSize ?? null,
    pdf_generated_at: pdfArtifact?.generatedAt ?? null,
    pdf_storage_provider: pdfArtifact?.storageProvider ?? null,
    pdf_storage_bucket: pdfArtifact?.storageBucket ?? null,
    pdf_storage_path: pdfArtifact?.storageKey ?? null,
    signing_key_id: receiptSignature?.signingKeyId ?? null,
  };

  const receiptPayloadJson = stableStringifyForIntegrity(receiptPayload);
  const receipt: FamilyCourtRecordExportReceipt = {
    ...receiptPayload,
    receipt_signature_algorithm: receiptSignature?.algorithm ?? null,
    receipt_signature: receiptSignature?.value ?? null,
  };

  const evidencePackage: FamilyCourtRecordExportEvidencePackage = {
    package_schema_version: COURT_RECORD_EXPORT_PACKAGE_SCHEMA_VERSION,
    receipt,
    manifest,
    manifest_json: manifestJson,
    canonical_payload: canonicalPayload,
    canonical_payload_json: canonicalPayloadJson,
    artifact_payload_json: artifactPayloadJson,
    verification_instructions: verificationNotes,
  };

  return {
    artifactHash,
    artifactHashAlgorithm: COURT_RECORD_EXPORT_HASH_ALGORITHM,
    artifactPayloadJson,
    canonicalPayload,
    canonicalPayloadJson,
    contentHash,
    counts,
    evidencePackage,
    evidencePackageJson: stableStringifyForIntegrity(evidencePackage),
    hashAlgorithm: COURT_RECORD_EXPORT_HASH_ALGORITHM,
    manifest,
    manifestHash,
    manifestHashAlgorithm: COURT_RECORD_EXPORT_HASH_ALGORITHM,
    manifestJson,
    receipt,
    receiptPayload,
    receiptPayloadJson,
  };
};

export const signFamilyCourtRecordExportReceiptPayload = (
  receiptPayloadJson: string,
  privateKeyPkcs8Base64: string,
) => signMessagingThreadExportReceiptPayload(receiptPayloadJson, privateKeyPkcs8Base64);

export const verifyFamilyCourtRecordExportReceiptSignature = (
  receiptPayloadJson: string,
  publicKeySpkiBase64: string,
  signature: string | null | undefined,
) =>
  verifyMessagingThreadExportReceiptSignature(
    receiptPayloadJson,
    publicKeySpkiBase64,
    signature,
  );

export const verifyFamilyCourtRecordExportPackage = async (
  canonicalPayload:
    | FamilyCourtRecordCanonicalExportPayload
    | string,
  expectedReceipt: Pick<
    FamilyCourtRecordExportReceipt,
    "canonical_content_hash" | "canonical_hash_algorithm"
  >,
): Promise<FamilyCourtRecordVerificationResult> => {
  if (expectedReceipt.canonical_hash_algorithm !== COURT_RECORD_EXPORT_HASH_ALGORITHM) {
    return {
      computedHash: "",
      matches: false,
      reason: `Unsupported hash algorithm: ${expectedReceipt.canonical_hash_algorithm}`,
    };
  }

  const canonicalPayloadJson =
    typeof canonicalPayload === "string"
      ? canonicalPayload
      : stableStringifyForIntegrity(canonicalPayload);
  const computedHash = await sha256Hex(canonicalPayloadJson);

  return {
    computedHash,
    matches: computedHash === expectedReceipt.canonical_content_hash,
    reason:
      computedHash === expectedReceipt.canonical_content_hash
        ? null
        : "Canonical payload hash does not match the stored receipt.",
  };
};

export const getFamilyCourtRecordReceiptPayloadJson = (
  receiptPayload:
    | FamilyCourtRecordExportReceipt
    | FamilyCourtRecordExportReceiptPayload,
) => {
  const {
    receipt_signature: _receiptSignature,
    receipt_signature_algorithm: _receiptSignatureAlgorithm,
    ...normalizedPayload
  } = receiptPayload as FamilyCourtRecordExportReceipt;

  return stableStringifyForIntegrity(normalizedPayload);
};

export const parseFamilyCourtRecordEvidencePackage = (
  value: unknown,
): ParsedFamilyCourtRecordEvidencePackage | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return {
    artifactPayloadJson:
      typeof record.artifact_payload_json === "string"
        ? record.artifact_payload_json
        : null,
    canonicalPayload:
      asRecord(record.canonical_payload) as FamilyCourtRecordCanonicalExportPayload | null,
    canonicalPayloadJson:
      typeof record.canonical_payload_json === "string"
        ? record.canonical_payload_json
        : null,
    manifest:
      asRecord(record.manifest) as FamilyCourtRecordExportManifest | null,
    manifestJson:
      typeof record.manifest_json === "string" ? record.manifest_json : null,
    receipt:
      asRecord(record.receipt) as FamilyCourtRecordExportReceipt | null,
  };
};

export const getFamilyCourtRecordPayloadJson = (value: unknown): string | null => {
  const parsedPackage = parseFamilyCourtRecordEvidencePackage(value);
  if (parsedPackage?.canonicalPayloadJson) {
    return parsedPackage.canonicalPayloadJson;
  }

  if (parsedPackage?.canonicalPayload) {
    return stableStringifyForIntegrity(parsedPackage.canonicalPayload);
  }

  const record = asRecord(value);
  if (
    record &&
    typeof record.schema_version === "string" &&
    record.source_type === "family_unified"
  ) {
    return stableStringifyForIntegrity(record);
  }

  return null;
};

export const getFamilyCourtRecordManifestJson = (value: unknown): string | null => {
  const parsedPackage = parseFamilyCourtRecordEvidencePackage(value);
  if (parsedPackage?.manifestJson) {
    return parsedPackage.manifestJson;
  }

  if (parsedPackage?.manifest) {
    return stableStringifyForIntegrity(parsedPackage.manifest);
  }

  return null;
};

export const getFamilyCourtRecordArtifactPayloadJson = (value: unknown): string | null => {
  const parsedPackage = parseFamilyCourtRecordEvidencePackage(value);
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
      verificationInstructions:
        parsedPackage.manifest.verification_notes ?? [],
    });
  }

  return null;
};
