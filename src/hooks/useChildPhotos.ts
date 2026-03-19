import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ERROR_MESSAGES } from "@/lib/errorMessages";

const BUCKET_NAME = "child-photos";
const URL_EXPIRY_SECONDS = 3600; // 1 hour

export interface ChildPhoto {
  id: string;
  child_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  caption: string | null;
  taken_at: string | null;
  tags: string[];
  created_at: string;
  signedUrl?: string;
}

export interface UploadProgress {
  fileName: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export const useChildPhotos = (childId: string | null) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<ChildPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);

  // Get user profile ID
  useEffect(() => {
    const fetchProfileId = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (data) setUserProfileId(data.id);
    };
    fetchProfileId();
  }, [user?.id]);

  // Fetch photos for a child
  const fetchPhotos = useCallback(async () => {
    if (!childId) {
      setPhotos([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("child_photos")
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching photos:", error);
        setPhotos([]);
        return;
      }

      // Get signed URLs for each photo
      const photosWithUrls = await Promise.all(
        (data || []).map(async (photo) => {
          const { data: signedData } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(photo.file_path, URL_EXPIRY_SECONDS);
          return {
            ...photo,
            signedUrl: signedData?.signedUrl,
          };
        })
      );

      setPhotos(photosWithUrls);
    } catch (error) {
      console.error("Error fetching photos:", error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  // Initial fetch
  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Validate a single file
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return { valid: false, error: "Invalid file type. Please upload JPG, PNG, WebP, or GIF." };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { valid: false, error: "File too large. Max size is 10MB." };
    }
    return { valid: true };
  };

  // Upload a single photo (internal)
  const uploadSinglePhoto = useCallback(async (
    file: File,
    caption?: string,
    takenAt?: string,
    tags?: string[]
  ): Promise<boolean> => {
    if (!childId || !userProfileId) return false;

    const validation = validateFile(file);
    if (!validation.valid) {
      toast({
        title: "Invalid file",
        description: validation.error,
        variant: "destructive",
      });
      return false;
    }

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `${childId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error uploading photo:", uploadError);
        return false;
      }

      const { error: dbError } = await supabase.from("child_photos").insert({
        child_id: childId,
        uploaded_by: userProfileId,
        file_path: filePath,
        file_name: file.name,
        caption: caption || null,
        taken_at: takenAt || null,
        tags: tags || [],
      });

      if (dbError) {
        console.error("Error creating photo record:", dbError);
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error uploading photo:", error);
      return false;
    }
  }, [childId, userProfileId, toast]);

  // Upload a photo (public API - single file)
  const uploadPhoto = useCallback(
    async (file: File, caption?: string, takenAt?: string, tags?: string[]): Promise<boolean> => {
      if (!childId || !userProfileId) {
        toast({
          title: "Error",
          description: "Unable to upload photo. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      setUploading(true);
      const success = await uploadSinglePhoto(file, caption, takenAt, tags);

      if (success) {
        toast({
          title: "Photo uploaded",
          description: "The photo has been added to the gallery",
        });
        await fetchPhotos();
      } else {
        toast({
          title: "Upload failed",
          description: "Could not upload the photo. Please try again.",
          variant: "destructive",
        });
      }

      setUploading(false);
      return success;
    },
    [childId, userProfileId, toast, uploadSinglePhoto, fetchPhotos]
  );

  // Bulk upload multiple photos with progress tracking
  const uploadPhotos = useCallback(
    async (
      files: File[],
      sharedTags?: string[]
    ): Promise<{ success: number; failed: number }> => {
      if (!childId || !userProfileId) {
        toast({
          title: "Error",
          description: "Unable to upload photos. Please try again.",
          variant: "destructive",
        });
        return { success: 0, failed: files.length };
      }

      // Validate all files first
      const validFiles: File[] = [];
      const initialProgress: UploadProgress[] = [];

      for (const file of files) {
        const validation = validateFile(file);
        initialProgress.push({
          fileName: file.name,
          progress: 0,
          status: validation.valid ? 'pending' : 'error',
          error: validation.error,
        });
        if (validation.valid) {
          validFiles.push(file);
        }
      }

      if (validFiles.length === 0) {
        toast({
          title: "No valid files",
          description: "Please select valid image files (JPG, PNG, WebP, or GIF under 10MB)",
          variant: "destructive",
        });
        return { success: 0, failed: files.length };
      }

      setUploading(true);
      setUploadProgress(initialProgress);

      let successCount = 0;
      let failedCount = files.length - validFiles.length; // Already failed validations

      // Upload files sequentially to show progress
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const currentProgress = initialProgress[i];

        if (currentProgress.status === 'error') {
          continue; // Skip already failed files
        }

        // Update status to uploading
        setUploadProgress((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: 'uploading', progress: 10 } : p
          )
        );

        try {
          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          const filePath = `${childId}/${fileName}`;

          // Update progress to 30%
          setUploadProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, progress: 30 } : p
            )
          );

          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            throw new Error("Storage upload failed");
          }

          // Update progress to 70%
          setUploadProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, progress: 70 } : p
            )
          );

          const { error: dbError } = await supabase.from("child_photos").insert({
            child_id: childId,
            uploaded_by: userProfileId,
            file_path: filePath,
            file_name: file.name,
            caption: null,
            taken_at: null,
            tags: sharedTags || [],
          });

          if (dbError) {
            await supabase.storage.from(BUCKET_NAME).remove([filePath]);
            throw new Error("Database insert failed");
          }

          // Update progress to 100% success
          setUploadProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: 'success', progress: 100 } : p
            )
          );
          successCount++;
        } catch (error) {
          console.error("Error uploading photo:", error);
          setUploadProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: 'error', progress: 0, error: 'Upload failed' } : p
            )
          );
          failedCount++;
        }
      }

      // Show summary toast
      if (successCount > 0) {
        toast({
          title: `${successCount} photo${successCount > 1 ? 's' : ''} uploaded`,
          description:
            failedCount > 0
              ? `${failedCount} photo${failedCount > 1 ? 's' : ''} failed to upload`
              : "All photos have been added to the gallery",
        });
        await fetchPhotos();
      } else {
        toast({
          title: "Upload failed",
          description: "Could not upload any photos. Please try again.",
          variant: "destructive",
        });
      }

      setUploading(false);
      return { success: successCount, failed: failedCount };
    },
    [childId, userProfileId, toast, fetchPhotos]
  );

  // Clear upload progress
  const clearUploadProgress = useCallback(() => {
    setUploadProgress([]);
  }, []);

  // Delete a photo
  const deletePhoto = useCallback(
    async (photoId: string, filePath: string): Promise<boolean> => {
      try {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([filePath]);

        if (storageError) {
          console.error("Error deleting from storage:", storageError);
        }

        // Delete from database
        const { error: dbError } = await supabase
          .from("child_photos")
          .delete()
          .eq("id", photoId);

        if (dbError) {
          console.error("Error deleting photo record:", dbError);
          toast({
            title: "Delete failed",
            description: "Could not delete the photo. Please try again.",
            variant: "destructive",
          });
          return false;
        }

        toast({
          title: "Photo deleted",
          description: "The photo has been removed from the gallery",
        });

        // Refresh photos
        await fetchPhotos();
        return true;
      } catch (error) {
        console.error("Error deleting photo:", error);
        toast({
          title: "Delete failed",
          description: ERROR_MESSAGES.DELETE_FAILED,
          variant: "destructive",
        });
        return false;
      }
    },
    [toast, fetchPhotos]
  );

  // Update photo caption
  const updateCaption = useCallback(
    async (photoId: string, caption: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("child_photos")
          .update({ caption })
          .eq("id", photoId);

        if (error) {
          console.error("Error updating caption:", error);
          toast({
            title: "Update failed",
            description: "Could not update the caption. Please try again.",
            variant: "destructive",
          });
          return false;
        }

        // Update local state
        setPhotos((prev) =>
          prev.map((p) => (p.id === photoId ? { ...p, caption } : p))
        );

        return true;
      } catch (error) {
        console.error("Error updating caption:", error);
        return false;
      }
    },
    [toast]
  );

  // Update photo tags
  const updateTags = useCallback(
    async (photoId: string, tags: string[]): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("child_photos")
          .update({ tags })
          .eq("id", photoId);

        if (error) {
          console.error("Error updating tags:", error);
          toast({
            title: "Update failed",
            description: "Could not update the tags. Please try again.",
            variant: "destructive",
          });
          return false;
        }

        // Update local state
        setPhotos((prev) =>
          prev.map((p) => (p.id === photoId ? { ...p, tags } : p))
        );

        return true;
      } catch (error) {
        console.error("Error updating tags:", error);
        return false;
      }
    },
    [toast]
  );

  return {
    photos,
    loading,
    uploading,
    uploadProgress,
    uploadPhoto,
    uploadPhotos,
    clearUploadProgress,
    deletePhoto,
    updateCaption,
    updateTags,
    refetch: fetchPhotos,
  };
};
