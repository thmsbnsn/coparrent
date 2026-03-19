import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LawLibraryResource, US_STATES, RESOURCE_CATEGORIES } from './useLawLibrary';

export { US_STATES, RESOURCE_CATEGORIES };

export interface NewLawLibraryResource {
  title: string;
  description: string;
  state: string;
  category: string;
  source_url: string;
}

type LawLibraryResourceUpdate = Partial<{
  title: string;
  description: string | null;
  state: string;
  category: string;
  source_url: string | null;
  last_verified_at: string;
}>;

export const useAdminLawLibrary = () => {
  const [resources, setResources] = useState<LawLibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('law_library_resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResources((data as LawLibraryResource[]) || []);
    } catch (error: unknown) {
      console.error('Error fetching law library resources:', error);
      toast({
        title: 'Error',
        description: 'Failed to load law library resources.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const uploadResource = async (
    file: File,
    metadata: NewLawLibraryResource
  ): Promise<boolean> => {
    try {
      setUploading(true);

      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${metadata.state}/${Date.now()}-${file.name}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('law-library')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create database record
      const { error: dbError } = await supabase
        .from('law_library_resources')
        .insert({
          title: metadata.title.trim(),
          description: metadata.description.trim() || null,
          state: metadata.state,
          category: metadata.category,
          file_name: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          file_type: file.type || 'application/pdf',
          source_url: metadata.source_url.trim() || null,
          last_verified_at: new Date().toISOString(),
        });

      if (dbError) {
        // Cleanup uploaded file if database insert fails
        await supabase.storage.from('law-library').remove([uploadData.path]);
        throw dbError;
      }

      toast({
        title: 'Success',
        description: `"${metadata.title}" has been uploaded.`,
      });

      await fetchResources();
      return true;
    } catch (error: unknown) {
      console.error('Error uploading resource:', error);
      toast({
        title: 'Upload Failed',
        description: 'Could not upload the resource. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setUploading(false);
    }
  };

  const updateResource = async (
    id: string,
    updates: Partial<NewLawLibraryResource & { last_verified_at?: string }>
  ): Promise<boolean> => {
    try {
      const updateData: LawLibraryResourceUpdate = {};
      
      if (updates.title !== undefined) updateData.title = updates.title.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim() || null;
      if (updates.state !== undefined) updateData.state = updates.state;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.source_url !== undefined) updateData.source_url = updates.source_url.trim() || null;
      if (updates.last_verified_at !== undefined) updateData.last_verified_at = updates.last_verified_at;

      const { error } = await supabase
        .from('law_library_resources')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Resource updated successfully.',
      });

      await fetchResources();
      return true;
    } catch (error: unknown) {
      console.error('Error updating resource:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update the resource. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteResource = async (resource: LawLibraryResource): Promise<boolean> => {
    try {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('law-library')
        .remove([resource.file_path]);

      if (storageError) {
        console.warn('Storage deletion warning:', storageError);
        // Continue with database deletion even if storage fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('law_library_resources')
        .delete()
        .eq('id', resource.id);

      if (dbError) throw dbError;

      toast({
        title: 'Deleted',
        description: `"${resource.title}" has been removed.`,
      });

      await fetchResources();
      return true;
    } catch (error: unknown) {
      console.error('Error deleting resource:', error);
      toast({
        title: 'Delete Failed',
        description: 'Could not delete the resource. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateVerificationDate = async (id: string): Promise<boolean> => {
    return updateResource(id, { last_verified_at: new Date().toISOString() });
  };

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  return {
    resources,
    loading,
    uploading,
    fetchResources,
    uploadResource,
    updateResource,
    deleteResource,
    updateVerificationDate,
  };
};
