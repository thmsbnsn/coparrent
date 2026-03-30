/**
 * Unified Creations Hook
 *
 * Provides CRUD operations for the canonical creations index system.
 * All Kids Hub tools (Activities, Coloring Pages, etc.) use this hook
 * to manage their creations in a consistent way.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import { toast } from 'sonner';
import type { Database, Json } from '@/integrations/supabase/types';

type CreationFolderInsert = Database['public']['Tables']['creation_folders']['Insert'];
type CreationInsert = Database['public']['Tables']['creations']['Insert'];
type CreationShareInsert = Database['public']['Tables']['creation_shares']['Insert'];

type FamilyMemberProfile = {
  avatar_url: string | null;
  email: string | null;
  full_name: string | null;
  id: string;
};

interface CreationFolderRowWithFamily extends CreationFolder {
  family_id: string | null;
}

interface CreationRow extends Creation {
  family_id: string | null;
}

interface CreationRowWithFolder extends CreationRow {
  folder?: CreationFolderRowWithFamily | CreationFolderRowWithFamily[] | null;
}

interface FamilyMemberRecord {
  profile_id: string;
  profiles: FamilyMemberProfile | FamilyMemberProfile[] | null;
}

const CREATIONS_SCOPE_ERROR = 'Select an active family before using the Creations Library.';
const CREATIONS_PROFILE_ERROR = 'Creations require an authenticated family profile.';
const CREATIONS_SCOPE_TOAST = 'Select an active family before using the Creations Library';

const normalizeFolder = (
  folder: CreationFolderRowWithFamily | CreationFolderRowWithFamily[] | null | undefined,
): CreationFolder | undefined => {
  if (!folder) {
    return undefined;
  }

  return Array.isArray(folder) ? folder[0] : folder;
};

// Types
export type CreationType = 'activity' | 'coloring_page';

export interface CreationFolder {
  id: string;
  family_id: string | null;
  owner_user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Creation {
  id: string;
  family_id: string | null;
  owner_user_id: string;
  owner_profile_id: string | null;
  type: CreationType;
  title: string;
  folder_id: string | null;
  thumbnail_url: string | null;
  meta: Json | null;
  detail_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  folder?: CreationFolder;
  is_shared?: boolean;
  is_owner?: boolean;
}

export interface CreationShare {
  id: string;
  family_id: string | null;
  creation_id: string;
  owner_user_id: string;
  shared_with_profile_id: string;
  permission: string;
  created_at: string;
}

export interface ActivityDetail {
  id: string;
  family_id: string | null;
  owner_user_id: string;
  activity_type: string;
  age_range: string | null;
  duration: string | null;
  energy_level: string | null;
  materials: Json;
  steps: Json;
  variations: Json;
  learning_goals: Json;
  safety_notes: Json;
  raw_response: Json | null;
  created_at: string;
  updated_at: string;
}

export interface ColoringPageDetail {
  id: string;
  family_id: string | null;
  owner_user_id: string;
  prompt: string;
  difficulty: string;
  image_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
}

interface UseCreationsReturn {
  // Data
  creations: Creation[];
  folders: CreationFolder[];
  familyMembers: FamilyMember[];
  loading: boolean;
  scopeError: string | null;

  // Folder operations
  fetchFolders: () => Promise<void>;
  createFolder: (name: string) => Promise<CreationFolder | null>;
  updateFolder: (folderId: string, name: string) => Promise<boolean>;
  deleteFolder: (folderId: string) => Promise<boolean>;

  // Creation operations
  fetchCreations: (filters?: CreationFilters) => Promise<void>;
  createCreation: (data: CreateCreationInput) => Promise<Creation | null>;
  updateCreation: (creationId: string, data: UpdateCreationInput) => Promise<boolean>;
  deleteCreation: (creationId: string) => Promise<boolean>;
  moveToFolder: (creationId: string, folderId: string | null) => Promise<boolean>;

  // Detail operations
  fetchActivityDetail: (detailId: string) => Promise<ActivityDetail | null>;
  fetchColoringPageDetail: (detailId: string) => Promise<ColoringPageDetail | null>;

  // Sharing operations
  fetchShares: (creationId: string) => Promise<CreationShare[]>;
  shareCreation: (creationId: string, profileId: string) => Promise<boolean>;
  unshareCreation: (creationId: string, profileId: string) => Promise<boolean>;
  fetchFamilyMembers: () => Promise<void>;
}

export interface CreationFilters {
  type?: CreationType;
  folderId?: string | null;
  ownership?: 'mine' | 'shared';
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'title';
}

export interface CreateCreationInput {
  type: CreationType;
  title: string;
  folder_id?: string | null;
  thumbnail_url?: string | null;
  meta?: Json;
  detail_id: string;
}

export interface UpdateCreationInput {
  title?: string;
  folder_id?: string | null;
  thumbnail_url?: string | null;
  meta?: Json;
}

export function useCreations(): UseCreationsReturn {
  const { user } = useAuth();
  const { activeFamilyId, profileId } = useFamily();
  const [creations, setCreations] = useState<Creation[]>([]);
  const [folders, setFolders] = useState<CreationFolder[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const failForMissingFamilyScope = useCallback(
    (shouldToast = false) => {
      setScopeError(CREATIONS_SCOPE_ERROR);
      if (shouldToast) {
        toast.error(CREATIONS_SCOPE_TOAST);
      }
    },
    [],
  );

  const failForMissingProfileScope = useCallback(
    (shouldToast = false) => {
      setScopeError(CREATIONS_PROFILE_ERROR);
      if (shouldToast) {
        toast.error(CREATIONS_PROFILE_ERROR);
      }
    },
    [],
  );

  // ===== FOLDER OPERATIONS =====

  const fetchFolders = useCallback(async () => {
    if (!user) {
      setFolders([]);
      setScopeError(null);
      return;
    }

    if (!activeFamilyId) {
      setFolders([]);
      failForMissingFamilyScope();
      return;
    }

    setScopeError(null);

    const { data, error } = await supabase
      .from('creation_folders')
      .select('*')
      .eq('family_id', activeFamilyId)
      .order('name');

    if (error) {
      console.error('Error fetching folders:', error);
      setFolders([]);
      return;
    }

    setFolders((data ?? []) as CreationFolder[]);
  }, [activeFamilyId, failForMissingFamilyScope, user]);

  const createFolder = useCallback(async (name: string): Promise<CreationFolder | null> => {
    if (!user) {
      return null;
    }

    if (!activeFamilyId) {
      failForMissingFamilyScope(true);
      return null;
    }

    setScopeError(null);

    const insertPayload: CreationFolderInsert = {
      family_id: activeFamilyId,
      name: name.trim(),
      owner_user_id: user.id,
    };

    const { data, error } = await supabase
      .from('creation_folders')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
      return null;
    }

    setFolders((prev) => [...prev, data as CreationFolder].sort((left, right) => left.name.localeCompare(right.name)));
    toast.success('Folder created');
    return data as CreationFolder;
  }, [activeFamilyId, failForMissingFamilyScope, user]);

  const updateFolder = useCallback(async (folderId: string, name: string): Promise<boolean> => {
    if (!activeFamilyId) {
      failForMissingFamilyScope(true);
      return false;
    }

    setScopeError(null);

    const { error } = await supabase
      .from('creation_folders')
      .update({ name: name.trim() })
      .eq('id', folderId)
      .eq('family_id', activeFamilyId);

    if (error) {
      console.error('Error updating folder:', error);
      toast.error('Failed to update folder');
      return false;
    }

    setFolders((prev) => prev.map((folder) => (
      folder.id === folderId ? { ...folder, name: name.trim() } : folder
    )));
    toast.success('Folder updated');
    return true;
  }, [activeFamilyId, failForMissingFamilyScope]);

  const deleteFolder = useCallback(async (folderId: string): Promise<boolean> => {
    if (!activeFamilyId) {
      failForMissingFamilyScope(true);
      return false;
    }

    setScopeError(null);

    await supabase
      .from('creations')
      .update({ folder_id: null })
      .eq('folder_id', folderId)
      .eq('family_id', activeFamilyId);

    const { error } = await supabase
      .from('creation_folders')
      .delete()
      .eq('id', folderId)
      .eq('family_id', activeFamilyId);

    if (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
      return false;
    }

    setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
    setCreations((prev) => prev.map((creation) => (
      creation.folder_id === folderId
        ? { ...creation, folder: undefined, folder_id: null }
        : creation
    )));
    toast.success('Folder deleted');
    return true;
  }, [activeFamilyId, failForMissingFamilyScope]);

  // ===== CREATION OPERATIONS =====

  const fetchCreations = useCallback(async (filters?: CreationFilters) => {
    if (!user) {
      setCreations([]);
      setLoading(false);
      setScopeError(null);
      return;
    }

    if (!activeFamilyId) {
      setCreations([]);
      setLoading(false);
      failForMissingFamilyScope();
      return;
    }

    if (!profileId) {
      setCreations([]);
      setLoading(false);
      failForMissingProfileScope();
      return;
    }

    setLoading(true);
    setScopeError(null);

    try {
      let query = supabase
        .from('creations')
        .select(`
          *,
          folder:creation_folders(*)
        `)
        .eq('family_id', activeFamilyId);

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      if (filters?.folderId !== undefined) {
        if (filters.folderId === null) {
          query = query.is('folder_id', null);
        } else {
          query = query.eq('folder_id', filters.folderId);
        }
      }

      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }

      switch (filters?.sortBy) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'title':
          query = query.order('title', { ascending: true });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching creations:', error);
        setCreations([]);
        return;
      }

      const { data: shares, error: sharesError } = await supabase
        .from('creation_shares')
        .select('creation_id')
        .eq('family_id', activeFamilyId)
        .eq('shared_with_profile_id', profileId);

      if (sharesError) {
        console.error('Error fetching creation shares:', sharesError);
        setCreations([]);
        return;
      }

      const sharedCreationIds = new Set((shares ?? []).map((share) => share.creation_id));

      const accessibleCreations = ((data ?? []) as CreationRowWithFolder[])
        .map((creation) => {
          const isOwner = creation.owner_user_id === user.id;
          const isShared = sharedCreationIds.has(creation.id);

          return {
            ...creation,
            folder: normalizeFolder(creation.folder),
            is_owner: isOwner,
            is_shared: isShared,
          } satisfies Creation;
        })
        .filter((creation) => creation.is_owner || creation.is_shared);

      let filtered = accessibleCreations;
      if (filters?.ownership === 'mine') {
        filtered = accessibleCreations.filter((creation) => creation.is_owner);
      } else if (filters?.ownership === 'shared') {
        filtered = accessibleCreations.filter((creation) => !creation.is_owner && creation.is_shared);
      }

      setCreations(filtered);
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, failForMissingFamilyScope, failForMissingProfileScope, profileId, user]);

  const createCreation = useCallback(async (data: CreateCreationInput): Promise<Creation | null> => {
    if (!user) {
      return null;
    }

    if (!activeFamilyId) {
      failForMissingFamilyScope(true);
      return null;
    }

    if (!profileId) {
      failForMissingProfileScope(true);
      return null;
    }

    setScopeError(null);

    const insertPayload: CreationInsert = {
      detail_id: data.detail_id,
      family_id: activeFamilyId,
      folder_id: data.folder_id ?? null,
      meta: data.meta ?? {},
      owner_profile_id: profileId,
      owner_user_id: user.id,
      thumbnail_url: data.thumbnail_url ?? null,
      title: data.title,
      type: data.type,
    };

    const { data: creation, error } = await supabase
      .from('creations')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Error creating creation:', error);
      toast.error('Failed to save creation');
      return null;
    }

    setCreations((prev) => [{ ...(creation as Creation), is_owner: true, is_shared: false }, ...prev]);
    return creation as Creation;
  }, [activeFamilyId, failForMissingFamilyScope, failForMissingProfileScope, profileId, user]);

  const updateCreation = useCallback(async (creationId: string, data: UpdateCreationInput): Promise<boolean> => {
    if (!activeFamilyId) {
      failForMissingFamilyScope(true);
      return false;
    }

    setScopeError(null);

    const { error } = await supabase
      .from('creations')
      .update(data)
      .eq('id', creationId)
      .eq('family_id', activeFamilyId);

    if (error) {
      console.error('Error updating creation:', error);
      toast.error('Failed to update');
      return false;
    }

    const nextFolder = data.folder_id === undefined
      ? undefined
      : folders.find((folder) => folder.id === data.folder_id);

    setCreations((prev) => prev.map((creation) => (
      creation.id === creationId
        ? {
            ...creation,
            ...data,
            folder: data.folder_id === undefined ? creation.folder : nextFolder,
          }
        : creation
    )));
    toast.success('Updated');
    return true;
  }, [activeFamilyId, failForMissingFamilyScope, folders]);

  const deleteCreation = useCallback(async (creationId: string): Promise<boolean> => {
    if (!activeFamilyId) {
      failForMissingFamilyScope(true);
      return false;
    }

    setScopeError(null);

    let creation = creations.find((entry) => entry.id === creationId);

    if (!creation) {
      const { data, error } = await supabase
        .from('creations')
        .select('id, detail_id, type')
        .eq('id', creationId)
        .eq('family_id', activeFamilyId)
        .maybeSingle();

      if (error || !data) {
        console.error('Error loading creation for delete:', error);
        toast.error('Failed to delete');
        return false;
      }

      creation = data as Pick<Creation, 'detail_id' | 'id' | 'type'> as Creation;
    }

    const { error } = await supabase
      .from('creations')
      .delete()
      .eq('id', creationId)
      .eq('family_id', activeFamilyId);

    if (error) {
      console.error('Error deleting creation:', error);
      toast.error('Failed to delete');
      return false;
    }

    if (creation.type === 'activity') {
      await supabase
        .from('activity_details')
        .delete()
        .eq('id', creation.detail_id)
        .eq('family_id', activeFamilyId);
    } else if (creation.type === 'coloring_page') {
      await supabase
        .from('coloring_page_details')
        .delete()
        .eq('id', creation.detail_id)
        .eq('family_id', activeFamilyId);
    }

    setCreations((prev) => prev.filter((entry) => entry.id !== creationId));
    toast.success('Deleted');
    return true;
  }, [activeFamilyId, creations, failForMissingFamilyScope]);

  const moveToFolder = useCallback(async (creationId: string, folderId: string | null): Promise<boolean> => {
    return updateCreation(creationId, { folder_id: folderId });
  }, [updateCreation]);

  // ===== DETAIL OPERATIONS =====

  const fetchActivityDetail = useCallback(async (detailId: string): Promise<ActivityDetail | null> => {
    if (!activeFamilyId) {
      failForMissingFamilyScope();
      return null;
    }

    setScopeError(null);

    const { data, error } = await supabase
      .from('activity_details')
      .select('*')
      .eq('id', detailId)
      .eq('family_id', activeFamilyId)
      .single();

    if (error) {
      console.error('Error fetching activity detail:', error);
      return null;
    }

    return data as ActivityDetail;
  }, [activeFamilyId, failForMissingFamilyScope]);

  const fetchColoringPageDetail = useCallback(async (detailId: string): Promise<ColoringPageDetail | null> => {
    if (!activeFamilyId) {
      failForMissingFamilyScope();
      return null;
    }

    setScopeError(null);

    const { data, error } = await supabase
      .from('coloring_page_details')
      .select('*')
      .eq('id', detailId)
      .eq('family_id', activeFamilyId)
      .single();

    if (error) {
      console.error('Error fetching coloring page detail:', error);
      return null;
    }

    return data as ColoringPageDetail;
  }, [activeFamilyId, failForMissingFamilyScope]);

  // ===== SHARING OPERATIONS =====

  const fetchFamilyMembers = useCallback(async () => {
    if (!user) {
      setFamilyMembers([]);
      setScopeError(null);
      return;
    }

    if (!activeFamilyId) {
      setFamilyMembers([]);
      failForMissingFamilyScope();
      return;
    }

    if (!profileId) {
      setFamilyMembers([]);
      failForMissingProfileScope();
      return;
    }

    setScopeError(null);

    const { data: familyMemberRecords, error } = await supabase
      .from('family_members')
      .select('profile_id, profiles!family_members_profile_id_fkey(id, full_name, email, avatar_url)')
      .eq('family_id', activeFamilyId)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching family members:', error);
      toast.error('Unable to load family members for creation sharing');
      setFamilyMembers([]);
      return;
    }

    const members = ((familyMemberRecords ?? []) as FamilyMemberRecord[])
      .map((record) => {
        const profile = Array.isArray(record.profiles) ? record.profiles[0] : record.profiles;
        if (!profile || profile.id === profileId) {
          return null;
        }

        return {
          id: profile.id,
          full_name: profile.full_name ?? profile.email ?? 'Family member',
          email: profile.email ?? null,
          avatar_url: profile.avatar_url ?? null,
        } satisfies FamilyMember;
      })
      .filter((member): member is FamilyMember => member !== null);

    setFamilyMembers(
      members.filter(
        (member, index, collection) =>
          collection.findIndex((candidate) => candidate.id === member.id) === index,
      ),
    );
  }, [activeFamilyId, failForMissingFamilyScope, failForMissingProfileScope, profileId, user]);

  const fetchShares = useCallback(async (creationId: string): Promise<CreationShare[]> => {
    if (!activeFamilyId) {
      failForMissingFamilyScope();
      return [];
    }

    setScopeError(null);

    const { data, error } = await supabase
      .from('creation_shares')
      .select('*')
      .eq('creation_id', creationId)
      .eq('family_id', activeFamilyId);

    if (error) {
      console.error('Error fetching shares:', error);
      return [];
    }

    return (data ?? []) as CreationShare[];
  }, [activeFamilyId, failForMissingFamilyScope]);

  const shareCreation = useCallback(async (creationId: string, targetProfileId: string): Promise<boolean> => {
    if (!user) {
      return false;
    }

    if (!activeFamilyId) {
      failForMissingFamilyScope(true);
      return false;
    }

    setScopeError(null);

    const insertPayload: CreationShareInsert = {
      creation_id: creationId,
      family_id: activeFamilyId,
      owner_user_id: user.id,
      permission: 'view',
      shared_with_profile_id: targetProfileId,
    };

    const { error } = await supabase
      .from('creation_shares')
      .insert(insertPayload);

    if (error) {
      if (error.code === '23505') {
        return true;
      }

      console.error('Error sharing creation:', error);
      toast.error('Failed to share');
      return false;
    }

    toast.success('Shared successfully');
    return true;
  }, [activeFamilyId, failForMissingFamilyScope, user]);

  const unshareCreation = useCallback(async (creationId: string, targetProfileId: string): Promise<boolean> => {
    if (!activeFamilyId) {
      failForMissingFamilyScope(true);
      return false;
    }

    setScopeError(null);

    const { error } = await supabase
      .from('creation_shares')
      .delete()
      .eq('creation_id', creationId)
      .eq('family_id', activeFamilyId)
      .eq('shared_with_profile_id', targetProfileId);

    if (error) {
      console.error('Error unsharing creation:', error);
      toast.error('Failed to remove share');
      return false;
    }

    toast.success('Share removed');
    return true;
  }, [activeFamilyId, failForMissingFamilyScope]);

  // ===== INITIALIZATION =====

  useEffect(() => {
    if (!user) {
      setFolders([]);
      return;
    }

    void fetchFolders();
  }, [fetchFolders, user]);

  return {
    creations,
    folders,
    familyMembers,
    loading,
    scopeError,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    fetchCreations,
    createCreation,
    updateCreation,
    deleteCreation,
    moveToFolder,
    fetchActivityDetail,
    fetchColoringPageDetail,
    fetchShares,
    shareCreation,
    unshareCreation,
    fetchFamilyMembers,
  };
}
