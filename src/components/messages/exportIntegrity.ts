import type { MessageTimelineItem } from "@/components/messages/threadTimeline";
import type { MessageThread } from "@/hooks/useMessagingHub";
import { resolveSenderName } from "@/lib/displayResolver";

const EXPORT_SCHEMA_VERSION = "coparrent.messaging-thread-export/v1";
const HASH_ALGORITHM = "SHA-256";

const ROLE_LABELS: Record<string, string> = {
  guardian: "Guardian",
  parent: "Parent",
  third_party: "Family Member",
};

type CanonicalExportEntry =
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
  export_generated_at: string;
  exported_by_profile_id: string;
  family_id: string;
  thread: {
    display_name: string;
    id: string;
    thread_type: MessageThread["thread_type"];
  };
  entries: CanonicalExportEntry[];
}

export interface MessagingThreadExportManifest {
  schema_version: string;
  thread_id: string;
  thread_type: MessageThread["thread_type"];
  thread_display_name: string;
  family_id: string;
  export_generated_at: string;
  exported_by_profile_id: string;
  total_entries: number;
  total_messages: number;
  total_system_events: number;
  record_start: string | null;
  record_end: string | null;
  included_message_ids: string[];
  included_system_event_ids: string[];
  included_timeline_entry_ids: string[];
  hash_algorithm: string;
  canonical_payload_hash: string;
  verification_notes: string[];
}

export interface MessagingThreadExportPackage {
  canonicalPayload: MessagingThreadCanonicalExportPayload;
  canonicalPayloadJson: string;
  integrityHash: string;
  manifest: MessagingThreadExportManifest;
}

interface BuildMessagingThreadExportPackageArgs {
  activeFamilyId: string;
  activeThread: MessageThread;
  exportedAt: string;
  exportedByProfileId: string;
  timelineItems: MessageTimelineItem[];
}

const getThreadDisplayName = (thread: MessageThread) => {
  if (thread.thread_type === "family_channel") {
    return "Family Channel";
  }

  if (thread.thread_type === "group_chat") {
    return thread.name || "Group Chat";
  }

  return (
    thread.other_participant?.full_name ||
    thread.other_participant?.email ||
    "Direct Message"
  );
};

const getRoleLabel = (role: string) => ROLE_LABELS[role] || "Member";

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

export const stableStringifyForIntegrity = (value: unknown) =>
  JSON.stringify(normalizeForCanonicalJson(value));

const sha256Hex = async (value: string) => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("SHA-256 hashing is unavailable in this environment.");
  }

  const digest = await globalThis.crypto.subtle.digest(
    HASH_ALGORITHM,
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const sortTimelineItems = (timelineItems: MessageTimelineItem[]) =>
  [...timelineItems].sort((left, right) => {
    const timeDifference =
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();

    if (timeDifference !== 0) {
      return timeDifference;
    }

    if (left.kind === right.kind) {
      return left.id.localeCompare(right.id);
    }

    return left.kind === "system" ? -1 : 1;
  });

export const buildMessagingThreadExportPackage = async ({
  activeFamilyId,
  activeThread,
  exportedAt,
  exportedByProfileId,
  timelineItems,
}: BuildMessagingThreadExportPackageArgs): Promise<MessagingThreadExportPackage> => {
  if (!activeFamilyId) {
    throw new Error("Messaging exports require an active family scope.");
  }

  if (!activeThread?.id) {
    throw new Error("Messaging exports require an active thread.");
  }

  if (!exportedByProfileId) {
    throw new Error("Messaging exports require the exporting profile id.");
  }

  const orderedTimelineItems = sortTimelineItems(timelineItems);
  const canonicalEntries: CanonicalExportEntry[] = orderedTimelineItems.map(
    (item, index) => {
      if (item.kind === "message") {
        return {
          sequence: index + 1,
          entry_id: item.message.id,
          kind: "message",
          timestamp: item.message.created_at,
          sender_id: item.message.sender_id,
          sender_name: resolveSenderName(item.message.sender_name),
          sender_role: item.message.sender_role,
          sender_role_label: getRoleLabel(item.message.sender_role),
          content: item.message.content,
        };
      }

      return {
        sequence: index + 1,
        entry_id: item.event.id,
        kind: "system",
        timestamp: item.event.timestamp,
        event_type: item.event.eventType,
        actor_id: item.event.actorId,
        actor_name: item.event.actorName
          ? resolveSenderName(item.event.actorName, undefined)
          : "System",
        note: item.event.note,
        call_type: item.event.callType ?? null,
      };
    },
  );

  const canonicalPayload: MessagingThreadCanonicalExportPayload = {
    schema_version: EXPORT_SCHEMA_VERSION,
    export_generated_at: exportedAt,
    exported_by_profile_id: exportedByProfileId,
    family_id: activeFamilyId,
    thread: {
      display_name: getThreadDisplayName(activeThread),
      id: activeThread.id,
      thread_type: activeThread.thread_type,
    },
    entries: canonicalEntries,
  };

  const canonicalPayloadJson = stableStringifyForIntegrity(canonicalPayload);
  const integrityHash = await sha256Hex(canonicalPayloadJson);
  const recordStart = canonicalEntries[0]?.timestamp ?? null;
  const recordEnd =
    canonicalEntries[canonicalEntries.length - 1]?.timestamp ?? null;

  const manifest: MessagingThreadExportManifest = {
    schema_version: EXPORT_SCHEMA_VERSION,
    thread_id: activeThread.id,
    thread_type: activeThread.thread_type,
    thread_display_name: getThreadDisplayName(activeThread),
    family_id: activeFamilyId,
    export_generated_at: exportedAt,
    exported_by_profile_id: exportedByProfileId,
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
    hash_algorithm: HASH_ALGORITHM,
    canonical_payload_hash: integrityHash,
    verification_notes: [
      "This hash covers the canonical export payload generated from the recorded thread at export time.",
      "Recompute the same SHA-256 hash from the canonical payload to detect post-export changes to the exported record package.",
      "This export is tamper-evident metadata, not a server-issued signature or legal admissibility guarantee.",
    ],
  };

  return {
    canonicalPayload,
    canonicalPayloadJson,
    integrityHash,
    manifest,
  };
};

export const verifyMessagingThreadExportPackage = async (
  canonicalPayload: MessagingThreadCanonicalExportPayload,
  manifest: Pick<
    MessagingThreadExportManifest,
    "canonical_payload_hash" | "hash_algorithm"
  >,
) => {
  if (manifest.hash_algorithm !== HASH_ALGORITHM) {
    return {
      computedHash: null,
      matches: false,
      reason: `Unsupported hash algorithm: ${manifest.hash_algorithm}`,
    };
  }

  const canonicalPayloadJson = stableStringifyForIntegrity(canonicalPayload);
  const computedHash = await sha256Hex(canonicalPayloadJson);

  return {
    computedHash,
    matches: computedHash === manifest.canonical_payload_hash,
    reason:
      computedHash === manifest.canonical_payload_hash
        ? null
        : "Canonical payload hash does not match the manifest.",
  };
};
