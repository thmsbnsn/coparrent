import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ERROR_MESSAGES } from "@/lib/errorMessages";

const BUCKET_NAME = "child-avatars";
const URL_EXPIRY_SECONDS = 3600; // 1 hour

export const useChildAvatar = () => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  /**
   * Get a signed URL for a child's avatar
   * Returns null if no avatar exists or access denied
   */
  const getAvatarUrl = useCallback(async (childId: string): Promise<string | null> => {
    if (!childId) return null;

    try {
      // List files in the child's folder to find the avatar
      const { data: files, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(childId, { limit: 1 });

      if (listError || !files || files.length === 0) {
        return null;
      }

      const avatarFile = files[0];
      const filePath = `${childId}/${avatarFile.name}`;

      // Create a signed URL with short expiry
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, URL_EXPIRY_SECONDS);

      if (error) {
        console.error("Error creating signed URL:", error);
        return null;
      }

      return data?.signedUrl || null;
    } catch (error) {
      console.error("Error getting avatar URL:", error);
      return null;
    }
  }, []);

  /**
   * Delete a child's avatar
   */
  const deleteAvatar = useCallback(async (childId: string): Promise<boolean> => {
    if (!childId) return false;

    try {
      // List and delete all files in the child's folder
      const { data: files, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(childId);

      if (listError || !files || files.length === 0) {
        return true; // No files to delete
      }

      const filePaths = files.map((f) => `${childId}/${f.name}`);

      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filePaths);

      if (deleteError) {
        console.error("Error deleting avatar:", deleteError);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error deleting avatar:", error);
      return false;
    }
  }, []);

  /**
   * Upload an avatar for a child
   * Replaces any existing avatar
   */
  const uploadAvatar = useCallback(async (
    childId: string,
    file: File
  ): Promise<string | null> => {
    if (!childId || !file) return null;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, WebP, or GIF image",
        variant: "destructive",
      });
      return null;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image under 5MB",
        variant: "destructive",
      });
      return null;
    }

    setUploading(true);

    try {
      // Delete existing avatar first
      await deleteAvatar(childId);

      // Generate filename with extension
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `avatar.${ext}`;
      const filePath = `${childId}/${fileName}`;

      // Upload the new avatar
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("Error uploading avatar:", uploadError);
        toast({
          title: "Upload failed",
          description: "Could not upload the avatar. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      // Get the signed URL for the uploaded avatar
      const signedUrl = await getAvatarUrl(childId);

      toast({
        title: "Photo uploaded",
        description: "The profile photo has been updated",
      });

      return signedUrl;
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Upload failed",
        description: ERROR_MESSAGES.UPLOAD_FAILED,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  }, [toast, deleteAvatar, getAvatarUrl]);

  return {
    uploading,
    getAvatarUrl,
    uploadAvatar,
    deleteAvatar,
  };
};
