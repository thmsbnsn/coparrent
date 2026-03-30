import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import { toast } from 'sonner';
import { 
  getMutationKey, 
  acquireMutationLock, 
  releaseMutationLock 
} from '@/lib/mutations';
import { downloadCreationPng } from '@/lib/creationsExport';
import { useCreations } from '@/hooks/useCreations';

export type Difficulty = 'simple' | 'medium' | 'detailed';

export interface ColoringPage {
  id: string;
  family_id: string | null;
  user_id: string;
  document_id: string | null;
  prompt: string;
  difficulty: Difficulty;
  image_url: string | null;
  created_at: string;
}

interface GenerateResult {
  ok: boolean;
  imageUrl?: string;
  coloringPageId?: string;
  remaining?: number;
  code?: string;
  message?: string;
}

async function imageToBlob(imageUrl: string): Promise<Blob> {
  if (imageUrl.startsWith('data:')) {
    const response = await fetch(imageUrl);
    return await response.blob();
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch generated image: ${response.status}`);
  }

  return await response.blob();
}

export const useColoringPages = () => {
  const { user } = useAuth();
  const { activeFamilyId, profileId } = useFamily();
  const { createCreation } = useCreations();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  
  // History state
  const [history, setHistory] = useState<ColoringPage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scopeError = activeFamilyId ? null : 'Select an active family before using Coloring Pages.';

  // Fetch history on mount
  useEffect(() => {
    if (!user || !activeFamilyId) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('coloring_pages')
          .select('*')
          .eq('family_id', activeFamilyId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        
        // Cast difficulty to proper type
        const typedData = (data || []).map(page => ({
          ...page,
          difficulty: page.difficulty as Difficulty,
        }));
        
        setHistory(typedData);
      } catch (error) {
        console.error('Error fetching coloring page history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [activeFamilyId, user]);

  // Add new page to history after generation
  const addToHistory = useCallback((page: ColoringPage) => {
    setHistory(prev => [page, ...prev]);
  }, []);

  const generateColoringPage = useCallback(async (
    prompt: string,
    difficulty: Difficulty
  ): Promise<boolean> => {
    if (!user) {
      toast.error('Please sign in to generate coloring pages');
      return false;
    }

    // Guard against double-submits
    const mutationKey = getMutationKey('generateColoringPage', prompt, difficulty);
    if (!acquireMutationLock(mutationKey)) {
      toast.error('Please wait, a coloring page is already being generated');
      return false;
    }

    setGenerating(true);
    setErrorState(null);
    setCurrentImage(null);
    setCurrentPageId(null);

    try {
      if (!activeFamilyId) {
        setErrorState({ code: 'FAMILY_SCOPE_REQUIRED', message: 'Select a family to continue' });
        toast.error('Select a family before generating a coloring page');
        return false;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expired. Please sign in again.');
        return false;
      }

      const response = await supabase.functions.invoke('generate-coloring-page', {
        body: { familyId: activeFamilyId, prompt, difficulty },
      });

      const result: GenerateResult = response.data;

      if (!result.ok) {
        // Handle specific error codes
        if (result.code === 'RATE_LIMITED') {
          setErrorState({ code: 'RATE_LIMITED', message: result.message || 'Daily limit reached' });
          toast.error(result.message || 'Daily coloring page limit reached');
          return false;
        }
        if (result.code === 'UNAUTHORIZED') {
          setErrorState({ code: 'UNAUTHORIZED', message: 'Please sign in to continue' });
          toast.error('Please sign in to continue');
          return false;
        }
        if (result.code === 'PREMIUM_REQUIRED' || result.code === 'ROLE_REQUIRED') {
          setErrorState({ code: result.code, message: result.message || 'Upgrade required' });
          toast.error(result.message || 'This feature requires a Power subscription');
          return false;
        }
        
        toast.error(result.message || 'Failed to generate coloring page');
        return false;
      }

      if (result.imageUrl) {
        setCurrentImage(result.imageUrl);
        setCurrentPageId(result.coloringPageId || null);
        
        // Add to history
        if (result.coloringPageId) {
          addToHistory({
            family_id: activeFamilyId,
            id: result.coloringPageId,
            user_id: user.id,
            document_id: null,
            prompt,
            difficulty,
            image_url: result.imageUrl,
            created_at: new Date().toISOString(),
          });
        }
        
        toast.success('Coloring page created!');
        return true;
      }

      toast.error('No image was generated');
      return false;
    } catch (error) {
      console.error('Error generating coloring page:', error);
      toast.error('Failed to generate coloring page. Please try again.');
      return false;
    } finally {
      setGenerating(false);
      releaseMutationLock(mutationKey);
    }
  }, [activeFamilyId, user, addToHistory]);

  const saveToVault = useCallback(async (
    imageUrl: string,
    prompt: string,
    difficulty: Difficulty,
    coloringPageId?: string
  ): Promise<boolean> => {
    if (!user || !profileId || !activeFamilyId) {
      toast.error('Select an active family before saving to the Document Vault');
      return false;
    }

    const mutationKey = getMutationKey('saveColoringToVault', prompt, Date.now().toString());
    if (!acquireMutationLock(mutationKey)) {
      toast.error('Please wait...');
      return false;
    }

    setSaving(true);

    try {
      const blob = await imageToBlob(imageUrl);
      const contentType = blob.type || 'image/png';
      const fileExtension = contentType.split('/')[1] || 'png';

      // Generate unique filename
      const fileName = `coloring-${crypto.randomUUID()}.${fileExtension}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to documents bucket
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType,
        });

      if (uploadError) throw uploadError;

      // Create document record with "creations" category
      const title = `Coloring Page: ${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}`;
      const description = `Generated coloring page (${difficulty} difficulty). Original prompt: "${prompt}"`;

      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          family_id: activeFamilyId,
          title,
          description,
          file_path: filePath,
          file_name: `${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-coloring-page.${fileExtension}`,
          file_type: contentType,
          file_size: blob.size,
          uploaded_by: profileId,
          category: 'other', // Using 'other' as category, UI will show as "CoParrent Creations"
        })
        .select()
        .single();

      if (docError) throw docError;

      // Update coloring_pages record with document_id if we have it
      if (coloringPageId) {
        await supabase
          .from('coloring_pages')
          .update({ document_id: doc.id })
          .eq('id', coloringPageId)
          .eq('family_id', activeFamilyId);
        
        // Update history
        setHistory(prev => prev.map(p => 
          p.id === coloringPageId ? { ...p, document_id: doc.id } : p
        ));
      }

      // Log access
      await supabase.from('document_access_logs').insert({
        document_id: doc.id,
        accessed_by: profileId,
        action: 'upload',
        user_agent: navigator.userAgent,
      });

      toast.success('Saved to Document Vault!');
      return true;
    } catch (error) {
      console.error('Error saving to vault:', error);
      toast.error('Failed to save to vault');
      return false;
    } finally {
      setSaving(false);
      releaseMutationLock(mutationKey);
    }
  }, [activeFamilyId, profileId, user]);

  // Save to unified Creations library
  const saveToCreations = useCallback(async (
    imageUrl: string,
    prompt: string,
    difficulty: Difficulty
  ): Promise<boolean> => {
    if (!user) {
      toast.error('Please sign in to save');
      return false;
    }

    const mutationKey = getMutationKey('saveColoringToCreations', prompt, Date.now().toString());
    if (!acquireMutationLock(mutationKey)) {
      toast.error('Please wait...');
      return false;
    }

    setSaving(true);

    try {
      if (!activeFamilyId) {
        toast.error('Select an active family before saving to the Creations Library');
        return false;
      }

      // First create the coloring_page_details record
      const { data: detail, error: detailError } = await supabase
        .from('coloring_page_details')
        .insert({
          family_id: activeFamilyId,
          owner_user_id: user.id,
          prompt,
          difficulty,
          image_url: imageUrl,
          thumbnail_url: imageUrl, // Use same for thumbnail for now
        })
        .select()
        .single();

      if (detailError) throw detailError;

      // Create the creations index entry
      const title = prompt.length > 50 ? `${prompt.slice(0, 50)}...` : prompt;
      const creation = await createCreation({
        type: 'coloring_page',
        title,
        detail_id: detail.id,
        thumbnail_url: imageUrl,
        meta: { difficulty, prompt },
      });

      if (!creation) {
        throw new Error('Failed to create creation entry');
      }

      toast.success('Saved to Creations Library!');
      return true;
    } catch (error) {
      console.error('Error saving to creations:', error);
      toast.error('Failed to save to library');
      return false;
    } finally {
      setSaving(false);
      releaseMutationLock(mutationKey);
    }
  }, [activeFamilyId, user, createCreation]);

  const downloadPNG = useCallback((imageUrl: string, prompt: string) => {
    try {
      downloadCreationPng(imageUrl, `${prompt.slice(0, 30)}-coloring-page`);
      toast.success('PNG downloaded!');
    } catch (error) {
      console.error('Error downloading PNG:', error);
      toast.error('Failed to download');
    }
  }, []);

  const clearCurrentImage = useCallback(() => {
    setCurrentImage(null);
    setCurrentPageId(null);
    setErrorState(null);
  }, []);

  return {
    generating,
    saving,
    scopeError,
    currentImage,
    currentPageId,
    errorState,
    history,
    loadingHistory,
    generateColoringPage,
    saveToVault,
    saveToCreations,
    downloadPNG,
    clearCurrentImage,
  };
};
