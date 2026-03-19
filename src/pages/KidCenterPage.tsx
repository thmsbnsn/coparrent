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
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { useActivityGenerator, type AIResponse, ActivityType } from "@/hooks/useActivityGenerator";
import { useChildren } from "@/hooks/useChildren";
import { ActivityResultCard } from "@/components/kid-center/ActivityResultCard";

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
  const { generate, loading, lastResult } = useActivityGenerator();
  
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<string>("30min");
  const [selectedLocation, setSelectedLocation] = useState<"indoor" | "outdoor" | "both">("indoor");
  const [currentType, setCurrentType] = useState<ActivityType | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);

  const selectedChildData = children?.find(c => c.id === selectedChild);
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
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold">Kid Center</h1>
              <p className="text-muted-foreground mt-1">
                AI-powered tools to keep your kids entertained and learning
              </p>
            </div>
          </div>
        </motion.div>

        {/* Premium notice */}
        {!hasAccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Premium Feature
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Upgrade to premium to access AI-powered Kid Center tools.
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Personalize</CardTitle>
                <CardDescription>Customize activities for your child</CardDescription>
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
                        <SelectItem value="">Any child</SelectItem>
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
          className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6"
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

        {/* Coloring Pages - Coming Soon */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10">
                  <Palette className="w-6 h-6 text-primary" />
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="secondary" className="text-xs">
                    Coming Soon
                  </Badge>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Sparkles className="w-3 h-3" />
                    Premium
                  </Badge>
                </div>
              </div>
              <CardTitle className="text-lg mt-3">AI Coloring Pages</CardTitle>
              <CardDescription className="text-sm">
                Generate custom coloring pages featuring your child's favorite characters, animals, or themes. Perfect for quiet time activities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 p-6 rounded-xl bg-muted/50 border"
        >
          <h3 className="font-semibold mb-2">About Kid Center</h3>
          <p className="text-sm text-muted-foreground">
            Kid Center is designed to provide parents with AI-powered tools to create engaging activities 
            for their children. From recipes to crafts, these tools help you spend quality time 
            with your kids while fostering creativity and learning. All content is generated with 
            age-appropriate considerations in mind.
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
