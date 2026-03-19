import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Calendar, 
  Clock, 
  MapPin, 
  PartyPopper,
  Sparkles,
  Brain,
  AlertTriangle,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Lightbulb
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useChildren } from "@/hooks/useChildren";
import { toast } from "sonner";

interface CalendarWizardProps {
  onComplete: (config: ScheduleConfig) => void;
  onCancel: () => void;
}

export interface ScheduleConfig {
  pattern: string;
  customPattern?: number[];
  startDate: Date;
  startingParent: "A" | "B";
  exchangeTime: string;
  exchangeLocation: string;
  alternateLocation: string;
  holidays: HolidayConfig[];
}

export interface HolidayConfig {
  name: string;
  rule: "alternate" | "split" | "fixed-a" | "fixed-b";
  enabled: boolean;
}

interface AISuggestion {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  visual: string[];
  holidayTips: string;
  exchangeTips: string;
  startingParent: "A" | "B";
}

const STEPS = [
  { id: "pattern", title: "Schedule Pattern", icon: Calendar },
  { id: "timing", title: "Exchange Details", icon: Clock },
  { id: "holidays", title: "Holiday Schedule", icon: PartyPopper },
  { id: "review", title: "Review & Confirm", icon: Sparkles },
];

const PATTERNS = [
  {
    id: "alternating-weeks",
    name: "Alternating Weeks",
    description: "Each parent has the children for one full week at a time",
    visual: ["A", "A", "A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B", "B"],
  },
  {
    id: "2-2-3",
    name: "2-2-3 Rotation",
    description: "Parent A has 2 days, Parent B has 2 days, then the weekend rotates (3 days)",
    visual: ["A", "A", "B", "B", "A", "A", "A", "B", "B", "A", "A", "B", "B", "B"],
  },
  {
    id: "2-2-5-5",
    name: "2-2-5-5 Rotation",
    description: "2 days with Parent A, 2 with Parent B, then 5 days alternating",
    visual: ["A", "A", "B", "B", "A", "A", "A", "A", "A", "B", "B", "A", "A", "B"],
  },
  {
    id: "3-4-4-3",
    name: "3-4-4-3 Rotation",
    description: "3 days, then 4 days, alternating each week",
    visual: ["A", "A", "A", "B", "B", "B", "B", "A", "A", "A", "A", "B", "B", "B"],
  },
  {
    id: "every-other-weekend",
    name: "Every Other Weekend",
    description: "Primary custody with one parent, alternating weekends with the other",
    visual: ["A", "A", "A", "A", "A", "B", "B", "A", "A", "A", "A", "A", "A", "A"],
  },
  {
    id: "custom",
    name: "Custom Pattern",
    description: "Create your own unique custody pattern",
    visual: ["?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?"],
  },
];

const DEFAULT_HOLIDAYS: HolidayConfig[] = [
  { name: "New Year's Day", rule: "alternate", enabled: true },
  { name: "Martin Luther King Jr. Day", rule: "alternate", enabled: true },
  { name: "Presidents' Day", rule: "alternate", enabled: true },
  { name: "Easter", rule: "alternate", enabled: true },
  { name: "Memorial Day", rule: "alternate", enabled: true },
  { name: "Independence Day", rule: "alternate", enabled: true },
  { name: "Labor Day", rule: "alternate", enabled: true },
  { name: "Columbus Day", rule: "alternate", enabled: false },
  { name: "Veterans Day", rule: "alternate", enabled: false },
  { name: "Thanksgiving", rule: "alternate", enabled: true },
  { name: "Christmas Eve", rule: "split", enabled: true },
  { name: "Christmas Day", rule: "split", enabled: true },
  { name: "Children's Birthdays", rule: "split", enabled: true },
  { name: "Mother's Day", rule: "fixed-a", enabled: true },
  { name: "Father's Day", rule: "fixed-b", enabled: true },
  { name: "Spring Break", rule: "split", enabled: true },
  { name: "Summer Vacation", rule: "split", enabled: true },
];

const EXCHANGE_TIMES = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM",
  "12:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"
];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
];

