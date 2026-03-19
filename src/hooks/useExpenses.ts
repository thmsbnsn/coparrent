import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { handleError, ERROR_MESSAGES } from "@/lib/errorMessages";
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reimbursementRequests, setReimbursementRequests] = useState<ReimbursementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ id: string; co_parent_id: string | null } | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    
    const { data } = await supabase
      .from('profiles')
      .select('id, co_parent_id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    setProfile(data);
  }, [user]);

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          creator:profiles!fk_created_by(id, full_name, email),
          child:children(id, name)
        `)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      const message = handleError(error, { feature: 'Expenses', action: 'fetch' });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchReimbursementRequests = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('reimbursement_requests')
        .select(`
          *,
          expense:expenses(*),
          requester:profiles!fk_requester(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReimbursementRequests((data || []) as ReimbursementRequest[]);
    } catch (error) {
      console.error('Error fetching reimbursement requests:', error);
    }
  }, [user]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      void fetchExpenses();
      void fetchReimbursementRequests();
    }
  }, [fetchExpenses, fetchReimbursementRequests, profile]);

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
    if (!profile) return { error: 'No profile found' };

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
          created_by: profile.id,
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
    // Guard against double-submits
    const mutationKey = getMutationKey("deleteExpense", expenseId);
    if (!acquireMutationLock(mutationKey)) {
      return { error: ERROR_MESSAGES.DUPLICATE_REQUEST };
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

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
    if (!profile?.co_parent_id) {
      return { error: 'No co-parent linked' };
    }

    try {
      const { error } = await supabase
        .from('reimbursement_requests')
        .insert({
          expense_id: expenseId,
          requester_id: profile.id,
          recipient_id: profile.co_parent_id,
          amount,
          message,
        });

      if (error) throw error;
      
      await fetchReimbursementRequests();
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
    try {
      const { error } = await supabase
        .from('reimbursement_requests')
        .update({
          status,
          response_message: responseMessage,
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
      
      await fetchReimbursementRequests();
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
    const myExpenses = expenses.filter(e => e.created_by === profile?.id);
    const coParentExpenses = expenses.filter(e => e.created_by !== profile?.id);

    const myTotal = myExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const coParentTotal = coParentExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const pendingRequests = reimbursementRequests.filter(r => r.status === 'pending');
    const pendingFromMe = pendingRequests.filter(r => r.requester_id === profile?.id);
    const pendingToMe = pendingRequests.filter(r => r.recipient_id === profile?.id);

    return {
      myTotal,
      coParentTotal,
      grandTotal: myTotal + coParentTotal,
      pendingFromMe: pendingFromMe.reduce((sum, r) => sum + Number(r.amount), 0),
      pendingToMe: pendingToMe.reduce((sum, r) => sum + Number(r.amount), 0),
      pendingRequestsToMe: pendingToMe,
    };
  };

  return {
    expenses,
    reimbursementRequests,
    loading,
    profile,
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
