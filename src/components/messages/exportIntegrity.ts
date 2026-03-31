import type { MessageTimelineItem } from "@/components/messages/threadTimeline";
import type { MessageThread } from "@/hooks/useMessagingHub";
import {
  getMessagingThreadExportArtifactPayloadJson,
  getMessagingThreadExportManifestJson,
  buildMessagingThreadExportPackage as buildSharedMessagingThreadExportPackage,
  getMessagingThreadExportPayloadJson,
  MESSAGING_THREAD_EXPORT_ARTIFACT_TYPE,
  MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
  MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
  MESSAGING_THREAD_EXPORT_INTEGRITY_MODEL_VERSION,
  MESSAGING_THREAD_EXPORT_PACKAGE_SCHEMA_VERSION,
  MESSAGING_THREAD_EXPORT_SCHEMA_VERSION,
  MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM,
  sha256Hex,
  signMessagingThreadExportReceiptPayload,
  stableStringifyForIntegrity,
  type MessagingThreadExportEvidencePackage,
  verifyMessagingThreadExportPackage,
  verifyMessagingThreadExportReceiptSignature,
  type MessagingThreadCanonicalExportPayload,
  type MessagingThreadExportManifest,
  type MessagingThreadExportPackage,
  type MessagingThreadExportReceipt,
} from "../../../supabase/functions/_shared/messagingThreadExportIntegrity";

interface BuildMessagingThreadExportPackageArgs {
  activeFamilyId: string;
  activeThread: MessageThread;
  exportId?: string;
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

export {
  getMessagingThreadExportArtifactPayloadJson,
  getMessagingThreadExportManifestJson,
  getMessagingThreadExportPayloadJson,
  MESSAGING_THREAD_EXPORT_ARTIFACT_TYPE,
  MESSAGING_THREAD_EXPORT_CANONICALIZATION_VERSION,
  MESSAGING_THREAD_EXPORT_HASH_ALGORITHM,
  MESSAGING_THREAD_EXPORT_INTEGRITY_MODEL_VERSION,
  MESSAGING_THREAD_EXPORT_PACKAGE_SCHEMA_VERSION,
  MESSAGING_THREAD_EXPORT_SCHEMA_VERSION,
  MESSAGING_THREAD_EXPORT_SIGNATURE_ALGORITHM,
  sha256Hex,
  signMessagingThreadExportReceiptPayload,
  stableStringifyForIntegrity,
  verifyMessagingThreadExportPackage,
  verifyMessagingThreadExportReceiptSignature,
};

export type {
  MessagingThreadCanonicalExportPayload,
  MessagingThreadExportEvidencePackage,
  MessagingThreadExportManifest,
  MessagingThreadExportPackage,
  MessagingThreadExportReceipt,
};

export const buildMessagingThreadExportPackage = async ({
  activeFamilyId,
  activeThread,
  exportId = "client-export-preview",
  exportedAt,
  exportedByProfileId,
  timelineItems,
}: BuildMessagingThreadExportPackageArgs): Promise<MessagingThreadExportPackage> => {
  return buildSharedMessagingThreadExportPackage({
    exportId,
    exportedAt,
    exportedByProfileId,
    familyId: activeFamilyId,
    thread: {
      display_name: getThreadDisplayName(activeThread),
      id: activeThread.id,
      thread_type: activeThread.thread_type,
    },
    timelineItems,
  });
};
