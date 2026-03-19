import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLoginNotification } from "@/hooks/useLoginNotification";
import { setSentryUserContext, clearSentryUserContext } from "@/lib/sentry";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { checkAndNotifyLogin } = useLoginNotification();
  const loginCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Check for new device on sign in (defer to avoid deadlock)
        if (event === "SIGNED_IN" && currentSession?.user) {
          const userId = currentSession.user.id;
          // Only check once per session to avoid duplicate notifications
          if (loginCheckedRef.current !== userId) {
            loginCheckedRef.current = userId;
            setTimeout(() => {
              checkAndNotifyLogin(userId, currentSession.user.email || "");
              // Set Sentry user context (fetch role/tier asynchronously)
              supabase
                .from("profiles")
                .select("account_role, subscription_tier")
                .eq("user_id", userId)
                .maybeSingle()
                .then(({ data: profile }) => {
                  setSentryUserContext({
                    userId,
                    role: (profile?.account_role as "parent" | "guardian" | "third_party" | "child") || "parent",
                    tier: (profile?.subscription_tier as "free" | "power") || "free",
                  });
                });
            }, 0);
          }
        }

        // Reset on sign out
        if (event === "SIGNED_OUT") {
          loginCheckedRef.current = null;
          clearSentryUserContext();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkAndNotifyLogin]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
