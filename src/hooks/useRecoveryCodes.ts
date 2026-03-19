import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface RecoveryCodeStatus {
  hasGeneratedCodes: boolean;
  remaining: number;
  generatedAt: string | null;
  isEnabled: boolean;
}

export const useRecoveryCodes = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RecoveryCodeStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!user) return null;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-recovery-codes", {
        body: { action: "status" },
      });

      if (error) throw error;
      
      setStatus(data);
      return data as RecoveryCodeStatus;
    } catch (error) {
      console.error("Error fetching recovery code status:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const generateCodes = useCallback(async (): Promise<string[] | null> => {
    if (!user) return null;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-recovery-codes", {
        body: { action: "generate" },
      });

      if (error) throw error;
      
      // Update local status
      setStatus(prev => prev ? {
        ...prev,
        hasGeneratedCodes: true,
        remaining: data.remaining,
        generatedAt: new Date().toISOString(),
      } : null);
      
      return data.codes as string[];
    } catch (error) {
      console.error("Error generating recovery codes:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const verifyCode = useCallback(async (code: string): Promise<{ valid: boolean; remaining?: number }> => {
    if (!user) return { valid: false };
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-recovery-codes", {
        body: { action: "verify", code },
      });

      if (error) throw error;
      
      if (data.valid) {
        setStatus(prev => prev ? { ...prev, remaining: data.remaining } : null);
      }
      
      return { valid: data.valid, remaining: data.remaining };
    } catch (error) {
      console.error("Error verifying recovery code:", error);
      return { valid: false };
    } finally {
      setLoading(false);
    }
  }, [user]);

  const update2FAStatus = useCallback(async (isEnabled: boolean): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase.functions.invoke("manage-recovery-codes", {
        body: { action: "update_2fa_status", isEnabled },
      });

      if (error) throw error;
      
      setStatus(prev => prev ? { ...prev, isEnabled } : null);
      return true;
    } catch (error) {
      console.error("Error updating 2FA status:", error);
      return false;
    }
  }, [user]);

  return {
    loading,
    status,
    fetchStatus,
    generateCodes,
    verifyCode,
    update2FAStatus,
  };
};
