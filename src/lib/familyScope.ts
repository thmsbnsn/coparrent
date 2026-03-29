import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations-supabase/types";

type MemberRole = Database["public"]["Enums"]["member_role"];

const FAMILY_PARENT_ROLES: MemberRole[] = ["parent", "guardian"];

interface FamilyParentRow {
  profile_id: string;
  role: MemberRole;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface FamilyChildLinkSyncResult {
  ok?: boolean;
  message?: string;
}

export interface FamilyParentProfile {
  fullName: string | null;
  profileId: string;
  role: MemberRole;
}

const syncedFamilies = new Set<string>();
const syncRequests = new Map<string, Promise<boolean>>();

const uniqueIds = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

export const fetchChildIdsForProfile = async (profileId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("parent_children")
    .select("child_id")
    .eq("parent_id", profileId);

  if (error) {
    throw error;
  }

  return uniqueIds((data ?? []).map((row) => row.child_id));
};

export const fetchFamilyParentProfiles = async (familyId: string): Promise<FamilyParentProfile[]> => {
  const { data, error } = await supabase
    .from("family_members")
    .select(`
      profile_id,
      role,
      profiles!family_members_profile_id_fkey (
        full_name
      )
    `)
    .eq("family_id", familyId)
    .eq("status", "active")
    .in("role", [...FAMILY_PARENT_ROLES]);

  if (error) {
    throw error;
  }

  return ((data ?? []) as FamilyParentRow[])
    .filter((row) => !!row.profile_id)
    .map((row) => ({
      fullName: row.profiles?.full_name ?? null,
      profileId: row.profile_id,
      role: row.role,
    }))
    .sort((left, right) => {
      const leftName = (left.fullName ?? "").toLowerCase();
      const rightName = (right.fullName ?? "").toLowerCase();
      return leftName.localeCompare(rightName);
    });
};

export const fetchFamilyChildIds = async (familyId: string): Promise<string[]> => {
  const parentProfiles = await fetchFamilyParentProfiles(familyId);

  if (parentProfiles.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("parent_children")
    .select("child_id")
    .in(
      "parent_id",
      parentProfiles.map((profile) => profile.profileId),
    );

  if (error) {
    throw error;
  }

  return uniqueIds((data ?? []).map((row) => row.child_id));
};

export const ensureFamilyChildLinksSynced = async (familyId: string): Promise<boolean> => {
  if (syncedFamilies.has(familyId)) {
    return true;
  }

  const existingRequest = syncRequests.get(familyId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = supabase
    .rpc("rpc_sync_family_child_links", {
      p_family_id: familyId,
    })
    .then(({ data, error }) => {
      if (error) {
        console.warn("Unable to sync family child links:", error);
        return false;
      }

      const result = (data ?? {}) as FamilyChildLinkSyncResult;
      if (result.ok === false) {
        console.warn("Family child link sync returned a non-success result:", result.message);
        return false;
      }

      syncedFamilies.add(familyId);
      return true;
    })
    .finally(() => {
      syncRequests.delete(familyId);
    });

  syncRequests.set(familyId, request);
  return request;
};
