import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { toast } from "sonner";
import { handleError, ERROR_MESSAGES } from "@/lib/errorMessages";
import { fetchFamilyParentProfiles } from "@/lib/familyScope";
import { 
  getMutationKey, 
  acquireMutationLock, 
  releaseMutationLock 
} from "@/lib/mutations";

export interface Expense {
  id: string;
  created_by: string;
  child_id: string | null;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  family_id: string | null;
  receipt_path: string | null;
  split_percentage: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  child?: {
    id: string;
    name: string;
  };
}

export interface ReimbursementRequest {
  id: string;
  expense_id: string;
  requester_id: string;
  recipient_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  message: string | null;
  response_message: string | null;
  responded_at: string | null;
  created_at: string;
  expense?: Expense;
  requester?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

export const EXPENSE_CATEGORIES = [
  { value: 'medical', label: 'Medical/Health' },
  { value: 'education', label: 'Education/School' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'activities', label: 'Activities/Sports' },
  { value: 'food', label: 'Food/Groceries' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' },
];

export function useExpenses() {
  const { user } = useAuth();
  const { activeFamilyId, isParentInActiveFamily, loading: familyLoading, profileId } = useFamily();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reimbursementRequests, setReimbursementRequests] = useState<ReimbursementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reimbursementRecipientId, setReimbursementRecipientId] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const profile = profileId ? { id: profileId } : null;

  useEffect(() => {
    requestVersionRef.current += 1;
    setExpenses([]);
    setReimbursementRequests([]);

    if (!familyLoading) {
      setLoading(Boolean(activeFamilyId && profileId));
    }
  }, [activeFamilyId, familyLoading, profileId]);

  useEffect(() => {
    const resolveReimbursementRecipient = async () => {
      if (familyLoading) {
        return;
      }

      if (!activeFamilyId || !profileId || !isParentInActiveFamily) {
        setReimbursementRecipientId(null);
        return;
      }

      try {
        const familyParentProfiles = await fetchFamilyParentProfiles(activeFamilyId);
        const recipientProfileId =
          familyParentProfiles.find((familyParent) => familyParent.profileId !== profileId)?.profileId ?? null;
        setReimbursementRecipientId(recipientProfileId);
      } catch (error) {
        console.error("Error resolving reimbursement recipient:", error);
        setReimbursementRecipientId(null);
      }
    };

    void resolveReimbursementRecipient();
  }, [activeFamilyId, familyLoading, isParentInActiveFamily, profileId]);

  const fetchExpensesForFamily = useCallback(async (familyId: string) => {
    const { data, error } = await supabase
      .from("expenses")
      .select(`
        *,
        creator:profiles!fk_created_by(id, full_name, email),
        child:children(id, name)
      `)
      .eq("family_id", familyId)
      .order("expense_date", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []) as Expense[];
  }, []);

