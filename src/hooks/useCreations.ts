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
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// Types
export type CreationType = 'activity' | 'coloring_page';

export interface CreationFolder {
  id: string;
  owner_user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Creation {
  id: string;
  owner_user_id: string;
  owner_profile_id: string | null;
  type: CreationType;
  title: string;
  folder_id: string | null;
  thumbnail_url: string | null;
  meta: Json;
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
  creation_id: string;
  owner_user_id: string;
  shared_with_profile_id: string;
  permission: string;
  created_at: string;
}

export interface ActivityDetail {
  id: string;
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
  email: string;
  avatar_url: string | null;
}

interface UseCreationsReturn {
  // Data
  creations: Creation[];
  folders: CreationFolder[];
  familyMembers: FamilyMember[];
  loading: boolean;
  
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
  const [creations, setCreations] = useState<Creation[]>([]);
  const [folders, setFolders] = useState<CreationFolder[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);

  // ===== FOLDER OPERATIONS =====
  
  const fetchFolders = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('creation_folders')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching folders:', error);
      return;
    }
    
    setFolders(data || []);
  }, [user]);

  const createFolder = useCallback(async (name: string): Promise<CreationFolder | null> => {
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('creation_folders')
      .insert({ owner_user_id: user.id, name: name.trim() })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
      return null;
    }
    
    setFolders(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success('Folder created');
    return data;
  }, [user]);

  const updateFolder = useCallback(async (folderId: string, name: string): Promise<boolean> => {
    const { error } = await supabase
      .from('creation_folders')
      .update({ name: name.trim() })
      .eq('id', folderId);
    
    if (error) {
      console.error('Error updating folder:', error);
      toast.error('Failed to update folder');
      return false;
    }
    
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: name.trim() } : f));
    toast.success('Folder updated');
    return true;
  }, []);

  const deleteFolder = useCallback(async (folderId: string): Promise<boolean> => {
    // First, move all creations in this folder to null (unsorted)
    await supabase
      .from('creations')
      .update({ folder_id: null })
      .eq('folder_id', folderId);
    
    const { error } = await supabase
      .from('creation_folders')
      .delete()
      .eq('id', folderId);
    
    if (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
      return false;
    }
    
    setFolders(prev => prev.filter(f => f.id !== folderId));
    toast.success('Folder deleted');
    return true;
  }, []);

  // ===== CREATION OPERATIONS =====
  
  const fetchCreations = useCallback(async (filters?: CreationFilters) => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get user's profile ID for share checking
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      const profileId = profile?.id;

      let query = supabase
        .from('creations')
        .select(`
          *,
          folder:creation_folders(*)
        `);
      
      // Apply filters
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
      
      // Apply sorting
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
        return;
      }
      
      // Get shares for determining ownership display
      const { data: shares } = await supabase
        .from('creation_shares')
        .select('creation_id, shared_with_profile_id');
      
      const sharedCreationIds = new Set(
        shares?.filter(s => s.shared_with_profile_id === profileId).map(s => s.creation_id) || []
      );
      
      // Mark ownership and shared status
      const enrichedCreations = (data || []).map(c => ({
        ...c,
        is_owner: c.owner_user_id === user.id,
        is_shared: sharedCreationIds.has(c.id),
      }));
      
      // Filter by ownership if specified
      let filtered = enrichedCreations;
      if (filters?.ownership === 'mine') {
        filtered = enrichedCreations.filter(c => c.is_owner);
      } else if (filters?.ownership === 'shared') {
        filtered = enrichedCreations.filter(c => !c.is_owner && c.is_shared);
      }
      
      setCreations(filtered);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createCreation = useCallback(async (data: CreateCreationInput): Promise<Creation | null> => {
    if (!user) return null;
    
    // Get profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    const { data: creation, error } = await supabase
      .from('creations')
      .insert({
        owner_user_id: user.id,
        owner_profile_id: profile?.id,
        type: data.type,
        title: data.title,
        folder_id: data.folder_id || null,
        thumbnail_url: data.thumbnail_url || null,
        meta: data.meta || {},
        detail_id: data.detail_id,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating creation:', error);
      toast.error('Failed to save creation');
      return null;
    }
    
    setCreations(prev => [{ ...creation, is_owner: true, is_shared: false }, ...prev]);
    return creation;
  }, [user]);

  const updateCreation = useCallback(async (creationId: string, data: UpdateCreationInput): Promise<boolean> => {
    const { error } = await supabase
      .from('creations')
      .update(data)
      .eq('id', creationId);
    
    if (error) {
      console.error('Error updating creation:', error);
      toast.error('Failed to update');
      return false;
    }
    
    setCreations(prev => prev.map(c => c.id === creationId ? { ...c, ...data } : c));
    toast.success('Updated');
    return true;
  }, []);

  const deleteCreation = useCallback(async (creationId: string): Promise<boolean> => {
    // First get the creation to know the detail table
    const creation = creations.find(c => c.id === creationId);
    if (!creation) return false;
    
    // Delete from creations index (cascades to shares)
    const { error } = await supabase
      .from('creations')
      .delete()
      .eq('id', creationId);
    
    if (error) {
      console.error('Error deleting creation:', error);
      toast.error('Failed to delete');
      return false;
    }
    
    // Also delete the detail record
    if (creation.type === 'activity') {
      await supabase.from('activity_details').delete().eq('id', creation.detail_id);
    } else if (creation.type === 'coloring_page') {
      await supabase.from('coloring_page_details').delete().eq('id', creation.detail_id);
    }
    
    setCreations(prev => prev.filter(c => c.id !== creationId));
    toast.success('Deleted');
    return true;
  }, [creations]);

  const moveToFolder = useCallback(async (creationId: string, folderId: string | null): Promise<boolean> => {
    return updateCreation(creationId, { folder_id: folderId });
  }, [updateCreation]);

  // ===== DETAIL OPERATIONS =====
  
  const fetchActivityDetail = useCallback(async (detailId: string): Promise<ActivityDetail | null> => {
    const { data, error } = await supabase
      .from('activity_details')
      .select('*')
      .eq('id', detailId)
      .single();
    
    if (error) {
      console.error('Error fetching activity detail:', error);
      return null;
    }
    
    return data;
  }, []);

  const fetchColoringPageDetail = useCallback(async (detailId: string): Promise<ColoringPageDetail | null> => {
    const { data, error } = await supabase
      .from('coloring_page_details')
      .select('*')
      .eq('id', detailId)
      .single();
    
    if (error) {
      console.error('Error fetching coloring page detail:', error);
      return null;
    }
    
    return data;
  }, []);

  // ===== SHARING OPERATIONS =====
  
  const fetchFamilyMembers = useCallback(async () => {
    if (!user) return;
    
    // Get user's profile and co-parent
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, co_parent_id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) return;
    
    const members: FamilyMember[] = [];
    
    // Add co-parent if exists
    if (profile.co_parent_id) {
      const { data: coParent } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', profile.co_parent_id)
        .single();
      
      if (coParent) {
        members.push(coParent);
      }
    }
    
    // Get primary parent ID for family members lookup
    const primaryParentId = profile.co_parent_id 
      ? (profile.id < profile.co_parent_id ? profile.id : profile.co_parent_id)
      : profile.id;
    
    // Add other family members (third-party, step-parents, etc.)
    const { data: familyMemberRecords } = await supabase
      .from('family_members')
      .select('profile_id, profiles!family_members_profile_id_fkey(id, full_name, email, avatar_url)')
      .eq('primary_parent_id', primaryParentId)
      .eq('status', 'active');
    
    if (familyMemberRecords) {
      for (const record of familyMemberRecords) {
        if (record.profiles) {
          members.push(record.profiles as unknown as FamilyMember);
        }
      }
    }
    
    setFamilyMembers(members);
  }, [user]);

  const fetchShares = useCallback(async (creationId: string): Promise<CreationShare[]> => {
    const { data, error } = await supabase
      .from('creation_shares')
      .select('*')
      .eq('creation_id', creationId);
    
    if (error) {
      console.error('Error fetching shares:', error);
      return [];
    }
    
    return data || [];
  }, []);

  const shareCreation = useCallback(async (creationId: string, profileId: string): Promise<boolean> => {
    if (!user) return false;
    
    const { error } = await supabase
      .from('creation_shares')
      .insert({
        creation_id: creationId,
        owner_user_id: user.id,
        shared_with_profile_id: profileId,
        permission: 'view',
      });
    
    if (error) {
      if (error.code === '23505') {
        // Already shared
        return true;
      }
      console.error('Error sharing creation:', error);
      toast.error('Failed to share');
      return false;
    }
    
    toast.success('Shared successfully');
    return true;
  }, [user]);

  const unshareCreation = useCallback(async (creationId: string, profileId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('creation_shares')
      .delete()
      .eq('creation_id', creationId)
      .eq('shared_with_profile_id', profileId);
    
    if (error) {
      console.error('Error unsharing creation:', error);
      toast.error('Failed to remove share');
      return false;
    }
    
    toast.success('Share removed');
    return true;
  }, []);

  // ===== INITIALIZATION =====
  
  useEffect(() => {
    if (user) {
      fetchFolders();
    }
  }, [user, fetchFolders]);

  return {
    creations,
    folders,
    familyMembers,
    loading,
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
