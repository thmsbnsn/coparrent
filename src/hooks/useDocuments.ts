import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNotificationService } from '@/hooks/useNotificationService';
import { handleError, ERROR_MESSAGES } from '@/lib/errorMessages';
import { 
  getMutationKey, 
  acquireMutationLock, 
  releaseMutationLock 
} from '@/lib/mutations';

export interface Document {
  id: string;
  title: string;
  description: string | null;
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
  { value: 'legal', label: 'Legal Documents' },
  { value: 'medical', label: 'Medical Records' },
  { value: 'school', label: 'School Records' },
  { value: 'financial', label: 'Financial Documents' },
  { value: 'custody', label: 'Custody Agreements' },
  { value: 'other', label: 'Other' },
] as const;

export const useDocuments = () => {
  const { user } = useAuth();
  const { notifyDocumentUpload } = useNotificationService();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userProfile, setUserProfile] = useState<{ id: string; full_name: string | null; co_parent_id: string | null } | null>(null);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, co_parent_id')
        .eq('user_id', user.id)
        .single();
      
      if (profile) {
        setUserProfile(profile);
      }
    };

    fetchProfile();
  }, [user]);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      const message = handleError(error, { feature: 'Documents', action: 'fetch' });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const logAccess = async (documentId: string, action: string) => {
    if (!user || !userProfile) return;

    try {
      await supabase.from('document_access_logs').insert({
        document_id: documentId,
        accessed_by: userProfile.id,
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
    if (!user || !userProfile) return null;

    // Guard against double-submits
    const mutationKey = getMutationKey("uploadDocument", title, file.name);
    if (!acquireMutationLock(mutationKey)) {
      toast.error(ERROR_MESSAGES.DUPLICATE_REQUEST);
      return null;
    }

    setUploading(true);

    try {
      // Upload file to storage with cryptographically secure filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          title,
          description: description || null,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          child_id: childId || null,
          uploaded_by: userProfile.id,
          category,
        })
        .select()
        .single();

      if (docError) throw docError;

      // Log the upload
      await logAccess(doc.id, 'upload');

      // Notify co-parent about the upload
      if (userProfile.co_parent_id) {
        const uploaderName = userProfile.full_name || 'Your co-parent';
        await notifyDocumentUpload(userProfile.co_parent_id, uploaderName, title);
      }

      toast.success('Document uploaded successfully');
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
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (error) throw error;

      // Log the download
      await logAccess(document.id, 'download');

      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Document downloaded');
    } catch (error) {
      const message = handleError(error, { feature: 'Documents', action: 'download' });
      toast.error(message);
    }
  };

  const viewDocument = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 60 * 60); // 1 hour

      if (error) throw error;

      // Log the view
      await logAccess(document.id, 'view');

      window.open(data.signedUrl, '_blank');
    } catch (error) {
      const message = handleError(error, { feature: 'Documents', action: 'view' });
      toast.error(message);
    }
  };

  const deleteDocument = async (document: Document) => {
    // Guard against double-submits
    const mutationKey = getMutationKey("deleteDocument", document.id);
    if (!acquireMutationLock(mutationKey)) {
      return;
    }

    try {
      // Log deletion before removing
      await logAccess(document.id, 'delete');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error: docError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (docError) throw docError;

      toast.success('Document deleted');
      await fetchDocuments();
    } catch (error) {
      const message = handleError(error, { feature: 'Documents', action: 'delete' });
      toast.error(message);
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const getAccessLogs = async (documentId: string): Promise<DocumentAccessLog[]> => {
    try {
      const { data, error } = await supabase
        .from('document_access_logs')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

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
