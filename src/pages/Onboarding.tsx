import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Users, Baby, Mail, Check, Loader2 } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ensureCurrentUserFamilyMembership } from "@/lib/familyMembership";

const steps = [
  { id: 1, title: "Your Role", icon: Users },
  { id: 2, title: "Children", icon: Baby },
  { id: 3, title: "Invite Co-Parent", icon: Mail },
  { id: 4, title: "Complete", icon: Check },
];

const stepDescriptions: Record<number, string> = {
  1: "Set your account role so CoParrent can shape the family workspace correctly.",
  2: "Add the children who anchor your shared records, scheduling, and communication.",
  3: "Invite the other parent or guardian into the same structured family system.",
  4: "Review the completed setup and move into the live dashboard.",
};

const roles = ["Father", "Mother", "Guardian", "Other"];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [role, setRole] = useState("");
  const [children, setChildren] = useState([{ name: "", dob: "" }]);
  const [coParentEmail, setCoParentEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signup");
    }
  }, [user, authLoading, navigate]);

  // Get user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (profile) {
        setProfileId(profile.id);
        setUserName(profile.full_name || user.email || "");
      }
    };
    
    fetchProfile();
  }, [user]);

  const nextStep = async () => {
    if (currentStep === 1 && profileId && role) {
      const accountRole = role === "Guardian" ? "guardian" : "parent";
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ account_role: accountRole })
        .eq("id", profileId);

      if (profileError) {
        toast({
          title: "Unable to save role",
          description: "Please try again before continuing.",
          variant: "destructive",
        });
        return;
      }

      try {
        await ensureCurrentUserFamilyMembership(userName || user?.email || null);
      } catch (familyError) {
        console.error("Error ensuring family membership during onboarding:", familyError);
        toast({
          title: "Unable to prepare your family",
          description: "Please try again before continuing.",
          variant: "destructive",
        });
        return;
      }
    }

    // Save children data when moving from step 2 to 3
    if (currentStep === 2) {
      await saveChildrenToDatabase();
    }
    // Send co-parent invite when moving from step 3 to 4
    if (currentStep === 3 && coParentEmail.trim()) {
      await sendCoParentInvite();
    }
    setCurrentStep((s) => Math.min(s + 1, 4));
  };
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const addChild = () => {
    setChildren([...children, { name: "", dob: "" }]);
  };

  const updateChild = (index: number, field: "name" | "dob", value: string) => {
    const updated = [...children];
    updated[index][field] = value;
    setChildren(updated);
  };

  const sendCoParentInvite = async () => {
    if (!profileId || !coParentEmail.trim()) return;

    setSaving(true);
    try {
      const ensuredFamily = await ensureCurrentUserFamilyMembership(userName || user?.email || null);
      if (!ensuredFamily.familyId) {
        throw new Error("Could not determine your family for this invitation.");
      }

      // Create invitation in database
      const { data: invitation, error: insertError } = await supabase
        .from("invitations")
        .insert({
          inviter_id: profileId,
          family_id: ensuredFamily.familyId,
          invitee_email: coParentEmail.toLowerCase().trim(),
          invitation_type: "co_parent",
          role: "parent",
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          toast({
            title: "Invitation already sent",
            description: "You've already invited this email address.",
          });
        } else {
          throw insertError;
        }
        return;
      }

      // Send email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-coparent-invite", {
        body: {
          inviteeEmail: coParentEmail.toLowerCase().trim(),
          inviterName: userName || "Your co-parent",
          token: invitation.token,
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        toast({
          title: "Invitation created",
          description: "The invitation was created. Share the link with your co-parent.",
        });
      } else {
        toast({
          title: "Invitation sent!",
          description: `An invitation has been sent to ${coParentEmail}.`,
        });
      }
    } catch (error: unknown) {
      console.error("Error sending invitation:", error);
      toast({
        title: "Failed to send invitation",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveChildrenToDatabase = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to save children",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    let successCount = 0;
    let limitReached = false;
    
    try {
      // Save each child using the secure RPC function that enforces plan limits
      for (const child of children) {
        if (child.name.trim()) {
          const { data, error } = await supabase.rpc("rpc_add_child", {
            p_name: child.name.trim(),
            p_dob: child.dob || null,
          });

          if (error) {
            console.error("Error creating child:", error);
            continue;
          }

          const result = data as { ok: boolean; code?: string; message?: string };
          if (!result.ok) {
            if (result.code === "LIMIT_REACHED") {
              limitReached = true;
              break; // Stop trying to add more if limit reached
            }
            console.error("Failed to create child:", result.message);
          } else {
            successCount++;
          }
        }
      }

      if (limitReached) {
        toast({
          title: "Plan Limit Reached",
          description: `Added ${successCount} child${successCount !== 1 ? "ren" : ""}. Upgrade to Power for more.`,
          variant: "destructive",
        });
      } else if (successCount > 0) {
        toast({
          title: "Success",
          description: `${successCount} child${successCount !== 1 ? "ren" : ""} saved successfully`,
        });
      }
    } catch (error) {
      console.error("Error saving children:", error);
      toast({
        title: "Error",
        description: "Failed to save children",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentStepMeta = steps[currentStep - 1];
  const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="page-shell-public">
        <div className="mb-6 flex items-center justify-between">
          <Logo size="md" />
          <StatusPill variant="scope">
            Step {currentStep} of {steps.length}
          </StatusPill>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr] xl:items-start">
          <aside className="surface-hero hidden p-6 xl:block xl:p-7">
            <div className="relative space-y-8">
              <div className="space-y-4">
                <span className="eyebrow-pill-dark">Family setup</span>
                <div className="space-y-3">
                  <h1 className="text-white">Set up the family workspace with momentum</h1>
                  <p className="max-w-xl text-base leading-7 text-white/76">
                    This flow keeps the product wiring the same while making progress, family
                    structure, and the next action feel unmistakable.
                  </p>
                </div>
              </div>

              <div className="surface-hero-panel">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/68">
                      Current step
                    </p>
                    <p className="mt-2 text-2xl font-display font-semibold text-white">
                      {currentStepMeta?.title}
                    </p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-white/12 bg-white/10 text-white">
                    {currentStepMeta ? <currentStepMeta.icon className="h-6 w-6" /> : null}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-200/74">
                  {stepDescriptions[currentStep]}
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.96),rgba(125,211,252,0.95),rgba(94,234,212,0.9))] transition-[width] duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {steps.map((step) => {
                  const isComplete = currentStep > step.id;
                  const isActive = currentStep === step.id;

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "surface-hero-panel flex items-start gap-4 p-4 transition-all",
                        isActive && "border-white/16 bg-white/10",
                        isComplete && "bg-white/10",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border text-white",
                          isActive ? "border-white/18 bg-white/12" : "border-white/10 bg-slate-950/22",
                        )}
                      >
                        {isComplete ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{step.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-200/68">
                          {stepDescriptions[step.id]}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="surface-primary p-5 sm:p-6 lg:p-7">
            <div className="mb-6 space-y-5">
              <SectionHeader
                eyebrow="Guided setup"
                eyebrowTone="pill"
                title="Keep the setup moving"
                description="The order stays the same: role, children, invitation, then the live family dashboard."
              />

              <div className="rounded-[1.5rem] border border-border/70 bg-background/72 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Progress
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {currentStepMeta?.title}
                    </p>
                  </div>
                  <StatusPill variant="highlight">{Math.round(progressPercentage)}% complete</StatusPill>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex min-w-0 flex-1 items-center">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-2xl border text-sm transition-colors",
                          currentStep >= step.id
                            ? "border-primary/20 bg-primary text-primary-foreground"
                            : "border-border/80 bg-background text-muted-foreground",
                        )}
                      >
                        {currentStep > step.id ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={cn(
                            "mx-2 h-1 min-w-0 flex-1 rounded-full",
                            currentStep > step.id ? "bg-primary/80" : "bg-border/80",
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-bold">What's your role?</h3>
                  <p className="text-muted-foreground">
                    This helps us personalize your experience
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {roles.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={cn(
                        "rounded-[1.35rem] border p-4 text-center font-medium transition-all",
                        role === r
                          ? "border-primary/25 bg-primary/10 shadow-[0_18px_35px_-28px_rgba(14,165,233,0.45)]"
                          : "border-border bg-background/72 hover:border-primary/35 hover:bg-background"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <Button className="h-12 w-full rounded-2xl" onClick={nextStep} disabled={!role}>
                  Continue
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-bold">Add your children</h3>
                  <p className="text-muted-foreground">
                    We'll create profiles for each child
                  </p>
                </div>

                <div className="space-y-4">
                  {children.map((child, index) => (
                    <div key={index} className="surface-secondary space-y-3 p-4">
                      <div className="space-y-2">
                        <Label>Child's Name</Label>
                        <Input
                          placeholder="Enter name"
                          value={child.name}
                          onChange={(e) => updateChild(index, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Date of Birth</Label>
                        <Input
                          type="date"
                          value={child.dob}
                          onChange={(e) => updateChild(index, "dob", e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={addChild}>
                    Add Another Child
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="rounded-2xl" onClick={prevStep}>
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    Back
                  </Button>
                  <Button className="h-12 flex-1 rounded-2xl" onClick={nextStep} disabled={!children[0].name || saving}>
                    {saving ? "Saving..." : "Continue"}
                    {!saving && <ArrowRight className="ml-2 w-4 h-4" />}
                  </Button>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-bold">Invite your co-parent</h3>
                  <p className="text-muted-foreground">
                    They'll receive an invitation to join CoParrent
                  </p>
                </div>

                <div className="surface-secondary space-y-2 p-4">
                  <Label>Co-Parent's Email</Label>
                  <Input
                    type="email"
                    placeholder="coparent@example.com"
                    value={coParentEmail}
                    onChange={(e) => setCoParentEmail(e.target.value)}
                  />
                  <p className="text-sm leading-6 text-muted-foreground">
                    CoParrent sends the invitation, but the family-scoped workspace remains tied to
                    your existing setup until they join.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="rounded-2xl" onClick={prevStep}>
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    Back
                  </Button>
                  <Button className="h-12 flex-1 rounded-2xl" onClick={nextStep}>
                    {coParentEmail ? "Send Invite" : "Skip for now"}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 text-center"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <Check className="w-8 h-8 text-success" />
                </div>
                <div>
                  <h3 className="mb-2 text-2xl font-display font-bold">You're all set!</h3>
                  <p className="text-muted-foreground">
                    Your account is ready. Let's start building your parenting schedule.
                  </p>
                </div>

                <Button className="h-12 w-full rounded-2xl" onClick={() => navigate("/dashboard")}>
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </motion.div>
            )}
            </AnimatePresence>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
