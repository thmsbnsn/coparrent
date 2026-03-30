import { beforeAll, describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import type { MessageTimelineItem } from "@/components/messages/threadTimeline";
import {
  buildMessagingThreadExportPackage,
  stableStringifyForIntegrity,
  verifyMessagingThreadExportPackage,
} from "@/components/messages/exportIntegrity";
import type { MessageThread } from "@/hooks/useMessagingHub";

beforeAll(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: webcrypto,
    });
  }
});

const activeThread: MessageThread = {
  created_at: "2026-03-30T13:00:00.000Z",
  id: "thread-direct-jessica",
  name: null,
  other_participant: {
    email: "jessica@example.com",
    full_name: "Jessica Morgan",
    id: "profile-jessica",
    role: "parent",
  },
  participant_a_id: "profile-jessica",
  participant_b_id: "profile-taylor",
  primary_parent_id: "primary-parent",
  thread_type: "direct_message",
};

const timelineItems: MessageTimelineItem[] = [
  {
    event: {
      actorId: null,
      actorName: null,
      eventType: "conversation_started",
      id: "system-conversation-started",
      note: "This direct conversation is active and ready for documented communication.",
      timestamp: "2026-03-30T13:00:00.000Z",
      type: "system",
    },
    id: "system-conversation-started",
    kind: "system",
    timestamp: "2026-03-30T13:00:00.000Z",
  },
  {
    id: "message-1",
    kind: "message",
    message: {
      content: "Can we confirm pickup for tomorrow at 5:30 PM?",
      created_at: "2026-03-30T13:04:00.000Z",
      id: "message-1",
      is_from_me: false,
      read_by: [],
      sender_id: "profile-jessica",
      sender_name: "Jessica Morgan",
      sender_role: "parent",
      thread_id: "thread-direct-jessica",
    },
    timestamp: "2026-03-30T13:04:00.000Z",
  },
  {
    id: "message-2",
    kind: "message",
    message: {
      content: "Confirmed. I will be there at 5:30 PM.",
      created_at: "2026-03-30T13:06:00.000Z",
      id: "message-2",
      is_from_me: true,
      read_by: [],
      sender_id: "profile-taylor",
      sender_name: "Taylor Parent",
      sender_role: "parent",
      thread_id: "thread-direct-jessica",
    },
    timestamp: "2026-03-30T13:06:00.000Z",
  },
];

describe("buildMessagingThreadExportPackage", () => {
  it("builds a deterministic canonical payload and hash for identical inputs", async () => {
    const exportedAt = "2026-03-30T14:00:00.000Z";

    const firstExport = await buildMessagingThreadExportPackage({
      activeFamilyId: "family-1",
      activeThread,
      exportedAt,
      exportedByProfileId: "profile-taylor",
      timelineItems,
    });

    const secondExport = await buildMessagingThreadExportPackage({
      activeFamilyId: "family-1",
      activeThread,
      exportedAt,
      exportedByProfileId: "profile-taylor",
      timelineItems,
    });

    expect(firstExport.canonicalPayloadJson).toBe(secondExport.canonicalPayloadJson);
    expect(firstExport.integrityHash).toBe(secondExport.integrityHash);
    expect(stableStringifyForIntegrity(firstExport.canonicalPayload)).toBe(
      firstExport.canonicalPayloadJson,
    );
  });

  it("changes the hash when the exported record content changes", async () => {
    const exportedAt = "2026-03-30T14:00:00.000Z";
    const messageToEdit = timelineItems[2];

    if (messageToEdit.kind !== "message") {
      throw new Error("Expected the third timeline item to be a message.");
    }

    const originalExport = await buildMessagingThreadExportPackage({
      activeFamilyId: "family-1",
      activeThread,
      exportedAt,
      exportedByProfileId: "profile-taylor",
      timelineItems,
    });

    const changedTimelineItems: MessageTimelineItem[] = [
      ...timelineItems.slice(0, 2),
      {
        ...messageToEdit,
        message: {
          ...messageToEdit.message,
          content: "Confirmed. I will be there at 6:00 PM instead.",
        },
      },
    ];

    const changedExport = await buildMessagingThreadExportPackage({
      activeFamilyId: "family-1",
      activeThread,
      exportedAt,
      exportedByProfileId: "profile-taylor",
      timelineItems: changedTimelineItems,
    });

    expect(changedExport.integrityHash).not.toBe(originalExport.integrityHash);
  });

  it("produces a manifest with the record range and included ids", async () => {
    const exportPackage = await buildMessagingThreadExportPackage({
      activeFamilyId: "family-1",
      activeThread,
      exportedAt: "2026-03-30T14:00:00.000Z",
      exportedByProfileId: "profile-taylor",
      timelineItems,
    });

    expect(exportPackage.manifest).toMatchObject({
      canonical_payload_hash: exportPackage.integrityHash,
      export_generated_at: "2026-03-30T14:00:00.000Z",
      family_id: "family-1",
      hash_algorithm: "SHA-256",
      record_end: "2026-03-30T13:06:00.000Z",
      record_start: "2026-03-30T13:00:00.000Z",
      thread_display_name: "Jessica Morgan",
      thread_id: "thread-direct-jessica",
      thread_type: "direct_message",
      total_entries: 3,
      total_messages: 2,
      total_system_events: 1,
    });

    expect(exportPackage.manifest.included_message_ids).toEqual([
      "message-1",
      "message-2",
    ]);
    expect(exportPackage.manifest.included_system_event_ids).toEqual([
      "system-conversation-started",
    ]);
    expect(exportPackage.manifest.verification_notes).toHaveLength(3);
  });
});

describe("verifyMessagingThreadExportPackage", () => {
  it("confirms the manifest hash for an unchanged canonical payload", async () => {
    const exportPackage = await buildMessagingThreadExportPackage({
      activeFamilyId: "family-1",
      activeThread,
      exportedAt: "2026-03-30T14:00:00.000Z",
      exportedByProfileId: "profile-taylor",
      timelineItems,
    });

    const verificationResult = await verifyMessagingThreadExportPackage(
      exportPackage.canonicalPayload,
      exportPackage.manifest,
    );

    expect(verificationResult).toEqual({
      computedHash: exportPackage.integrityHash,
      matches: true,
      reason: null,
    });
  });

  it("detects when the canonical payload no longer matches the manifest", async () => {
    const exportPackage = await buildMessagingThreadExportPackage({
      activeFamilyId: "family-1",
      activeThread,
      exportedAt: "2026-03-30T14:00:00.000Z",
      exportedByProfileId: "profile-taylor",
      timelineItems,
    });

    const verificationResult = await verifyMessagingThreadExportPackage(
      {
        ...exportPackage.canonicalPayload,
        entries: exportPackage.canonicalPayload.entries.map((entry) =>
          entry.kind === "message" && entry.entry_id === "message-2"
            ? { ...entry, content: "Modified after export" }
            : entry,
        ),
      },
      exportPackage.manifest,
    );

    expect(verificationResult.matches).toBe(false);
    expect(verificationResult.reason).toBe(
      "Canonical payload hash does not match the manifest.",
    );
  });
});
