/**
 * @page-role Overview
 * @summary-pattern Activity generation tools with child age targeting
 * @ownership Activities belong to generating user; shareable to family
 * @court-view N/A (Kids Hub is creative, not evidentiary)
 * 
 * LAW 1: Overview role - tool cards with minimal direct actions
 * LAW 4: All activity tool cards use identical ToolCard component
 * LAW 7: Card grid adapts to mobile while preserving tool selection
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Palette, Scissors, Gamepad2, ChefHat, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { useActivityGenerator, type AIResponse, ActivityType } from "@/hooks/useActivityGenerator";
import { useChildren } from "@/hooks/useChildren";
import { ActivityResultCard } from "@/components/kid-center/ActivityResultCard";

const ANY_CHILD_VALUE = "any-child";

interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  type: ActivityType;
  premiumRequired?: boolean;
  hasAccess: boolean;
  onGenerate: (type: ActivityType) => void;
  loading?: boolean;
  loadingType?: ActivityType | null;
}

const ToolCard = ({ 
  title, 
  description, 
  icon: Icon, 
  type,
  premiumRequired, 
  hasAccess,
  onGenerate,
  loading,
  loadingType,
}: ToolCardProps) => {
  const isLoading = loading && loadingType === type;
  const canUse = hasAccess || !premiumRequired;

  return (
    <motion.div
      whileHover={{ scale: canUse ? 1.02 : 1 }}
      whileTap={{ scale: canUse ? 0.98 : 1 }}
    >
      <Card className={`h-full transition-all ${!canUse ? 'opacity-60' : 'hover:shadow-lg'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            {premiumRequired && (
              <Badge variant="outline" className="text-xs gap-1">
                <Sparkles className="w-3 h-3" />
                Premium
              </Badge>
            )}
          </div>
          <CardTitle className="text-lg mt-3">{title}</CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant={canUse ? "default" : "outline"}
            className="w-full"
            disabled={!canUse || isLoading}
            onClick={() => onGenerate(type)}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const KidCenterPage = () => {
  const { hasAccess } = usePremiumAccess();
  const { children } = useChildren();
  const { generate, loading } = useActivityGenerator();
  
  const [selectedChild, setSelectedChild] = useState<string>(ANY_CHILD_VALUE);
  const [selectedDuration, setSelectedDuration] = useState<string>("30min");
  const [selectedLocation, setSelectedLocation] = useState<"indoor" | "outdoor" | "both">("indoor");
  const [currentType, setCurrentType] = useState<ActivityType | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);

  const selectedChildData = selectedChild === ANY_CHILD_VALUE
    ? undefined
    : children?.find(c => c.id === selectedChild);
  const childAge = selectedChildData?.date_of_birth 
    ? Math.floor((Date.now() - new Date(selectedChildData.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : undefined;

  const handleLocationChange = (value: string) => {
    if (value === "indoor" || value === "outdoor" || value === "both") {
      setSelectedLocation(value);
    }
  };

  const handleGenerate = async (type: ActivityType) => {
    setCurrentType(type);
    
    const generatedResult = await generate({
      type,
      childAge,
      childName: selectedChildData?.name,
      duration: selectedDuration,
      location: type === "activity" ? selectedLocation : undefined,
    });

    if (generatedResult) {
      setResult(generatedResult);
      setShowResult(true);
    }
  };

  const handleRegenerate = async () => {
    if (currentType) {
      await handleGenerate(currentType);
    }
  };

  const tools = [
    {
      title: "Activity Generator",
      description: "AI-powered suggestions for indoor and outdoor activities based on your child's age, interests, and available time.",
      icon: Gamepad2,
      type: "activity" as ActivityType,
      premiumRequired: true,
    },
    {
      title: "Kitchen Assistant",
      description: "Kid-friendly recipes with ingredient lists, step-by-step instructions, and age-appropriate cooking tasks.",
      icon: ChefHat,
      type: "recipe" as ActivityType,
      premiumRequired: true,
    },
    {
      title: "Arts & Crafts Generator",
      description: "Get creative project ideas with step-by-step instructions and supply lists based on materials you have at home.",
      icon: Scissors,
      type: "craft" as ActivityType,
      premiumRequired: true,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5 sm:space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="mb-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Power tools for kid time
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-display font-bold">Kid Center</h1>
                  <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                    Generate faster ideas for activities, recipes, and crafts without bouncing between
                    multiple tools while you are already managing the day.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-card/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best for</p>
                  <p className="mt-2 text-sm font-medium">Rainy days, bored moments, and last-minute plan changes</p>
                </div>
                <div className="rounded-2xl border bg-card/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tools</p>
                  <p className="mt-2 text-sm font-medium">Activities, kitchen prompts, and arts-and-crafts ideas</p>
                </div>
                <div className="rounded-2xl border bg-card/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Also available</p>
                  <p className="mt-2 text-sm font-medium">Coloring pages, saved creations, and Nurse Nancy in Kids Hub</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Premium notice */}
        {!hasAccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Premium Feature
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Upgrade to Power to generate activities, recipes, and crafts from this screen.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Configuration Options */}
        {hasAccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Start with quick context</CardTitle>
                <CardDescription>
                  Give the generator enough detail to make the suggestions feel useful on the first pass.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Child</Label>
                    <Select value={selectedChild} onValueChange={setSelectedChild}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a child" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY_CHILD_VALUE}>Any child</SelectItem>
                        {children?.map((child) => (
                          <SelectItem key={child.id} value={child.id}>
                            {child.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15min">15 minutes</SelectItem>
                        <SelectItem value="30min">30 minutes</SelectItem>
                        <SelectItem value="1hour">1 hour</SelectItem>
                        <SelectItem value="2hours">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Select value={selectedLocation} onValueChange={handleLocationChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indoor">Indoor</SelectItem>
                        <SelectItem value="outdoor">Outdoor</SelectItem>
                        <SelectItem value="both">Either</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tool Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 gap-4 xl:grid-cols-3"
        >
          {tools.map((tool, index) => (
            <motion.div
              key={tool.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <ToolCard 
                {...tool} 
                hasAccess={hasAccess}
                onGenerate={handleGenerate}
                loading={loading}
                loadingType={currentType}
              />
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10">
                  <Palette className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="outline" className="text-xs gap-1">
                  <Sparkles className="w-3 h-3" />
                  More tools
                </Badge>
              </div>
              <CardTitle className="text-lg mt-3">Need the full Kids Hub?</CardTitle>
              <CardDescription className="text-sm">
                Open the broader hub for coloring pages, Nurse Nancy, and your saved creations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/dashboard/kids-hub">Open Kids Hub</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border bg-muted/40 p-5 sm:p-6"
        >
          <h3 className="font-semibold mb-2">How to use this well</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Give the tool the child, approximate time, and whether you need something indoors or outdoors.
            That keeps the output practical instead of overly broad. If you want a fuller creation workflow,
            jump into Kids Hub from above.
          </p>
        </motion.div>
      </div>

      {/* Result Modal */}
      {showResult && result && currentType && (
        <ActivityResultCard
          type={currentType}
          result={result}
          onClose={() => setShowResult(false)}
          onRegenerate={handleRegenerate}
          loading={loading}
        />
      )}
    </DashboardLayout>
  );
};

export default KidCenterPage;
