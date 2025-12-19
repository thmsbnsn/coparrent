import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Users, Baby, Mail, Check } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, title: "Your Role", icon: Users },
  { id: 2, title: "Children", icon: Baby },
  { id: 3, title: "Invite Co-Parent", icon: Mail },
  { id: 4, title: "Complete", icon: Check },
];

const roles = ["Father", "Mother", "Guardian", "Other"];

const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [role, setRole] = useState("");
  const [children, setChildren] = useState([{ name: "", dob: "" }]);
  const [coParentEmail, setCoParentEmail] = useState("");

  const nextStep = () => setCurrentStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const addChild = () => {
    setChildren([...children, { name: "", dob: "" }]);
  };

  const updateChild = (index: number, field: "name" | "dob", value: string) => {
    const updated = [...children];
    updated[index][field] = value;
    setChildren(updated);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <Logo size="md" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Progress */}
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                    currentStep >= step.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-12 sm:w-20 h-0.5 mx-2",
                      currentStep > step.id ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h1 className="text-2xl font-display font-bold mb-2">What's your role?</h1>
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
                        "p-4 rounded-xl border-2 text-center font-medium transition-all",
                        role === r
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <Button className="w-full" onClick={nextStep} disabled={!role}>
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
                <div className="text-center">
                  <h1 className="text-2xl font-display font-bold mb-2">Add your children</h1>
                  <p className="text-muted-foreground">
                    We'll create profiles for each child
                  </p>
                </div>

                <div className="space-y-4">
                  {children.map((child, index) => (
                    <div key={index} className="p-4 rounded-xl border border-border space-y-3">
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
                  <Button variant="outline" className="w-full" onClick={addChild}>
                    Add Another Child
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    Back
                  </Button>
                  <Button className="flex-1" onClick={nextStep} disabled={!children[0].name}>
                    Continue
                    <ArrowRight className="ml-2 w-4 h-4" />
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
                <div className="text-center">
                  <h1 className="text-2xl font-display font-bold mb-2">Invite your co-parent</h1>
                  <p className="text-muted-foreground">
                    They'll receive an invitation to join ClearNest
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Co-Parent's Email</Label>
                  <Input
                    type="email"
                    placeholder="coparent@example.com"
                    value={coParentEmail}
                    onChange={(e) => setCoParentEmail(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    Back
                  </Button>
                  <Button className="flex-1" onClick={nextStep}>
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
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-success" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold mb-2">You're all set!</h1>
                  <p className="text-muted-foreground">
                    Your account is ready. Let's start building your parenting schedule.
                  </p>
                </div>

                <Button className="w-full" onClick={() => navigate("/dashboard")}>
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
