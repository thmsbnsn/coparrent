import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useFamily } from "@/contexts/FamilyContext";
import { supabase } from "@/integrations/supabase/client";
import type { AssetViewerItem } from "@/components/media/AssetViewerDialog";

interface FamilyMediaAssetRow {
  created_at: string;
  family_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  id: string;
  uploaded_by: string;
}

export interface FamilyMediaGalleryItem extends AssetViewerItem {
  createdAt: string;
  familyId: string;
  fileSize: number;
  id: string;
  kind: "image" | "video";
  uploadedBy: string;
}

const isSupportedMediaType = (fileType: string) =>
  fileType.startsWith("image/") || fileType.startsWith("video/");

const toViewerTitle = (fileName: string) => fileName.replace(/\.[^/.]+$/, "") || fileName;

export const useFamilyMediaGallery = () => {
  const { activeFamilyId, loading: familyLoading } = useFamily();
  const [assets, setAssets] = useState<FamilyMediaGalleryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestVersionRef = useRef(0);

  const fetchAssets = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;

    if (familyLoading) {
      return;
    }

    if (!activeFamilyId) {
      if (requestVersion === requestVersionRef.current) {
        setAssets([]);
        setError("Select an active family before viewing shared media.");
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("family_media_assets")
        .select("id, family_id, uploaded_by, file_path, file_name, file_type, file_size, created_at")
        .eq("family_id", activeFamilyId)
        .order("created_at", { ascending: false });

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (queryError) {
        throw queryError;
      }

      const supportedAssets = ((data ?? []) as FamilyMediaAssetRow[]).filter((asset) =>
        isSupportedMediaType(asset.file_type),
      );

      const resolvedAssets = await Promise.all(
        supportedAssets.map(async (asset) => {
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from("family-media")
            .createSignedUrl(asset.file_path, 60 * 60);

          if (signedUrlError || !signedUrlData?.signedUrl) {
            return null;
          }

          return {
            createdAt: asset.created_at,
            familyId: asset.family_id,
            fileName: asset.file_name,
            fileSize: asset.file_size,
            fileType: asset.file_type,
            id: asset.id,
            kind: asset.file_type.startsWith("video/") ? "video" : "image",
            title: toViewerTitle(asset.file_name),
            uploadedBy: asset.uploaded_by,
            url: signedUrlData.signedUrl,
          } satisfies FamilyMediaGalleryItem;
        }),
      );

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setAssets(
        resolvedAssets.filter(
          (asset): asset is FamilyMediaGalleryItem => Boolean(asset),
        ),
      );
    } catch (fetchError) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      console.error("Error loading family media gallery:", fetchError);
      setAssets([]);
      setError("Shared media could not be loaded right now.");
      toast.error("Shared media could not be loaded right now.");
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [activeFamilyId, familyLoading]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  return {
    activeFamilyId,
    assets,
    error,
    loading,
    refresh: fetchAssets,
  };
};
