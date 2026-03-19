import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyRole } from "./useFamilyRole";
import { useToast } from "./use-toast";
import { handleError, ERROR_MESSAGES } from "@/lib/errorMessages";
import { 
  getMutationKey, 
  acquireMutationLock, 
  releaseMutationLock 
} from "@/lib/mutations";

export interface GiftList {
  id: string;
  child_id: string;
  primary_parent_id: string;
  occasion_type: string;
  custom_occasion_name: string | null;
  event_date: string | null;
  allow_multiple_claims: boolean;
  created_at: string;
  updated_at: string;
  child_name?: string;
  items_count?: number;
  claimed_count?: number;
}

export interface GiftItem {
  id: string;
  gift_list_id: string;
  title: string;
  category: string;
  suggested_age_range: string | null;
  notes: string | null;
  parent_only_notes: string | null;
  link: string | null;
  status: string;
  claimed_by: string | null;
  claimed_by_name?: string | null;
  claimed_at: string | null;
  purchased: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface GiftListRow extends GiftList {
  children?: {
    name: string;
  } | {
    name: string;
  }[] | null;
}

interface GiftItemRow extends GiftItem {
  claimer?: {
    full_name: string | null;
    email: string | null;
  } | {
    full_name: string | null;
    email: string | null;
  }[] | null;
}

export type OccasionType = "birthday" | "christmas" | "holiday" | "custom";
export type GiftCategory = "toy" | "clothing" | "experience" | "book" | "electronics" | "other";

export const OCCASION_TYPES: { value: OccasionType; label: string }[] = [
  { value: "birthday", label: "Birthday" },
  { value: "christmas", label: "Christmas" },
  { value: "holiday", label: "Holiday" },
  { value: "custom", label: "Custom" },
];

export const GIFT_CATEGORIES: { value: GiftCategory; label: string }[] = [
  { value: "toy", label: "Toy" },
  { value: "clothing", label: "Clothing" },
  { value: "experience", label: "Experience" },
  { value: "book", label: "Book" },
  { value: "electronics", label: "Electronics" },
  { value: "other", label: "Other" },
];

export const useGiftLists = (childId?: string) => {
  const { toast } = useToast();
  const { profileId, primaryParentId, isParent, loading: roleLoading } = useFamilyRole();
  
  const [giftLists, setGiftLists] = useState<GiftList[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGiftLists = useCallback(async () => {
    if (!primaryParentId) return;

    try {
      let query = supabase
        .from("gift_lists")
        .select(`
          *,
          children!gift_lists_child_id_fkey (name)
        `)
        .eq("primary_parent_id", primaryParentId)
        .order("event_date", { ascending: true, nullsFirst: false });

      if (childId) {
        query = query.eq("child_id", childId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch item counts for each list
      const listsWithCounts = await Promise.all(
        ((data ?? []) as GiftListRow[]).map(async (list) => {
          const { count: itemsCount } = await supabase
            .from("gift_items")
            .select("*", { count: "exact", head: true })
            .eq("gift_list_id", list.id);

          const { count: claimedCount } = await supabase
            .from("gift_items")
            .select("*", { count: "exact", head: true })
            .eq("gift_list_id", list.id)
            .neq("status", "unclaimed");

          return {
            ...list,
            child_name: Array.isArray(list.children) ? list.children[0]?.name : list.children?.name,
            items_count: itemsCount || 0,
            claimed_count: claimedCount || 0,
          };
        })
      );

      setGiftLists(listsWithCounts);
    } catch (error) {
      handleError(error, { feature: 'Gifts', action: 'fetchLists' });
    } finally {
      setLoading(false);
    }
  }, [primaryParentId, childId]);

  const createGiftList = async (data: {
    child_id: string;
    occasion_type: string;
    custom_occasion_name?: string;
    event_date?: string;
    allow_multiple_claims?: boolean;
  }) => {
    if (!primaryParentId) return null;

    // Guard against double-submits
    const mutationKey = getMutationKey("createGiftList", data.child_id, data.occasion_type);
    if (!acquireMutationLock(mutationKey)) {
      return null;
    }

    try {
      const { data: newList, error } = await supabase
        .from("gift_lists")
        .insert({
          ...data,
          primary_parent_id: primaryParentId,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Gift list created",
        description: "The gift list has been created successfully.",
      });

      await fetchGiftLists();
      return newList;
    } catch (error: unknown) {
      const message = handleError(error, { feature: 'Gifts', action: 'createList' });
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return null;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const updateGiftList = async (
    listId: string,
    updates: Partial<GiftList>
  ) => {
    // Guard against double-submits
    const mutationKey = getMutationKey("updateGiftList", listId);
    if (!acquireMutationLock(mutationKey)) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("gift_lists")
        .update(updates)
        .eq("id", listId);

      if (error) throw error;

      toast({
        title: "Gift list updated",
        description: "Changes saved successfully.",
      });

      await fetchGiftLists();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Gifts', action: 'updateList' });
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const deleteGiftList = async (listId: string) => {
    // Guard against double-submits
    const mutationKey = getMutationKey("deleteGiftList", listId);
    if (!acquireMutationLock(mutationKey)) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("gift_lists")
        .delete()
        .eq("id", listId);

      if (error) throw error;

      toast({
        title: "Gift list deleted",
        description: "The gift list has been removed.",
      });

      await fetchGiftLists();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Gifts', action: 'deleteList' });
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  useEffect(() => {
    if (!roleLoading && primaryParentId) {
      fetchGiftLists();
    }
  }, [roleLoading, primaryParentId, fetchGiftLists]);

  return {
    giftLists,
    loading: loading || roleLoading,
    isParent,
    profileId,
    createGiftList,
    updateGiftList,
    deleteGiftList,
    refreshLists: fetchGiftLists,
  };
};

export const useGiftItems = (listId: string) => {
  const { toast } = useToast();
  const { profileId, isParent, loading: roleLoading } = useFamilyRole();
  
  const [items, setItems] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!listId) return;

    try {
      const { data, error } = await supabase
        .from("gift_items")
        .select(`
          *,
          claimer:profiles!gift_items_claimed_by_fkey (full_name, email)
        `)
        .eq("gift_list_id", listId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const formattedItems = ((data ?? []) as GiftItemRow[]).map((item) => ({
        ...item,
        claimed_by_name: Array.isArray(item.claimer)
          ? item.claimer[0]?.full_name || item.claimer[0]?.email || null
          : item.claimer?.full_name || item.claimer?.email || null,
      }));

      setItems(formattedItems);
    } catch (error) {
      handleError(error, { feature: 'Gifts', action: 'fetchItems' });
    } finally {
      setLoading(false);
    }
  }, [listId]);

  const addItem = async (data: {
    title: string;
    category?: string;
    suggested_age_range?: string;
    notes?: string;
    parent_only_notes?: string;
    link?: string;
  }) => {
    if (!profileId) return null;

    // Guard against double-submits
    const mutationKey = getMutationKey("addGiftItem", listId, data.title);
    if (!acquireMutationLock(mutationKey)) {
      return null;
    }

    try {
      const { data: newItem, error } = await supabase
        .from("gift_items")
        .insert({
          ...data,
          gift_list_id: listId,
          created_by: profileId,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Gift added",
        description: "The gift has been added to the list.",
      });

      await fetchItems();
      return newItem;
    } catch (error) {
      const message = handleError(error, { feature: 'Gifts', action: 'addItem' });
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return null;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const updateItem = async (itemId: string, updates: Partial<GiftItem>) => {
    // Guard against double-submits
    const mutationKey = getMutationKey("updateGiftItem", itemId);
    if (!acquireMutationLock(mutationKey)) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("gift_items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;

      await fetchItems();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Gifts', action: 'updateItem' });
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const claimItem = async (itemId: string) => {
    if (!profileId) return false;

    // Guard against double-submits (race condition on claims)
    const mutationKey = getMutationKey("claimGiftItem", itemId);
    if (!acquireMutationLock(mutationKey)) {
      toast({
        title: "Please wait",
        description: "Processing your claim...",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from("gift_items")
        .update({
          status: "claimed",
          claimed_by: profileId,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) throw error;

      toast({
        title: "Gift claimed",
        description: "You have claimed this gift.",
      });

      await fetchItems();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Gifts', action: 'claimItem' });
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const unclaimItem = async (itemId: string) => {
    // Guard against double-submits
    const mutationKey = getMutationKey("unclaimGiftItem", itemId);
    if (!acquireMutationLock(mutationKey)) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("gift_items")
        .update({
          status: "unclaimed",
          claimed_by: null,
          claimed_at: null,
        })
        .eq("id", itemId);

      if (error) throw error;

      toast({
        title: "Claim removed",
        description: "You have removed your claim on this gift.",
      });

      await fetchItems();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Gifts', action: 'unclaimItem' });
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const markPurchased = async (itemId: string, purchased: boolean) => {
    // Guard against double-submits
    const mutationKey = getMutationKey("markPurchased", itemId);
    if (!acquireMutationLock(mutationKey)) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("gift_items")
        .update({
          purchased,
          status: purchased ? "purchased" : "claimed",
        })
        .eq("id", itemId);

      if (error) throw error;

      toast({
        title: purchased ? "Marked as purchased" : "Unmarked",
        description: purchased 
          ? "This gift has been marked as purchased." 
          : "Purchase status removed.",
      });

      await fetchItems();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Gifts', action: 'markPurchased' });
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const deleteItem = async (itemId: string) => {
    // Guard against double-submits
    const mutationKey = getMutationKey("deleteGiftItem", itemId);
    if (!acquireMutationLock(mutationKey)) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("gift_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      toast({
        title: "Gift removed",
        description: "The gift has been removed from the list.",
      });

      await fetchItems();
      return true;
    } catch (error) {
      const message = handleError(error, { feature: 'Gifts', action: 'deleteItem' });
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  useEffect(() => {
    if (!roleLoading && listId) {
      fetchItems();
    }
  }, [roleLoading, listId, fetchItems]);

  return {
    items,
    loading: loading || roleLoading,
    isParent,
    profileId,
    addItem,
    updateItem,
    claimItem,
    unclaimItem,
    markPurchased,
    deleteItem,
    refreshItems: fetchItems,
  };
};
