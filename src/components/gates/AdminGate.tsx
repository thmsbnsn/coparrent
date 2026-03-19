import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldX, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AdminGateProps {
  children: ReactNode;
  /** Show inline message instead of full card overlay */
  inline?: boolean;
  /** Show nothing instead of access denied message when locked */
  hideWhenLocked?: boolean;
  /** Custom fallback component */
  fallback?: ReactNode;
}

/**
 * AdminGate - Server-validated admin role check
 * 
 * SECURITY: Uses database function has_role() which is SECURITY DEFINER
 * to prevent privilege escalation. Never relies on client-side state.
 * 
 * Gated features:
 * - Law Library admin (upload, edit, delete resources)
 * - User management
 * - System configuration
 */
export const AdminGate = ({
  children,
  inline = false,
  hideWhenLocked = false,
  fallback,
}: AdminGateProps) => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Use the database function for secure role checking
        const { data, error } = await supabase.rpc("is_admin");
        
        if (error) {
          console.error("Admin check error:", error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (err) {
        console.error("Admin check failed:", err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkAdminRole();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return inline ? (
      <Skeleton className="h-8 w-full" />
    ) : (
      <Card className="border-dashed">
        <CardContent className="p-6">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isAdmin) {
    return <>{children}</>;
  }

  if (hideWhenLocked) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (inline) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <ShieldX className="h-4 w-4" />
        <span>Admin access required</span>
      </div>
    );
  }

  return (
    <Card className="border-dashed border-2 border-destructive/20 bg-destructive/5">
      <CardContent className="p-6 flex flex-col items-center text-center gap-4">
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <Shield className="h-6 w-6 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Admin Access Required</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            This feature is only available to administrators.
          </p>
        </div>

        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Return to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
};
