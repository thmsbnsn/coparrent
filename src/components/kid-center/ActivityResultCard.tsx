import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Users, AlertTriangle, Lightbulb, ChefHat, Scissors, Gamepad2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ActivityType } from "@/hooks/useActivityGenerator";

interface MaterialDetail {
  item: string;
  quantity?: string | null;
  substitute?: string | null;
}

interface ActivityStep {
  step?: number;
  instruction: string;
  tip?: string | null;
}

interface ActivityIngredient {
  amount: string;
  item: string;
}

interface ActivityResult {
  title: string;
  description?: string | null;
  ageRange?: string | null;
  duration?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  messLevel?: string | null;
  materials?: string[] | MaterialDetail[] | null;
  ingredients?: ActivityIngredient[] | null;
  steps?: string[] | ActivityStep[] | null;
  instructions?: string[] | ActivityStep[] | null;
  kidTasks?: string[] | null;
  adultTasks?: string[] | null;
  learningAreas?: string[] | null;
  skillsLearned?: string[] | null;
  safetyNotes?: string[] | null;
  variations?: string[] | null;
  tips?: string[] | null;
  displayIdeas?: string[] | null;
}

interface ActivityResultCardProps {
  type: ActivityType;
  result: ActivityResult;
  onClose: () => void;
  onRegenerate: () => void;
  loading?: boolean;
}

export const ActivityResultCard = ({
  type,
  result,
  onClose,
  onRegenerate,
  loading,
}: ActivityResultCardProps) => {
  const getIcon = () => {
    switch (type) {
      case "recipe":
        return <ChefHat className="w-5 h-5" />;
      case "craft":
        return <Scissors className="w-5 h-5" />;
      default:
        return <Gamepad2 className="w-5 h-5" />;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case "recipe":
        return "Recipe";
      case "craft":
        return "Craft Project";
      default:
        return "Activity";
    }
  };

  const renderMaterials = () => {
    if (!result.materials || result.materials.length === 0) return null;

    const materials = result.materials;
    if (typeof materials[0] === "string") {
      return (
        <div className="flex flex-wrap gap-2">
          {materials.map((item: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {item}
            </Badge>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {materials.map((item, i: number) => (
          <div key={i} className="text-sm flex items-center gap-2">
            <span className="font-medium">{item.item}</span>
            {item.quantity && <span className="text-muted-foreground">({item.quantity})</span>}
            {item.substitute && (
              <span className="text-xs text-muted-foreground italic">
                or {item.substitute}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSteps = () => {
    if ((!result.steps || result.steps.length === 0) && (!result.instructions || result.instructions.length === 0)) {
      return null;
    }

    const steps = result.steps || result.instructions;
    if (!steps || steps.length === 0) return null;

    if (typeof steps[0] === "string") {
      return (
        <ol className="list-decimal list-inside space-y-2">
          {steps.map((step: string, i: number) => (
            <li key={i} className="text-sm">{step}</li>
          ))}
        </ol>
      );
    }

    return (
      <ol className="space-y-3">
        {steps.map((step, i: number) => (
          <li key={i} className="text-sm">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                {step.step || i + 1}
              </span>
              <div>
                <p>{step.instruction}</p>
                {step.tip && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    {step.tip}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="w-full max-w-2xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {getIcon()}
                  </div>
                  <div>
                    <Badge variant="outline" className="mb-1 text-xs">
                      {getTypeLabel()}
                    </Badge>
                    <CardTitle className="text-xl">{result.title}</CardTitle>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {result.description && (
                <p className="text-sm text-muted-foreground mt-2">{result.description}</p>
              )}
              <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
                {result.ageRange && (
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {result.ageRange}
                  </span>
                )}
                {(result.duration || result.prepTime) && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {result.duration || `Prep: ${result.prepTime}${result.cookTime ? `, Cook: ${result.cookTime}` : ""}`}
                  </span>
                )}
                {result.messLevel && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {result.messLevel} mess
                  </Badge>
                )}
              </div>
            </CardHeader>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6">
                {/* Materials / Ingredients */}
                {(result.materials || result.ingredients) && (
                  <div>
                    <h4 className="font-semibold mb-2">
                      {type === "recipe" ? "Ingredients" : "Materials Needed"}
                    </h4>
                    {type === "recipe" && result.ingredients ? (
                      <div className="grid grid-cols-2 gap-2">
                        {result.ingredients.map((ingredient, i: number) => (
                          <div key={i} className="text-sm">
                            <span className="font-medium">{ingredient.amount}</span>{" "}
                            <span>{ingredient.item}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      renderMaterials()
                    )}
                  </div>
                )}

                <Separator />

                {/* Steps */}
                {(result.steps || result.instructions) && (
                  <div>
                    <h4 className="font-semibold mb-3">
                      {type === "recipe" ? "Instructions" : "Steps"}
                    </h4>
                    {renderSteps()}
                  </div>
                )}

                {/* Kid & Adult Tasks (Recipe) */}
                {type === "recipe" && (result.kidTasks || result.adultTasks) && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      {result.kidTasks && (
                        <div>
                          <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400">
                            👧 Kids Can Do
                          </h4>
                          <ul className="text-sm space-y-1">
                            {result.kidTasks.map((task: string, i: number) => (
                              <li key={i}>• {task}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {result.adultTasks && (
                        <div>
                          <h4 className="font-semibold mb-2 text-orange-600 dark:text-orange-400">
                            👨‍👩‍👧 Adults Help With
                          </h4>
                          <ul className="text-sm space-y-1">
                            {result.adultTasks.map((task: string, i: number) => (
                              <li key={i}>• {task}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Learning Areas / Skills */}
                {(result.learningAreas || result.skillsLearned) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Skills & Learning</h4>
                      <div className="flex flex-wrap gap-2">
                        {(result.learningAreas || result.skillsLearned).map((skill: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs capitalize">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Safety Notes */}
                {result.safetyNotes && result.safetyNotes.length > 0 && (
                  <>
                    <Separator />
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                      <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4" />
                        Safety Notes
                      </h4>
                      <ul className="text-sm space-y-1 text-amber-800 dark:text-amber-300">
                        {result.safetyNotes.map((note: string, i: number) => (
                          <li key={i}>• {note}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* Variations / Tips */}
                {(result.variations || result.tips || result.displayIdeas) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-primary" />
                        {result.displayIdeas ? "Display Ideas" : "Tips & Variations"}
                      </h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        {(result.variations || result.tips || result.displayIdeas).map((tip: string, i: number) => (
                          <li key={i}>💡 {tip}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onRegenerate}
                disabled={loading}
              >
                {loading ? "Generating..." : "Generate Another"}
              </Button>
              <Button className="flex-1" onClick={onClose}>
                Done
              </Button>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