  const fetchReimbursementRequestsForExpenses = useCallback(async (expenseIds: string[]) => {
    if (expenseIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from("reimbursement_requests")
      .select(`
        *,
        expense:expenses(*),
        requester:profiles!fk_requester(id, full_name, email)
      `)
      .in("expense_id", expenseIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []) as ReimbursementRequest[];
  }, []);

  const fetchExpenses = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;

    if (familyLoading) {
      return;
    }

    if (!activeFamilyId || !profileId) {
      if (requestVersion === requestVersionRef.current) {
        setExpenses([]);
        setReimbursementRequests([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    try {
      const nextExpenses = await fetchExpensesForFamily(activeFamilyId);

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setExpenses(nextExpenses);

      const nextRequests = await fetchReimbursementRequestsForExpenses(nextExpenses.map((expense) => expense.id));

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setReimbursementRequests(nextRequests);
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      const message = handleError(error, { feature: 'Expenses', action: 'fetch' });
      toast.error(message);
      setExpenses([]);
      setReimbursementRequests([]);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [activeFamilyId, familyLoading, fetchExpensesForFamily, fetchReimbursementRequestsForExpenses, profileId]);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  const addExpense = async (expense: {
    category: string;
    amount: number;
    description: string;
    expense_date: string;
    child_id?: string;
    receipt_path?: string;
    split_percentage?: number;
    notes?: string;
  }) => {
    if (!profileId || !activeFamilyId || !isParentInActiveFamily) {
      return { error: 'Select an active family where you are a parent or guardian.' };
    }

    // Guard against double-submits
    const mutationKey = getMutationKey("addExpense", expense.description, String(expense.amount));
    if (!acquireMutationLock(mutationKey)) {
      return { error: ERROR_MESSAGES.DUPLICATE_REQUEST };
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .insert({
          ...expense,
          created_by: profileId,
          family_id: activeFamilyId,
        });

      if (error) throw error;
      
      await fetchExpenses();
      return { error: null };
    } catch (error: unknown) {
      const message = handleError(error, { feature: 'Expenses', action: 'add' });
      return { error: message };
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!activeFamilyId) {
      return { error: 'Select an active family before deleting expenses.' };
    }

    // Guard against double-submits
    const mutationKey = getMutationKey("deleteExpense", expenseId);
    if (!acquireMutationLock(mutationKey)) {
      return { error: ERROR_MESSAGES.DUPLICATE_REQUEST };
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('family_id', activeFamilyId);

      if (error) throw error;
      await fetchExpenses();
      return { error: null };
    } catch (error: unknown) {
      const message = handleError(error, { feature: 'Expenses', action: 'delete' });
      return { error: message };
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  const requestReimbursement = async (expenseId: string, amount: number, message?: string) => {
    if (!profileId || !activeFamilyId || !isParentInActiveFamily) {
      return { error: 'Select an active family where you are a parent or guardian.' };
    }

    if (!reimbursementRecipientId) {
      return { error: 'No other active parent or guardian found in this family.' };
    }

    const expense = expenses.find(
      (existingExpense) =>
        existingExpense.id === expenseId &&
        existingExpense.family_id === activeFamilyId &&
        existingExpense.created_by === profileId,
    );

    if (!expense) {
      return { error: 'That expense is not available for reimbursement in the active family.' };
    }

    try {
      const { error } = await supabase
        .from('reimbursement_requests')
        .insert({
          expense_id: expenseId,
          requester_id: profileId,
          recipient_id: reimbursementRecipientId,
          amount,
          message,
        });

      if (error) throw error;
      
      await fetchExpenses();
      return { error: null };
    } catch (error: unknown) {
      const message = handleError(error, { feature: 'Expenses', action: 'requestReimbursement' });
      return { error: message };
    }
  };

  const respondToReimbursement = async (
    requestId: string, 
    status: 'approved' | 'rejected' | 'paid',
    responseMessage?: string
  ) => {
    if (!profileId || !activeFamilyId) {
      return { error: 'Select an active family before responding to reimbursement requests.' };
    }

    const activeFamilyRequest = reimbursementRequests.find(
      (request) =>
        request.id === requestId &&
        request.recipient_id === profileId &&
        request.expense?.family_id === activeFamilyId,
    );

    if (!activeFamilyRequest) {
      return { error: 'That reimbursement request is not available in the active family.' };
    }

    try {
      const { error } = await supabase
        .from('reimbursement_requests')
        .update({
          status,
          response_message: responseMessage,
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('recipient_id', profileId);

      if (error) throw error;
      
      await fetchExpenses();
      return { error: null };
    } catch (error: unknown) {
      const message = handleError(error, { feature: 'Expenses', action: 'respondToReimbursement' });
      return { error: message };
    }
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file);

    if (error) {
      const message = handleError(error, { feature: 'Expenses', action: 'uploadReceipt' });
      toast.error(message);
      return null;
    }

    return fileName;
  };

  /**
   * Get a signed URL for accessing receipt files.
   * The receipts bucket is private, so signed URLs are required for access.
   * URLs are valid for 1 hour.
   */
  const getSignedReceiptUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  // Calculate totals
  const getTotals = () => {
    const myExpenses = expenses.filter((expense) => expense.created_by === profileId);
    const otherFamilyExpenses = expenses.filter((expense) => expense.created_by !== profileId);

    const myTotal = myExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const otherFamilyTotal = otherFamilyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const pendingRequests = reimbursementRequests.filter((request) => request.status === 'pending');
    const pendingFromMe = pendingRequests.filter((request) => request.requester_id === profileId);
    const pendingToMe = pendingRequests.filter((request) => request.recipient_id === profileId);

    return {
      myTotal,
      otherFamilyTotal,
      grandTotal: myTotal + otherFamilyTotal,
      pendingFromMe: pendingFromMe.reduce((sum, request) => sum + Number(request.amount), 0),
      pendingToMe: pendingToMe.reduce((sum, request) => sum + Number(request.amount), 0),
      pendingRequestsToMe: pendingToMe,
    };
  };

  return {
    expenses,
    reimbursementRequests,
    loading,
    profile,
    reimbursementRecipientId,
    addExpense,
    deleteExpense,
    requestReimbursement,
    respondToReimbursement,
    uploadReceipt,
    getSignedReceiptUrl,
    getTotals,
    refetch: fetchExpenses,
  };
}
