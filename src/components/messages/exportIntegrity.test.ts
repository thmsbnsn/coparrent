import { beforeAll, describe, expect, it } from "vitest";
import { generateKeyPairSync, webcrypto } from "node:crypto";
import type { MessageTimelineItem } from "@/components/messages/threadTimeline";
import {
  buildMessagingThreadExportPackage,
  getMessagingThreadExportArtifactPayloadJson,
  getMessagingThreadExportManifestJson,
  getMessagingThreadExportPayloadJson,
  MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
  MESSAGING_THREAD_EXPORT_INTEGRITY_MODEL_VERSION,
  MESSAGING_THREAD_EXPORT_PACKAGE_SCHEMA_VERSION,
  MESSAGING_THREAD_EXPORT_SCHEMA_VERSION,
  signMessagingThreadExportReceiptPayload,
  stableStringifyForIntegrity,
  verifyMessagingThreadExportPackage,
  verifyMessagingThreadExportReceiptSignature,
} from "@/components/messages/exportIntegrity";
import type { MessageThread } from "@/hooks/useMessagingHub";

beforeAll(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: webcrypto,
    });
  }

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  signingKeys.privateKeyPkcs8Base64 = privateKey
    .export({ format: "der", type: "pkcs8" })
    .toString("base64");
  signingKeys.publicKeySpkiBase64 = publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
});

const signingKeys: {
  privateKeyPkcs8Base64: string;
  publicKeySpkiBase64: string;
} = {
  privateKeyPkcs8Base64: "",
  publicKeySpkiBase64: "",
};

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

const buildPackage = (overrides?: Partial<Parameters<typeof buildMessagingThreadExportPackage>[0]>) =>
  buildMessagingThreadExportPackage({
    activeFamilyId: "family-1",
    activeThread,
    exportId: "export-one",
    exportedAt: "2026-03-30T14:00:00.000Z",
    exportedByUserId: "user-taylor",
    exportedByProfileId: "profile-taylor",
    timelineItems,
    ...overrides,
  });

describe("buildMessagingThreadExportPackage", () => {
  it("keeps the same canonical hash for the same logical content even when receipt metadata changes", async () => {
    const firstExport = await buildPackage();
    const secondExport = await buildPackage({
      exportId: "export-two",
      exportedAt: "2026-03-30T16:00:00.000Z",
      exportedByProfileId: "profile-jessica",
    });

    expect(firstExport.canonicalPayloadJson).toBe(secondExport.canonicalPayloadJson);
    expect(firstExport.contentHash).toBe(secondExport.contentHash);
    expect(firstExport.manifestHash).not.toBe(secondExport.manifestHash);
    expect(firstExport.artifactHash).not.toBe(secondExport.artifactHash);
    expect(stableStringifyForIntegrity(firstExport.canonicalPayload)).toBe(
      firstExport.canonicalPayloadJson,
    );
  });

  it("changes the canonical hash when recorded content changes", async () => {
    const originalExport = await buildPackage();
    const thirdTimelineItem = timelineItems[2];
    if (thirdTimelineItem.kind !== "message") {
      throw new Error("Expected the third timeline item to be a message.");
    }
    const changedTimelineItems: MessageTimelineItem[] = [
      ...timelineItems.slice(0, 2),
      {
        ...thirdTimelineItem,
        message: {
          ...thirdTimelineItem.message,
          content: "Confirmed. I will be there at 6:00 PM instead.",
        },
      },
    ];

    const changedExport = await buildMessagingThreadExportPackage({
      activeFamilyId: "family-1",
      activeThread,
      exportId: "export-two",
      exportedAt: "2026-03-30T14:00:00.000Z",
      exportedByProfileId: "profile-taylor",
      timelineItems: changedTimelineItems,
    });

    expect(changedExport.contentHash).not.toBe(originalExport.contentHash);
  });

  it("exposes explicit integrity-model and canonicalization versions in the receipt package", async () => {
    const exportPackage = await buildPackage();

    expect(exportPackage.canonicalPayload).toMatchObject({
      canonicalization_version: MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
      schema_version: MESSAGING_THREAD_EXPORT_SCHEMA_VERSION,
    });
    expect(exportPackage.manifest).toMatchObject({
      canonicalization_version: MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
      integrity_model_version: MESSAGING_THREAD_EXPORT_INTEGRITY_MODEL_VERSION,
      schema_version: MESSAGING_THREAD_EXPORT_SCHEMA_VERSION,
    });
    expect(exportPackage.receipt).toMatchObject({
      canonicalization_version: MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
      integrity_model_version: MESSAGING_THREAD_EXPORT_INTEGRITY_MODEL_VERSION,
    });
    expect(exportPackage.evidencePackage.package_schema_version).toBe(
      MESSAGING_THREAD_EXPORT_PACKAGE_SCHEMA_VERSION,
    );
  });

  it("keeps the canonical hash stable while manifest-only metadata changes", async () => {
    const firstExport = await buildPackage();
    const secondExport = await buildPackage({
      exportedAt: "2026-03-31T09:15:00.000Z",
    });

    expect(firstExport.contentHash).toBe(secondExport.contentHash);
    expect(firstExport.manifestHash).not.toBe(secondExport.manifestHash);
    expect(firstExport.artifactHash).not.toBe(secondExport.artifactHash);
  });
});

describe("receipt helpers", () => {
  it("verifies the canonical payload against the stored receipt hash", async () => {
    const exportPackage = await buildPackage();

    const verificationResult = await verifyMessagingThreadExportPackage(
      exportPackage.canonicalPayload,
      exportPackage.receipt,
    );

    expect(verificationResult).toEqual({
      computedHash: exportPackage.contentHash,
      matches: true,
      reason: null,
    });
  });

  it("extracts the canonical payload, manifest, and artifact strings from the evidence package", async () => {
    const exportPackage = await buildPackage();

    expect(getMessagingThreadExportPayloadJson(exportPackage.evidencePackage)).toBe(
      exportPackage.canonicalPayloadJson,
    );
    expect(getMessagingThreadExportManifestJson(exportPackage.evidencePackage)).toBe(
      exportPackage.manifestJson,
    );
    expect(getMessagingThreadExportArtifactPayloadJson(exportPackage.evidencePackage)).toBe(
      exportPackage.artifactPayloadJson,
    );
  });

  it("signs and verifies the deterministic receipt payload", async () => {
    const exportPackage = await buildPackage();
    const signature = await signMessagingThreadExportReceiptPayload(
      exportPackage.receiptPayloadJson,
      signingKeys.privateKeyPkcs8Base64,
    );

    expect(signature.length).toBeGreaterThan(40);
    await expect(
      verifyMessagingThreadExportReceiptSignature(
        exportPackage.receiptPayloadJson,
        signingKeys.publicKeySpkiBase64,
        signature,
      ),
    ).resolves.toBe(true);
    await expect(
      verifyMessagingThreadExportReceiptSignature(
        exportPackage.receiptPayloadJson,
        generateKeyPairSync("ed25519").publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64"),
        signature,
      ),
    ).resolves.toBe(false);
  });
});
