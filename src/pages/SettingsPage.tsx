import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, Bell, Shield, LogOut, Users, UserPlus } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CoParentInvite } from "@/components/settings/CoParentInvite";
import { TrialStatus } from "@/components/settings/TrialStatus";
import { StepParentManager } from "@/components/settings/StepParentManager";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  co_parent_id: string | null;
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
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coParent, setCoParent] = useState<CoParentProfile | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email, co_parent_id, trial_started_at, trial_ends_at, subscription_status, subscription_tier")
        .eq("user_id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFormData({
          fullName: profileData.full_name || "",
          email: profileData.email || "",
        });

        // Fetch co-parent if linked
        if (profileData.co_parent_id) {
          const { data: coParentData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", profileData.co_parent_id)
            .single();
          setCoParent(coParentData);
        }

        // Fetch invitations
        const { data: invitationsData } = await supabase
          .from("invitations")
          .select("id, invitee_email, status, created_at, expires_at, token")
          .eq("inviter_id", profileData.id)
          .order("created_at", { ascending: false });

        setInvitations(invitationsData || []);
      }
    } catch (error) {
      console.error("Error fetching settings data:", error);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (error: any) {
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

        {/* Step-Parent Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <StepParentManager
            subscriptionTier={profile?.subscription_tier || "free"}
            isTrialActive={
              profile?.subscription_status === "trial" &&
              profile?.trial_ends_at &&
              new Date(profile.trial_ends_at) > new Date()
            }
          />
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
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Schedule Changes</p>
                <p className="text-sm text-muted-foreground">Get notified when the parenting schedule is updated</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">New Messages</p>
                <p className="text-sm text-muted-foreground">Receive alerts for new messages from your co-parent</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Upcoming Exchanges</p>
                <p className="text-sm text-muted-foreground">Reminder before each custody exchange</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </motion.div>

        {/* Security Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold">Security</h2>
          </div>

          <div className="space-y-4">
            <Button variant="outline">Change Password</Button>
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