export const CalendarWizard = ({ onComplete, onCancel }: CalendarWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState<string>("alternating-weeks");
  const [customPattern, setCustomPattern] = useState<("A" | "B")[]>(
    Array(14).fill("A").map((_, i) => (i < 7 ? "A" : "B") as "A" | "B")
  );
  const [startingParent, setStartingParent] = useState<"A" | "B">("A");
  const [exchangeTime, setExchangeTime] = useState("6:00 PM");
  const [exchangeLocation, setExchangeLocation] = useState("");
  const [alternateLocation, setAlternateLocation] = useState("");
  const [holidays, setHolidays] = useState<HolidayConfig[]>(DEFAULT_HOLIDAYS);
  
  // AI Suggestions state
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isHighConflict, setIsHighConflict] = useState(false);
  const [preferences, setPreferences] = useState("");
  const [selectedState, setSelectedState] = useState("");

  const { children } = useChildren();

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const toggleHoliday = (index: number) => {
    setHolidays((prev) =>
      prev.map((h, i) => (i === index ? { ...h, enabled: !h.enabled } : h))
    );
  };

  const updateHolidayRule = (index: number, rule: HolidayConfig["rule"]) => {
    setHolidays((prev) =>
      prev.map((h, i) => (i === index ? { ...h, rule } : h))
    );
  };

  const toggleCustomDay = (index: number) => {
    setCustomPattern((prev) =>
      prev.map((p, i) => (i === index ? (p === "A" ? "B" : "A") : p))
    );
  };

  const handleComplete = () => {
    onComplete({
      pattern: selectedPattern,
      customPattern: selectedPattern === "custom" ? customPattern.map((p) => (p === "A" ? 0 : 1)) : undefined,
      startDate: new Date(),
      startingParent,
      exchangeTime,
      exchangeLocation,
      alternateLocation,
      holidays: holidays.filter((h) => h.enabled),
    });
  };

  const getSelectedPatternVisual = () => {
    if (selectedPattern === "custom") return customPattern;
    return PATTERNS.find((p) => p.id === selectedPattern)?.visual || [];
  };

  const getChildrenAges = (): number[] => {
    if (!children || children.length === 0) return [];
    
    const today = new Date();
    return children
      .filter(child => child.date_of_birth)
      .map(child => {
        const birthDate = new Date(child.date_of_birth!);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      });
  };

  const handleGetAISuggestions = async () => {
    setIsLoadingAI(true);
    setShowAISuggestions(true);
    
    try {
      const childrenInfo = {
        count: children?.length || 0,
        ages: getChildrenAges(),
      };

      const { data, error } = await supabase.functions.invoke('ai-schedule-suggest', {
        body: {
          childrenInfo,
          isHighConflict,
          preferences,
          state: selectedState,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setAiSuggestions(data.suggestions || []);
      toast.success("AI suggestions ready!");
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      toast.error("Failed to get AI suggestions. Please try again.");
      setAiSuggestions([]);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const applyAISuggestion = (suggestion: AISuggestion) => {
    // Check if it matches an existing pattern
    const matchingPattern = PATTERNS.find(p => p.id === suggestion.id);
    
    if (matchingPattern) {
      setSelectedPattern(matchingPattern.id);
    } else {
      // Set as custom pattern
      setSelectedPattern("custom");
      setCustomPattern(suggestion.visual as ("A" | "B")[]);
    }
    
    setStartingParent(suggestion.startingParent);
    
    // Apply exchange tips if they contain a time
    if (suggestion.exchangeTips) {
      const timeMatch = suggestion.exchangeTips.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (timeMatch && EXCHANGE_TIMES.includes(timeMatch[1])) {
        setExchangeTime(timeMatch[1]);
      }
    }
    
    toast.success(`Applied "${suggestion.name}" pattern!`);
    setShowAISuggestions(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-display font-bold">Schedule Wizard</h2>
          <p className="text-muted-foreground mt-1">Set up your custody schedule in a few simple steps</p>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between mt-6">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        isCompleted
                          ? "bg-success text-white"
                          : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span
                      className={cn(
                        "text-xs mt-2 font-medium hidden sm:block",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "w-12 sm:w-20 h-0.5 mx-2",
                        index < currentStep ? "bg-success" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {currentStep === 0 && (
              <motion.div
                key="pattern"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* AI Suggestions Section */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-[#21B0FE]/10 to-secondary/30 border border-[#21B0FE]/20">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-[#21B0FE]/20">
                      <Brain className="w-5 h-5 text-[#21B0FE]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">Get AI-Powered Suggestions</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Let AI recommend the best custody patterns based on your family's unique situation.
                      </p>
                    </div>
                  </div>
                  
                  {!showAISuggestions && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          id="high-conflict" 
                          checked={isHighConflict}
                          onCheckedChange={(checked) => setIsHighConflict(checked === true)}
                        />
                        <label htmlFor="high-conflict" className="text-sm font-medium cursor-pointer">
                          High-conflict situation (minimize direct exchanges)
                        </label>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Your State</label>
                        <Select value={selectedState} onValueChange={setSelectedState}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select your state..." />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Preferences & Considerations</label>
                        <Textarea
                          placeholder="e.g., I work night shifts on weekends, prefer school as exchange location, want to minimize driving, child has activities on Tuesdays..."
                          value={preferences}
                          onChange={(e) => setPreferences(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                      
                      <Button 
                        onClick={handleGetAISuggestions}
                        className="w-full bg-[#21B0FE] hover:bg-[#21B0FE]/90"
                        disabled={isLoadingAI}
                      >
                        {isLoadingAI ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing your situation...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Get AI Suggestions
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {/* AI Suggestions Results */}
                  {showAISuggestions && (
                    <div className="space-y-4">
                      {isLoadingAI ? (
                        <div className="flex flex-col items-center justify-center py-8">
                          <Loader2 className="w-8 h-8 animate-spin text-[#21B0FE] mb-3" />
                          <p className="text-sm text-muted-foreground">Analyzing your family's needs...</p>
                        </div>
                      ) : aiSuggestions.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between">
                            <h5 className="font-medium">AI Recommendations</h5>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setShowAISuggestions(false)}
                            >
                              Hide
                            </Button>
                          </div>
                          
                          <div className="space-y-4">
                            {aiSuggestions.map((suggestion, index) => (
                              <motion.div
                                key={suggestion.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="p-4 rounded-xl bg-card border border-border shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div>
                                    <h6 className="font-semibold">{suggestion.name}</h6>
                                    <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => applyAISuggestion(suggestion)}
                                    className="shrink-0 bg-success hover:bg-success/90"
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    Apply
                                  </Button>
                                </div>
                                
                                {/* Visual Pattern */}
                                <div className="flex gap-0.5 mb-3">
                                  {suggestion.visual.map((day, i) => (
                                    <div
                                      key={i}
                                      className={cn(
                                        "w-4 h-6 rounded-sm text-[10px] flex items-center justify-center font-medium",
                                        day === "A"
                                          ? "bg-parent-a text-white"
                                          : "bg-parent-b text-white"
                                      )}
                                    >
                                      {day}
                                    </div>
                                  ))}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                  <div>
                                    <div className="flex items-center gap-1 text-xs font-medium text-success mb-1">
                                      <ThumbsUp className="w-3 h-3" />
                                      Pros
                                    </div>
                                    <ul className="text-xs text-muted-foreground space-y-1">
                                      {suggestion.pros.map((pro, i) => (
                                        <li key={i} className="flex items-start gap-1">
                                          <span className="text-success mt-0.5">•</span>
                                          {pro}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1 text-xs font-medium text-warning mb-1">
                                      <ThumbsDown className="w-3 h-3" />
                                      Cons
                                    </div>
                                    <ul className="text-xs text-muted-foreground space-y-1">
                                      {suggestion.cons.map((con, i) => (
                                        <li key={i} className="flex items-start gap-1">
                                          <span className="text-warning mt-0.5">•</span>
                                          {con}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                                
                                {(suggestion.holidayTips || suggestion.exchangeTips) && (
                                  <div className="pt-3 border-t border-border">
                                    <div className="flex items-center gap-1 text-xs font-medium text-[#21B0FE] mb-2">
                                      <Lightbulb className="w-3 h-3" />
                                      Tips
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      {suggestion.holidayTips && <p><strong>Holidays:</strong> {suggestion.holidayTips}</p>}
                                      {suggestion.exchangeTips && <p><strong>Exchanges:</strong> {suggestion.exchangeTips}</p>}
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                          
                          {/* Disclaimer */}
                          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                              <p className="text-xs text-warning-foreground">
                                <strong>Disclaimer:</strong> AI suggestions are for informational purposes only and do not constitute legal advice. 
                                Always consult with a family law attorney for custody matters specific to your situation.
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <p>No suggestions available. Please try again.</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => setShowAISuggestions(false)}
                          >
                            Go Back
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Choose a Custody Pattern</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PATTERNS.map((pattern) => (
                      <button
                        key={pattern.id}
                        onClick={() => setSelectedPattern(pattern.id)}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all hover:shadow-md",
                          selectedPattern === pattern.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="font-semibold mb-1">{pattern.name}</div>
                        <div className="text-sm text-muted-foreground mb-3">
                          {pattern.description}
                        </div>
                        <div className="flex gap-0.5">
                          {pattern.visual.map((day, i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-4 h-6 rounded-sm text-[10px] flex items-center justify-center font-medium",
                                day === "A"
                                  ? "bg-parent-a text-white"
                                  : day === "B"
                                  ? "bg-parent-b text-white"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {day}
                            </div>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPattern === "custom" && (
                  <div className="p-4 rounded-xl bg-muted/30 border border-border">
                    <h4 className="font-semibold mb-3">Design Your Custom Pattern</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click on each day to toggle between Parent A and Parent B. This 2-week pattern will repeat.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Week 1</div>
                        <div className="flex gap-1">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                            <button
                              key={`w1-${i}`}
                              onClick={() => toggleCustomDay(i)}
                              className={cn(
                                "flex-1 py-3 rounded-lg font-medium text-sm transition-all",
                                customPattern[i] === "A"
                                  ? "bg-parent-a text-white"
                                  : "bg-parent-b text-white"
                              )}
                            >
                              <div className="text-[10px] opacity-70">{day}</div>
                              <div>{customPattern[i]}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Week 2</div>
                        <div className="flex gap-1">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                            <button
                              key={`w2-${i}`}
                              onClick={() => toggleCustomDay(i + 7)}
                              className={cn(
                                "flex-1 py-3 rounded-lg font-medium text-sm transition-all",
                                customPattern[i + 7] === "A"
                                  ? "bg-parent-a text-white"
                                  : "bg-parent-b text-white"
                              )}
                            >
                              <div className="text-[10px] opacity-70">{day}</div>
                              <div>{customPattern[i + 7]}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-muted/30 border border-border">
                  <h4 className="font-semibold mb-3">Who starts first?</h4>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStartingParent("A")}
                      className={cn(
                        "flex-1 p-3 rounded-lg border-2 transition-all",
                        startingParent === "A"
                          ? "border-parent-a bg-parent-a-light"
                          : "border-border hover:border-parent-a/50"
                      )}
                    >
                      <div className="font-semibold">Parent A (You)</div>
                      <div className="text-sm text-muted-foreground">Start with your custody time</div>
                    </button>
                    <button
                      onClick={() => setStartingParent("B")}
                      className={cn(
                        "flex-1 p-3 rounded-lg border-2 transition-all",
                        startingParent === "B"
                          ? "border-parent-b bg-parent-b-light"
                          : "border-border hover:border-parent-b/50"
                      )}
                    >
                      <div className="font-semibold">Parent B (Co-Parent)</div>
                      <div className="text-sm text-muted-foreground">Start with co-parent's time</div>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 1 && (
              <motion.div
                key="timing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-semibold mb-4">Exchange Details</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        <Clock className="w-4 h-4 inline mr-2" />
                        Standard Exchange Time
                      </label>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {EXCHANGE_TIMES.map((time) => (
                          <button
                            key={time}
                            onClick={() => setExchangeTime(time)}
                            className={cn(
                              "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                              exchangeTime === time
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            )}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        <MapPin className="w-4 h-4 inline mr-2" />
                        Primary Exchange Location
                      </label>
                      <input
                        type="text"
                        value={exchangeLocation}
                        onChange={(e) => setExchangeLocation(e.target.value)}
                        placeholder="e.g., School, Home address, Public library"
                        className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        <MapPin className="w-4 h-4 inline mr-2" />
                        Alternate Exchange Location
                      </label>
                      <input
                        type="text"
                        value={alternateLocation}
                        onChange={(e) => setAlternateLocation(e.target.value)}
                        placeholder="e.g., Grandparent's house, Police station"
                        className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-info-light border border-info/20">
                  <p className="text-sm text-info-dark">
                    <strong>Tip:</strong> Choosing a neutral, public location like a school or library can help 
                    reduce conflict and provide documentation of exchanges.
                  </p>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="holidays"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-semibold mb-2">Holiday Schedule</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Select which holidays to include and how they should be handled.
                  </p>
                  
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {holidays.map((holiday, index) => (
                      <div
                        key={holiday.name}
                        className={cn(
                          "p-3 rounded-lg border transition-all",
                          holiday.enabled
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-muted/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleHoliday(index)}
                              className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                holiday.enabled
                                  ? "bg-primary border-primary"
                                  : "border-muted-foreground"
                              )}
                            >
                              {holiday.enabled && <Check className="w-3 h-3 text-white" />}
                            </button>
                            <span className={cn(
                              "font-medium",
                              !holiday.enabled && "text-muted-foreground"
                            )}>
                              {holiday.name}
                            </span>
                          </div>
                          
                          {holiday.enabled && (
                            <select
                              value={holiday.rule}
                              onChange={(e) => updateHolidayRule(index, e.target.value as HolidayConfig["rule"])}
                              className="text-sm px-3 py-1.5 rounded-lg bg-background border border-border focus:border-primary outline-none"
                            >
                              <option value="alternate">Alternate Years</option>
                              <option value="split">Split Day</option>
                              <option value="fixed-a">Always Parent A</option>
                              <option value="fixed-b">Always Parent B</option>
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border">
                  <h4 className="font-semibold mb-2">Holiday Rules Explained</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Alternate Years:</strong> Parent A gets even years, Parent B gets odd years</p>
                    <p><strong>Split Day:</strong> Children spend half the day with each parent</p>
                    <p><strong>Always Parent A/B:</strong> This holiday is always with one parent</p>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-semibold mb-4">Review Your Schedule</h3>
                  
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-muted/30 border border-border">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Schedule Pattern
                      </h4>
                      <p className="text-muted-foreground mb-3">
                        {PATTERNS.find((p) => p.id === selectedPattern)?.name} - Starting with{" "}
                        {startingParent === "A" ? "Parent A (You)" : "Parent B (Co-Parent)"}
                      </p>
                      <div className="flex gap-0.5">
                        {getSelectedPatternVisual().map((day, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-5 h-7 rounded-sm text-[10px] flex items-center justify-center font-medium",
                              day === "A"
                                ? "bg-parent-a text-white"
                                : "bg-parent-b text-white"
                            )}
                          >
                            {day}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/30 border border-border">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Exchange Details
                      </h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Time:</strong> {exchangeTime}</p>
                        <p><strong>Primary Location:</strong> {exchangeLocation || "Not specified"}</p>
                        <p><strong>Alternate Location:</strong> {alternateLocation || "Not specified"}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/30 border border-border">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <PartyPopper className="w-4 h-4" />
                        Holiday Schedule
                      </h4>
                      <div className="text-sm text-muted-foreground">
                        {holidays.filter((h) => h.enabled).length} holidays configured:
                        <div className="mt-2 flex flex-wrap gap-2">
                          {holidays
                            .filter((h) => h.enabled)
                            .map((h) => (
                              <span
                                key={h.name}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background text-xs"
                              >
                                {h.name}
                                <span className="text-muted-foreground">
                                  ({h.rule === "alternate" ? "Alt" : h.rule === "split" ? "Split" : h.rule === "fixed-a" ? "A" : "B"})
                                </span>
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-success-light border border-success/20">
                  <p className="text-sm text-success-dark">
                    <strong>Ready to go!</strong> Your schedule will be applied immediately. 
                    You can always edit it later from the calendar settings.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex items-center justify-between">
          <Button variant="ghost" onClick={currentStep === 0 ? onCancel : prevStep}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            {currentStep === 0 ? "Cancel" : "Back"}
          </Button>
          
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={nextStep}>
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleComplete} className="bg-success hover:bg-success/90">
              <Check className="w-4 h-4 mr-2" />
              Create Schedule
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
