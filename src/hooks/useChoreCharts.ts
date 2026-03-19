import { useEffect, useMemo, useState } from "react";
import { useFamilyRole } from "@/hooks/useFamilyRole";

export type Household = "all" | "parent_a" | "parent_b";
export type AgeGroup = "preschool" | "child" | "preteen" | "teen";
export type CompletionStyle = "check" | "star";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface ChoreList {
  id: string;
  household: Exclude<Household, "all">;
  household_label: string;
  color_scheme: string;
  allow_child_completion: boolean;
  require_parent_confirm: boolean;
  created_by_parent_id: string;
  created_at: string;
}

export interface ChoreItem {
  id: string;
  chore_list_id: string;
  title: string;
  description: string;
  completion_style: CompletionStyle;
  days_active: Weekday[];
  assigned_child_ids: string[];
}

export interface ChoreCompletion {
  id: string;
  chore_id: string;
  child_id: string;
  date: string;
  completed: boolean;
  completed_by_role: "parent" | "child";
}

interface LocalState {
  choreLists: ChoreList[];
  chores: ChoreItem[];
  completions: ChoreCompletion[];
}

interface CreateChoreListInput {
  household: Exclude<Household, "all">;
  household_label: string;
  color_scheme: string;
  allow_child_completion: boolean;
  require_parent_confirm: boolean;
}

interface AddChoreInput {
  chore_list_id: string;
  title: string;
  description: string;
  completion_style: CompletionStyle;
  days_active: Weekday[];
  assigned_child_ids: string[];
}

interface ToggleCompletionInput {
  choreId: string;
  childId: string;
  date: Date;
  isComplete: boolean;
  role: "parent" | "child";
}

const DEFAULT_STATE: LocalState = {
  choreLists: [],
  chores: [],
  completions: [],
};

const weekdayOrder: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const getStorageKey = (familyId: string | null) =>
  `coparrent-chore-charts:${familyId || "default"}`;

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeWeekdays = (days: Weekday[]) =>
  [...new Set(days)].sort((a, b) => weekdayOrder.indexOf(a) - weekdayOrder.indexOf(b));

export const getAgeGroup = (dateOfBirth: string | null): AgeGroup => {
  if (!dateOfBirth) return "child";

  const dob = new Date(dateOfBirth);
  const age = Math.max(
    0,
    Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
  );

  if (age <= 5) return "preschool";
  if (age <= 9) return "child";
  if (age <= 12) return "preteen";
  return "teen";
};

