/**
 * @page-role Action
 * @summary-pattern Tab-organized configuration sections
 * @ownership User's personal settings and family connections
 * @court-view N/A (configuration, not evidentiary)
 * 
 * LAW 1: Action role - focused configuration controls
 * LAW 4: All setting sections use consistent card/form patterns
 * LAW 7: Tab navigation adapts to mobile with preserved functionality
 */
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, Shield, LogOut, Users, Baby, Bug } from "lucide-react";
import { useSearchParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MotionPermissionPrompt } from "@/components/feedback/MotionPermissionPrompt";
import { ProblemReportButton } from "@/components/feedback/ProblemReportButton";
import { useProblemReport } from "@/components/feedback/useProblemReport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CoParentInvite } from "@/components/settings/CoParentInvite";
import { TrialStatus } from "@/components/settings/TrialStatus";
import { AccessCodeRedeemer } from "@/components/settings/AccessCodeRedeemer";
import { ThirdPartyManager } from "@/components/settings/ThirdPartyManager";
import { PreferencesSettings } from "@/components/settings/PreferencesSettings";
import { ChildAccountControls } from "@/components/settings/ChildAccountControls";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { TwoFactorSetup } from "@/components/auth/TwoFactorSetup";
import { PasskeySetup } from "@/components/auth/PasskeySetup";
import { RecoveryCodes } from "@/components/auth/RecoveryCodes";
import { SessionManager } from "@/components/auth/SessionManager";
import { TrustedDevicesManager } from "@/components/auth/TrustedDevicesManager";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { DataExportSection } from "@/components/settings/DataExportSection";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/contexts/FamilyContext";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
}

interface CoParentProfile {
  full_name: string | null;
  email: string | null;
}

interface Invitation {
  id: string;
  invitee_email: string;
  status: string;
  created_at: string;
  expires_at: string;
  token: string;
}

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { activeFamilyId } = useFamily();
  const {
    disableShakeReporting,
    enableShakeReporting,
    motionSupport,
    preferences: problemReportPreferences,
  } = useProblemReport();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { checkSubscription } = useSubscription();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coParent, setCoParent] = useState<CoParentProfile | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
  });

  // Handle successful checkout redirect
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Subscription activated!",
        description: "Thank you for subscribing. Your account has been upgraded.",
      });
      // Refresh subscription status
      checkSubscription();
    }
  }, [searchParams, toast, checkSubscription]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email, trial_started_at, trial_ends_at, subscription_status, subscription_tier")
        .eq("user_id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFormData({
          fullName: profileData.full_name || "",
          email: profileData.email || "",
        });

        // Fetch the other parent/guardian in the ACTIVE family, not a global profile link
        if (activeFamilyId) {
          const { data: familyAdults } = await supabase
            .from("family_members")
            .select("profile_id, role, status, profiles:profile_id(full_name, email)")
            .eq("family_id", activeFamilyId)
            .in("role", ["parent", "guardian"])
            .eq("status", "active");

          const otherAdult = (familyAdults || []).find((member) => member.profile_id !== profileData.id);
          const profileRecord = Array.isArray(otherAdult?.profiles) ? otherAdult.profiles[0] : otherAdult?.profiles;
          setCoParent(profileRecord ? { full_name: profileRecord.full_name, email: profileRecord.email } : null);
        } else {
          setCoParent(null);
        }

        // Fetch invitations
        let invitationsQuery = supabase
          .from("invitations")
          .select("id, invitee_email, status, created_at, expires_at, token")
          .eq("inviter_id", profileData.id)
          .order("created_at", { ascending: false });

        if (activeFamilyId) {
          invitationsQuery = invitationsQuery.eq("family_id", activeFamilyId);
        }

        const { data: invitationsData } = await invitationsQuery;

        setInvitations(invitationsData || []);
      }
    } catch (error) {
      console.error("Error fetching settings data:", error);
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, user]);

  useEffect(() => {
    if (user) {
      void fetchData();
    }
  }, [user, fetchData]);

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.fullName,
          email: formData.email,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error: unknown) {
      toast({
        title: "Failed to save",
        description: "Unable to save your profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl lg:text-3xl font-display font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </motion.div>

        {/* Co-Parent Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          {coParent ? (
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="font-display font-semibold">Linked Co-Parent</h2>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                  {(coParent.full_name || coParent.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{coParent.full_name || "Co-Parent"}</p>
                  <p className="text-sm text-muted-foreground">{coParent.email}</p>
                </div>
              </div>
            </div>
          ) : (
            profile && (
              <CoParentInvite
                profileId={profile.id}
                inviterName={profile.full_name || profile.email || ""}
                existingInvitations={invitations}
                onInviteSent={fetchData}
              />
            )
          )}
        </motion.div>

        {/* Trial Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <TrialStatus
            trialStartedAt={profile?.trial_started_at || null}
            trialEndsAt={profile?.trial_ends_at || null}
            subscriptionStatus={profile?.subscription_status || null}
          />
        </motion.div>

        {/* Access Code Redemption */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.11 }}
        >
          <AccessCodeRedeemer onRedeemed={fetchData} />
        </motion.div>

        {/* Third-Party Access Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <ThirdPartyManager
            subscriptionTier={profile?.subscription_tier || "free"}
            isTrialActive={
              profile?.subscription_status === "trial" &&
              profile?.trial_ends_at &&
              new Date(profile.trial_ends_at) > new Date()
            }
          />
        </motion.div>

        {/* Child Account Controls Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Baby className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold">Child Accounts</h2>
          </div>
          <ChildAccountControls />
        </motion.div>

        {/* Preferences Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <PreferencesSettings />
        </motion.div>

        {/* Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold">Profile</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input 
                  id="fullName" 
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Relationship to Children</Label>
              <Select defaultValue="parent">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="guardian">Guardian</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveProfile}>Save Changes</Button>
          </div>
        </motion.div>

        {/* Notifications Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <NotificationSettings />
        </motion.div>

        {/* Security Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Bug className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold">Support & Feedback</h2>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Report bugs, confusing flows, or feature requests without leaving the app.
            </p>

            <MotionPermissionPrompt
              enabled={problemReportPreferences.shakeEnabled}
              likelyMobile={motionSupport.likelyMobile}
              motionPermissionState={problemReportPreferences.motionPermissionState}
              onDisable={disableShakeReporting}
              onEnable={enableShakeReporting}
              permissionRequired={motionSupport.permissionRequired}
              secure={motionSupport.secure}
              supported={motionSupport.supported}
            />

            <div className="flex flex-wrap gap-3">
              <ProblemReportButton>Open report form</ProblemReportButton>
              <Button asChild variant="ghost">
                <Link to="/help/contact">More support options</Link>
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold">Security</h2>
          </div>

          <div className="space-y-4">
            <TwoFactorSetup onStatusChange={setTwoFactorEnabled} />

            <Separator />

            <PasskeySetup />
            
            <RecoveryCodes isEnabled={twoFactorEnabled} />
            
            <Separator />
            
            <TrustedDevicesManager />
            
            <Separator />
            
            <SessionManager />
            
            <Separator />
            
            <Link to="/forgot-password">
              <Button variant="outline">Change Password</Button>
            </Link>
            
            <Separator />
            
            <DataExportSection />
            
            <Separator />
            
            <div className="pt-2">
              <Button 
                variant="destructive" 
                className="w-full sm:w-auto"
                onClick={signOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
