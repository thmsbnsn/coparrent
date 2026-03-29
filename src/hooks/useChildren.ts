import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/contexts/FamilyContext";
import { useToast } from "@/hooks/use-toast";
import {
  ensureFamilyChildLinksSynced,
  fetchChildIdsForProfile,
  fetchFamilyChildIds,
} from "@/lib/familyScope";

export interface ChildHealth {
  blood_type: string | null;
  allergies: string[] | null;
  medications: string[] | null;
  medical_notes: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  doctor_name: string | null;
  doctor_phone: string | null;
}

export interface ChildSchool {
  school_name: string | null;
  school_phone: string | null;
  grade: string | null;
}

export interface Child {
  id: string;
  name: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  // Health info
  blood_type: string | null;
  allergies: string[] | null;
  medications: string[] | null;
  medical_notes: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  doctor_name: string | null;
  doctor_phone: string | null;
  // School info
  school_name: string | null;
  school_phone: string | null;
  grade: string | null;
}

interface AddChildRpcResponse {
  ok: boolean;
  code?: string;
  message?: string;
  data?: Pick<Child, "id" | "name" | "date_of_birth" | "created_at">;
}

export const useChildren = () => {
  const {
    activeFamilyId,
    isParentInActiveFamily,
    loading: familyLoading,
    profileId,
    roleLoading,
  } = useFamily();
  const { toast } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch children
  useEffect(() => {
    const fetchChildren = async () => {
      if (familyLoading || roleLoading) {
        return;
      }

      if (!profileId) {
        setChildren([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        if (activeFamilyId && isParentInActiveFamily) {
          await ensureFamilyChildLinksSynced(activeFamilyId);
        }

        const childIds = activeFamilyId
          ? await fetchFamilyChildIds(activeFamilyId)
          : await fetchChildIdsForProfile(profileId);

        if (childIds.length === 0) {
          setChildren([]);
          return;
        }

        const { data, error } = await supabase
          .from("children")
          .select("*")
          .in("id", childIds)
          .order("name");

        if (error) {
          throw error;
        }

        setChildren((data as Child[]) || []);
      } catch (error) {
        console.error("Error fetching children:", error);
        toast({
          title: "Error",
          description: "Failed to load children",
          variant: "destructive",
        });
        setChildren([]);
      }
      finally {
        setLoading(false);
      }
    };

    void fetchChildren();
  }, [activeFamilyId, familyLoading, isParentInActiveFamily, profileId, roleLoading, toast]);

  const addChild = async (name: string, dateOfBirth?: string) => {
    if (!profileId) {
      toast({
        title: "Error",
        description: "You must be logged in to add a child",
        variant: "destructive",
      });
      return null;
    }

    // Validate name length on client side too
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      toast({
        title: "Error",
        description: "Child name must be between 1 and 100 characters",
        variant: "destructive",
      });
      return null;
    }

    // Use RPC function with limit enforcement
    const { data, error } = activeFamilyId
      ? await supabase.rpc("rpc_add_child_to_family", {
          p_family_id: activeFamilyId,
          p_name: trimmedName,
          p_dob: dateOfBirth || null,
        })
      : await supabase.rpc("rpc_add_child", {
          p_name: trimmedName,
          p_dob: dateOfBirth || null,
        });

    if (error) {
      console.error("Error creating child:", error);
      toast({
        title: "Error",
        description: "Failed to add child",
        variant: "destructive",
      });
      return null;
    }

    // Parse structured response
    const result = data as AddChildRpcResponse;

    if (!result.ok) {
      // Handle specific error codes
      if (result.code === "LIMIT_REACHED") {
        toast({
          title: "Plan Limit Reached",
          description: result.message || "Upgrade to Power to add more children.",
          variant: "destructive",
        });
      } else if (result.code === "NOT_PARENT") {
        toast({
          title: "Permission Denied",
          description: "Only parents can add children.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to add child",
          variant: "destructive",
        });
      }
      return null;
    }

    if (result.data) {
      const newChild: Child = {
        id: result.data.id,
        name: result.data.name,
        date_of_birth: result.data.date_of_birth,
        created_at: result.data.created_at,
        updated_at: result.data.created_at,
        avatar_url: null,
        blood_type: null,
        allergies: null,
        medications: null,
        medical_notes: null,
        emergency_contact: null,
        emergency_phone: null,
        doctor_name: null,
        doctor_phone: null,
        school_name: null,
        school_phone: null,
        grade: null,
      };
      setChildren((prev) => [...prev, newChild]);
      toast({
        title: "Success",
        description: `${trimmedName} has been added`,
      });
      return newChild;
    }

    return null;
  };

  const updateChild = async (
    childId: string,
    updates: Partial<Omit<Child, "id" | "created_at" | "updated_at">>
  ) => {
    const { error } = await supabase
      .from("children")
      .update(updates)
      .eq("id", childId);

    if (error) {
      console.error("Error updating child:", error);
      toast({
        title: "Error",
        description: "Failed to update child",
        variant: "destructive",
      });
      return false;
    }

    setChildren((prev) =>
      prev.map((c) => (c.id === childId ? { ...c, ...updates } : c))
    );
    toast({
      title: "Success",
      description: "Child information updated",
    });
    return true;
  };

  return {
    children,
    loading,
    addChild,
    updateChild,
  };
};