export const useChoreCharts = () => {
  const { profileId, isParent, activeFamilyId } = useFamilyRole();
  const storageKey = getStorageKey(activeFamilyId);

  const [state, setState] = useState<LocalState>(DEFAULT_STATE);
  const [selectedHousehold, setSelectedHousehold] = useState<Household>("all");
  const [choreListsLoading, setChoreListsLoading] = useState(true);
  const [isCreatingList, setIsCreatingList] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setChoreListsLoading(false);
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
      } else {
        setState(DEFAULT_STATE);
      }
    } catch (error) {
      console.error("Failed to load chore chart state:", error);
      setState(DEFAULT_STATE);
    } finally {
      setChoreListsLoading(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || choreListsLoading) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [choreListsLoading, state, storageKey]);

  const myActiveChoreList = useMemo(() => {
    if (!profileId) return null;
    return (
      state.choreLists.find((list) => list.created_by_parent_id === profileId) || null
    );
  }, [profileId, state.choreLists]);

  const otherParentChoreList = useMemo(() => {
    if (!profileId) return state.choreLists[0] || null;
    return (
      state.choreLists.find((list) => list.created_by_parent_id !== profileId) || null
    );
  }, [profileId, state.choreLists]);

  const createChoreList = async (input: CreateChoreListInput) => {
    if (!profileId) {
      throw new Error("You must be signed in to manage chore charts.");
    }

    setIsCreatingList(true);
    try {
      let nextList: ChoreList;

      setState((current) => {
        const existing = current.choreLists.find(
          (list) => list.created_by_parent_id === profileId
        );

        if (existing) {
          nextList = {
            ...existing,
            ...input,
          };

          return {
            choreLists: current.choreLists.map((list) =>
              list.id === existing.id ? nextList : list
            ),
            chores: current.chores.filter((chore) => chore.chore_list_id !== existing.id),
            completions: current.completions.filter((completion) => {
              const chore = current.chores.find((item) => item.id === completion.chore_id);
              return chore?.chore_list_id !== existing.id;
            }),
          };
        }

        nextList = {
          id: makeId(),
          created_at: new Date().toISOString(),
          created_by_parent_id: profileId,
          ...input,
        };

        return {
          ...current,
          choreLists: [...current.choreLists, nextList],
        };
      });

      return nextList!;
    } finally {
      setIsCreatingList(false);
    }
  };

  const updateChoreList = async (listId: string, updates: Partial<ChoreList>) => {
    setState((current) => ({
      ...current,
      choreLists: current.choreLists.map((list) =>
        list.id === listId ? { ...list, ...updates } : list
      ),
    }));
  };

  const addChore = async (input: AddChoreInput) => {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new Error("Chore title is required.");
    }

    const newChore: ChoreItem = {
      id: makeId(),
      ...input,
      title: trimmedTitle,
      description: input.description.trim(),
      days_active: normalizeWeekdays(input.days_active),
      assigned_child_ids: [...new Set(input.assigned_child_ids)],
    };

    setState((current) => ({
      ...current,
      chores: [...current.chores, newChore],
    }));

    return newChore;
  };

  const deleteChore = async (choreId: string) => {
    setState((current) => ({
      ...current,
      chores: current.chores.filter((chore) => chore.id !== choreId),
      completions: current.completions.filter((completion) => completion.chore_id !== choreId),
    }));
  };

  const toggleCompletion = async ({
    choreId,
    childId,
    date,
    isComplete,
    role,
  }: ToggleCompletionInput) => {
    const dateKey = date.toISOString().slice(0, 10);

    setState((current) => {
      const existing = current.completions.find(
        (completion) =>
          completion.chore_id === choreId &&
          completion.child_id === childId &&
          completion.date === dateKey
      );

      if (existing) {
        return {
          ...current,
          completions: current.completions.map((completion) =>
            completion.id === existing.id
              ? { ...completion, completed: isComplete, completed_by_role: role }
              : completion
          ),
        };
      }

      return {
        ...current,
        completions: [
          ...current.completions,
          {
            id: makeId(),
            chore_id: choreId,
            child_id: childId,
            date: dateKey,
            completed: isComplete,
            completed_by_role: role,
          },
        ],
      };
    });
  };

  const useChoresForList = (listId: string | null) => ({
    data: listId
      ? state.chores.filter((chore) => chore.chore_list_id === listId)
      : [],
  });

  const useCompletions = (
    listId: string | null,
    weekStart: Date,
    weekEnd: Date
  ) => {
    const start = weekStart.toISOString().slice(0, 10);
    const end = weekEnd.toISOString().slice(0, 10);
    const listChoreIds = new Set(
      state.chores
        .filter((chore) => !listId || chore.chore_list_id === listId)
        .map((chore) => chore.id)
    );

    return {
      data: state.completions.filter(
        (completion) =>
          listChoreIds.has(completion.chore_id) &&
          completion.date >= start &&
          completion.date < end
      ),
    };
  };

  return {
    choreLists: state.choreLists,
    choreListsLoading,
    myActiveChoreList,
    otherParentChoreList,
    createChoreList,
    updateChoreList,
    isCreatingList,
    useChoresForList,
    addChore,
    deleteChore,
    useCompletions,
    toggleCompletion,
    selectedHousehold,
    setSelectedHousehold,
    isParent,
    profileId,
  };
};
