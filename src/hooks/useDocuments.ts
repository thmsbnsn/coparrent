import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { toast } from "sonner";
import { useNotificationService } from "@/hooks/useNotificationService";
import { handleError, ERROR_MESSAGES } from "@/lib/errorMessages";
import { fetchFamilyChildIds, fetchFamilyParentProfiles } from "@/lib/familyScope";
import {
  getMutationKey,
  acquireMutationLock,
  releaseMutationLock,
} from "@/lib/mutations";

export interface Document {
  id: string;
  title: string;
  description: string | null;
  family_id: string | null;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  child_id: string | null;
  uploaded_by: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentAccessLog {
  id: string;
  document_id: string;
  accessed_by: string;
  action: string;
  user_agent: string | null;
  created_at: string;
}

export const DOCUMENT_CATEGORIES = [
  { value: "legal", label: "Legal Documents" },
  { value: "medical", label: "Medical Records" },
  { value: "school", label: "School Records" },
  { value: "financial", label: "Financial Documents" },
  { value: "custody", label: "Custody Agreements" },
  { value: "other", label: "Other" },
] as const;

export const useDocuments = () => {
  const { user } = useAuth();
  const { activeFamilyId, loading: familyLoading, profileId } = useFamily();
  const { notifyDocumentUpload } = useNotificationService();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userProfileName, setUserProfileName] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    requestVersionRef.current += 1;
    setDocuments([]);

    if (!familyLoading) {
      setLoading(Boolean(activeFamilyId && profileId));
    }
  }, [activeFamilyId, familyLoading, profileId]);

  useEffect(() => {
    const fetchProfileName = async () => {
      if (!profileId) {
        setUserProfileName(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", profileId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching document uploader profile:", error);
        return;
      }

      setUserProfileName(data?.full_name ?? null);
    };

    void fetchProfileName();
  }, [profileId]);

  const fetchDocuments = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;

    if (familyLoading) {
      return;
    }

    if (!activeFamilyId || !profileId) {
      if (requestVersion === requestVersionRef.current) {
        setDocuments([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("family_id", activeFamilyId)
        .order("created_at", { ascending: false });

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (error) throw error;

      setDocuments((data ?? []) as Document[]);
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      const message = handleError(error, { feature: 'Documents', action: 'fetch' });
      toast.error(message);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [activeFamilyId, familyLoading, profileId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const isDocumentInActiveFamily = useCallback(
    (document: Document) => Boolean(activeFamilyId && document.family_id === activeFamilyId),
    [activeFamilyId],
  );

  const resolveNotificationRecipientIds = useCallback(async () => {
    if (!activeFamilyId || !profileId) {
      return [];
    }

    const familyParentProfiles = await fetchFamilyParentProfiles(activeFamilyId);
    return familyParentProfiles
      .filter((familyParent) => familyParent.profileId !== profileId)
      .map((familyParent) => familyParent.profileId);
  }, [activeFamilyId, profileId]);

  const logAccess = async (documentId: string, action: string) => {
    if (!profileId) return;

    try {
      await supabase.from("document_access_logs").insert({
        document_id: documentId,
        accessed_by: profileId,
        action,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error('Error logging access:', error);
    }
  };

  const uploadDocument = async (
    file: File,
    title: string,
    description: string,
    category: string,
    childId?: string
  ) => {
    if (!user || !profileId || !activeFamilyId) {
      toast.error("Select an active family before uploading documents.");
      return null;
    }

    // Guard against double-submits
    const mutationKey = getMutationKey("uploadDocument", title, file.name);
    if (!acquireMutationLock(mutationKey)) {
      toast.error(ERROR_MESSAGES.DUPLICATE_REQUEST);
      return null;
    }

    setUploading(true);

    try {
      if (childId) {
        const familyChildIds = await fetchFamilyChildIds(activeFamilyId);

        if (!familyChildIds.includes(childId)) {
          toast.error("The selected child is not part of the active family.");
          return null;
        }
      }

      // Upload file to storage with cryptographically secure filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          family_id: activeFamilyId,
          title,
          description: description || null,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          child_id: childId || null,
          uploaded_by: profileId,
          category,
        })
        .select()
        .single();

      if (docError) throw docError;

      // Log the upload
      await logAccess(doc.id, "upload");

      const notificationRecipientIds = await resolveNotificationRecipientIds();
      if (notificationRecipientIds.length > 0) {
        const uploaderName = userProfileName || "A parent";

        await Promise.allSettled(
          notificationRecipientIds.map((recipientProfileId) =>
            notifyDocumentUpload(recipientProfileId, uploaderName, title),
          ),
        );
      }

      toast.success("Document uploaded successfully");
      await fetchDocuments();
      return doc;
    } catch (error) {
      const message = handleError(error, { feature: 'Documents', action: 'upload' });
      toast.error(message);
      return null;
    } finally {
      setUploading(false);
      releaseMutationLock(mutationKey);
    }
  };

  const downloadDocument = async (document: Document) => {
    if (!isDocumentInActiveFamily(document)) {
      toast.error("That document is not available in the active family.");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(document.file_path);

      if (error) throw error;

      // Log the download
      await logAccess(document.id, "download");

      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Document downloaded");
    } catch (error) {
      const message = handleError(error, { feature: 'Documents', action: 'download' });
      toast.error(message);
    }
  };

  const viewDocument = async (document: Document) => {
    if (!isDocumentInActiveFamily(document)) {
      toast.error("That document is not available in the active family.");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(document.file_path, 60 * 60); // 1 hour

      if (error) throw error;

      // Log the view
      await logAccess(document.id, "view");

      window.open(data.signedUrl, '_blank');
    } catch (error) {
      const message = handleError(error, { feature: 'Documents', action: 'view' });
      toast.error(message);
    }
  };

  const deleteDocument = async (document: Document) => {
    if (!activeFamilyId) {
      toast.error("Select an active family before deleting documents.");
      return;
    }

    if (!isDocumentInActiveFamily(document)) {
      toast.error("That document is not available in the active family.");
      return;
    }

    // Guard against double-submits
    const mutationKey = getMutationKey("deleteDocument", document.id);
    if (!acquireMutationLock(mutationKey)) {
      return;
    }

    try {
      // Log deletion before removing
      await logAccess(document.id, "delete");

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error: docError } = await supabase
        .from("documents")
        .delete()
        .eq("id", document.id)
        .eq("family_id", activeFamilyId);

      if (docError) throw docError;

      toast.success("Document deleted");
      await fetchDocuments();
    } catch (error) {
      const message = handleError(error, { feature: 'Documents', action: 'delete' });
      toast.error(message);
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const getAccessLogs = async (documentId: string): Promise<DocumentAccessLog[]> => {
    const hasActiveFamilyDocument = documents.some(
      (document) => document.id === documentId && isDocumentInActiveFamily(document),
    );

    if (!hasActiveFamilyDocument) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("document_access_logs")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching access logs:', error);
      return [];
    }
  };

  return {
    documents,
    loading,
    uploading,
    uploadDocument,
    downloadDocument,
    viewDocument,
    deleteDocument,
    getAccessLogs,
    refetch: fetchDocuments,
  };
};
