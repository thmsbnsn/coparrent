import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ensureCurrentUserFamilyMembership, hasPendingInviteToken } from "@/lib/familyMembership";

type MemberRole = Database["public"]["Enums"]["member_role"];
type WorkspaceAccessKind = "family_member" | "law_office";

export interface FamilyMembership {
  accessKind: WorkspaceAccessKind;
  familyId: string;
  familyName: string | null;
  role: MemberRole | null;
  relationshipLabel: string | null;
  status: string | null;
  primaryParentId: string | null;
}

interface ActiveFamily {
  id: string;
  display_name: string | null;
}

interface FamilyContextType {
  accountRole: string | null;
  loading: boolean;
  roleLoading: boolean;
  profileId: string | null;
  memberships: FamilyMembership[];
  activeFamilyId: string | null;
  activeFamily: ActiveFamily | null;
  effectiveRole: MemberRole | null;
  relationshipLabel: string | null;
  isParentInActiveFamily: boolean;
  isThirdPartyInActiveFamily: boolean;
  isChildInActiveFamily: boolean;
  isLawOfficeUser: boolean;
  setActiveFamilyId: (familyId: string) => void;
  refresh: () => Promise<void>;
}

interface LawOfficeFamilyAccessRow {
  created_at: string;
  family_id: string | null;
  revoked_at: string | null;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

const storageKeyForUser = (userId: string) => `coparrent.activeFamily.${userId}`;

export const FamilyProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<FamilyMembership[]>([]);
  const [activeFamilyId, setActiveFamilyIdState] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setProfileId(null);
      setAccountRole(null);
      setMemberships([]);
      setActiveFamilyIdState(null);
      setLoading(false);
      setRoleLoading(false);
      return;
    }

    setLoading(true);
    setRoleLoading(true);

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, account_role, full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const nextProfileId = profile?.id ?? null;
      setProfileId(nextProfileId);
      setAccountRole(profile?.account_role ?? null);

      if (!nextProfileId) {
        setMemberships([]);
        setActiveFamilyIdState(null);
        return;
      }

      if (profile?.account_role === "law_office") {
        const { data: accessRows, error: accessError } = await supabase
          .from("law_office_family_access")
          .select("family_id, created_at, revoked_at")
          .is("revoked_at", null)
          .order("created_at", { ascending: true });

        if (accessError) {
          throw accessError;
        }

        const nextMemberships: FamilyMembership[] = ((accessRows as LawOfficeFamilyAccessRow[] | null) ?? [])
          .filter((row) => row.family_id)
          .map((row) => ({
            accessKind: "law_office",
            familyId: row.family_id!,
            familyName: null,
            role: null,
            relationshipLabel: "Law Office",
            status: row.revoked_at ? "revoked" : "active",
            primaryParentId: null,
          }));

        setMemberships(nextMemberships);

        const storageKey = storageKeyForUser(user.id);
        const persistedFamilyId = localStorage.getItem(storageKey);
        const resolvedFamilyId = nextMemberships.some((membership) => membership.familyId === persistedFamilyId)
          ? persistedFamilyId
          : nextMemberships[0]?.familyId ?? null;

        setActiveFamilyIdState(resolvedFamilyId);
        return;
      }

      const loadMembershipRows = async () => {
        const { data: memberRows, error: memberError } = await supabase
          .from("family_members")
          .select("family_id, primary_parent_id, relationship_label, role, status")
          .eq("user_id", user.id);

        if (memberError) {
          throw memberError;
        }

        return (memberRows ?? []).filter(
          (row) =>
            row.family_id &&
            row.status !== "removed" &&
            row.status !== "revoked" &&
            row.status !== "declined",
        );
      };

      let usableRows = await loadMembershipRows();

      const canAutoCreateFamily =
        !hasPendingInviteToken() &&
        (!profile?.account_role || profile.account_role === "parent" || profile.account_role === "guardian");

      if (usableRows.length === 0 && canAutoCreateFamily) {
        try {
          await ensureCurrentUserFamilyMembership(profile?.full_name ?? user.email ?? null);
          usableRows = await loadMembershipRows();
        } catch (ensureError) {
          console.error("Error ensuring family membership:", ensureError);
        }
      }

      const familyIds = [...new Set(usableRows.map((row) => row.family_id!).filter(Boolean))];

      let familyMap = new Map<string, string | null>();
      if (familyIds.length > 0) {
        const { data: familyRows, error: familyError } = await supabase
          .from("families")
          .select("id, display_name")
          .in("id", familyIds);

        if (familyError) {
          throw familyError;
        }

        familyMap = new Map((familyRows ?? []).map((row) => [row.id, row.display_name]));
      }

      const nextMemberships: FamilyMembership[] = usableRows.map((row) => ({
        accessKind: "family_member",
        familyId: row.family_id!,
        familyName: familyMap.get(row.family_id!) ?? null,
        role: row.role ?? null,
        relationshipLabel: row.relationship_label ?? null,
        status: row.status ?? null,
        primaryParentId: row.primary_parent_id ?? null,
      }));

      setMemberships(nextMemberships);

      const storageKey = storageKeyForUser(user.id);
      const persistedFamilyId = localStorage.getItem(storageKey);
      const resolvedFamilyId = nextMemberships.some((membership) => membership.familyId === persistedFamilyId)
        ? persistedFamilyId
        : nextMemberships[0]?.familyId ?? null;

      setActiveFamilyIdState(resolvedFamilyId);
    } catch (error) {
      console.error("Error loading family context:", error);
      setAccountRole(null);
      setMemberships([]);
      setActiveFamilyIdState(null);
    } finally {
      setLoading(false);
      setRoleLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user || loading) {
      return;
    }

    const storageKey = storageKeyForUser(user.id);
    if (activeFamilyId) {
      localStorage.setItem(storageKey, activeFamilyId);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [activeFamilyId, loading, user]);

  const setActiveFamilyId = useCallback(
    (familyId: string) => {
      if (memberships.some((membership) => membership.familyId === familyId)) {
        setActiveFamilyIdState(familyId);
      }
    },
    [memberships],
  );

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.familyId === activeFamilyId) ?? null,
    [activeFamilyId, memberships],
  );

  const value = useMemo<FamilyContextType>(() => {
    const effectiveRole = activeMembership?.role ?? null;
    const isParentInActiveFamily = effectiveRole === "parent" || effectiveRole === "guardian";
    const isThirdPartyInActiveFamily = effectiveRole === "third_party";
    const isChildInActiveFamily = effectiveRole === "child";
    const isLawOfficeUser = accountRole === "law_office";

    return {
      accountRole,
      loading,
      roleLoading,
      profileId,
      memberships,
      activeFamilyId,
      activeFamily: activeMembership
        ? {
            id: activeMembership.familyId,
            display_name: activeMembership.familyName,
          }
        : null,
      effectiveRole,
      relationshipLabel: activeMembership?.relationshipLabel ?? null,
      isParentInActiveFamily,
      isThirdPartyInActiveFamily,
      isChildInActiveFamily,
      isLawOfficeUser,
      setActiveFamilyId,
      refresh,
    };
  }, [accountRole, activeFamilyId, activeMembership, loading, memberships, profileId, refresh, roleLoading, setActiveFamilyId]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
};

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error("useFamily must be used within a FamilyProvider");
  }
  return context;
};
