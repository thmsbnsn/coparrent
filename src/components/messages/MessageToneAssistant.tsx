import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertTriangle, CheckCircle, RefreshCw, X, Lightbulb, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ToneAnalysis {
  overallTone?: "positive" | "neutral" | "concerning";
  toneScore?: number;
  suggestions?: string[];
  positiveAspects?: string[];
  childFocused?: boolean;
  courtAppropriate?: boolean;
}

interface QuickCheck {
  hasIssues: boolean;
  flags: string[];
}

interface MessageToneAssistantProps {
  message: string;
  onRephrase: (newMessage: string) => void;
  className?: string;
}

// Rewrite modes with labels for UI
const REWRITE_MODES = [
  { value: "neutral", label: "Neutral", description: "Professional and balanced" },
  { value: "deescalate", label: "De-escalate", description: "Reduce tension and conflict" },
  { value: "facts_only", label: "Facts-only", description: "Court-friendly, no emotion" },
  { value: "boundary_setting", label: "Boundary-setting", description: "Firm but calm" },
] as const;

type RewriteMode = typeof REWRITE_MODES[number]["value"];

export const MessageToneAssistant = ({ message, onRephrase, className }: MessageToneAssistantProps) => {
  const [quickCheck, setQuickCheck] = useState<QuickCheck | null>(null);
  const [analysis, setAnalysis] = useState<ToneAnalysis | null>(null);
  const [rephrasedMessage, setRephrasedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [lastCheckedMessage, setLastCheckedMessage] = useState("");
  const [selectedMode, setSelectedMode] = useState<RewriteMode>("neutral");
  
  const { hasAccess: hasPremium, loading: premiumLoading } = usePremiumAccess();

  // Debounced quick check
  const performQuickCheck = useCallback(async (text: string) => {
    if (text.length < 10) {
      setQuickCheck(null);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("ai-message-assist", {
        body: { message: text, action: "quick-check" },
      });

      if (error) throw error;
      setQuickCheck(data);
    } catch (err) {
      console.error("Quick check error:", err);
    }
  }, []);

  useEffect(() => {
    if (message === lastCheckedMessage) return;
    
    const timer = setTimeout(() => {
      if (message.length >= 10) {
        performQuickCheck(message);
        setLastCheckedMessage(message);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [message, lastCheckedMessage, performQuickCheck]);

  const handleAnalyze = async () => {
    setLoading(true);
    setShowPanel(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-message-assist", {
        body: { message, action: "analyze" },
      });

      if (error) throw error;
      setAnalysis(data);
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRephrase = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-message-assist", {
        body: { message, action: "rephrase", mode: selectedMode },
      });

      if (error) throw error;
      setRephrasedMessage(data.content);
    } catch (err) {
      console.error("Rephrase error:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyRephrase = () => {
    if (rephrasedMessage) {
      onRephrase(rephrasedMessage);
      setRephrasedMessage(null);
      setQuickCheck(null);
      setShowPanel(false);
    }
  };

  const getToneColor = (tone?: string) => {
    switch (tone) {
      case "positive": return "text-green-500";
      case "concerning": return "text-warning";
      default: return "text-muted-foreground";
    }
  };

  const getToneIcon = (tone?: string) => {
    switch (tone) {
      case "positive": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "concerning": return <AlertTriangle className="w-4 h-4 text-warning" />;
      default: return <Lightbulb className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const selectedModeLabel = REWRITE_MODES.find(m => m.value === selectedMode)?.label || "Neutral";

  if (!message || message.length < 10) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Quick Check Indicator */}
      <AnimatePresence>
        {quickCheck?.hasIssues && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30"
          >
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-warning-foreground mb-1">Tone Guidance</p>
              <ul className="space-y-1 text-muted-foreground">
                {quickCheck.flags.slice(0, 2).map((flag, i) => (
                  <li key={i}>• {flag}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              {/* Mode selector for premium users */}
              {hasPremium && !premiumLoading && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                      {selectedModeLabel}
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {REWRITE_MODES.map((mode) => (
                      <DropdownMenuItem
                        key={mode.value}
                        onClick={() => setSelectedMode(mode.value)}
                        className={cn(selectedMode === mode.value && "bg-accent")}
                      >
                        <div>
                          <div className="font-medium">{mode.label}</div>
                          <div className="text-xs text-muted-foreground">{mode.description}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={loading}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Analyze
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRephrase}
                  disabled={loading}
                >
                  <RefreshCw className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />
                  Rephrase
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rephrase Suggestion */}
      <AnimatePresence>
        {rephrasedMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-lg bg-accent/50 border border-accent-foreground/10"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Suggested Rephrase
                {hasPremium && selectedMode !== "neutral" && (
                  <span className="text-xs text-muted-foreground">
                    ({selectedModeLabel})
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRephrasedMessage(null)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-sm text-foreground mb-3 p-3 bg-background/50 rounded-md">
              {rephrasedMessage}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={applyRephrase}>
                Use This Message
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRephrasedMessage(null)}>
                Keep Original
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Analysis Panel */}
      <AnimatePresence>
        {showPanel && analysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-lg bg-card border border-border"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Message Analysis</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPanel(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {getToneIcon(analysis.overallTone)}
                  <span className={cn("text-sm font-medium capitalize", getToneColor(analysis.overallTone))}>
                    {analysis.overallTone || "Neutral"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Tone</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-lg font-bold text-primary">{analysis.toneScore || "—"}/10</div>
                <span className="text-xs text-muted-foreground">Score</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                {analysis.childFocused ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-warning mx-auto" />
                )}
                <span className="text-xs text-muted-foreground">Child-Focused</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                {analysis.courtAppropriate ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-warning mx-auto" />
                )}
                <span className="text-xs text-muted-foreground">Court-Ready</span>
              </div>
            </div>

            {analysis.suggestions && analysis.suggestions.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium mb-2">Suggestions:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.positiveAspects && analysis.positiveAspects.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 text-green-600">What's Working:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {analysis.positiveAspects.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 items-center">
              {/* Mode selector for premium users in analysis panel */}
              {hasPremium && !premiumLoading && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Style: {selectedModeLabel}
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {REWRITE_MODES.map((mode) => (
                      <DropdownMenuItem
                        key={mode.value}
                        onClick={() => setSelectedMode(mode.value)}
                        className={cn(selectedMode === mode.value && "bg-accent")}
                      >
                        <div>
                          <div className="font-medium">{mode.label}</div>
                          <div className="text-xs text-muted-foreground">{mode.description}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button size="sm" onClick={handleRephrase} disabled={loading}>
                <RefreshCw className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />
                Get Rephrased Version
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
