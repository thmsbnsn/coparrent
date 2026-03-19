import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Palette, Download, FileText, Printer, Save, AlertCircle, Info, History, FolderOpen, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { RoleGate } from "@/components/gates/RoleGate";
import { useColoringPages, type Difficulty } from "@/hooks/useColoringPages";
import { ColoringPageGallery } from "@/components/coloring-pages/ColoringPageGallery";
import { exportColoringPagePDF, printColoringPage } from "@/lib/coloringPageExport";
import { toast } from "sonner";

const EXAMPLE_PROMPTS = [
  "A friendly dragon playing with butterflies",
  "Underwater ocean scene with fish and coral",
  "Magical forest with fairies and mushrooms",
  "Space rocket flying past planets and stars",
  "Farm animals having a picnic",
  "Princess castle with rainbow and clouds",
];

const DIFFICULTY_INFO = {
  simple: { label: "Simple", ages: "Ages 3-5", description: "Bold outlines, simple shapes" },
  medium: { label: "Medium", ages: "Ages 5-8", description: "Moderate detail, clear elements" },
  detailed: { label: "Detailed", ages: "Ages 8+", description: "Intricate patterns, fine details" },
};

const ColoringPagesContent = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");
  const {
    generating,
    saving,
    currentImage,
    currentPageId,
    errorState,
    history,
    loadingHistory,
    generateColoringPage,
    saveToVault,
    saveToCreations,
    downloadPNG,
    clearCurrentImage,
  } = useColoringPages();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a description for your coloring page");
      return;
    }
    await generateColoringPage(prompt, difficulty);
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  const handleExportPDF = async () => {
    if (!currentImage) return;
    try {
      await exportColoringPagePDF(currentImage, prompt);
      toast.success("PDF exported!");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    }
  };

  const handlePrint = () => {
    if (!currentImage) return;
    try {
      printColoringPage(currentImage, prompt);
    } catch (error) {
      console.error("Print error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to print");
    }
  };

  const handleSaveToVault = async () => {
    if (!currentImage) return;
    await saveToVault(currentImage, prompt, difficulty, currentPageId || undefined);
  };

  const handleSaveToCreations = async () => {
    if (!currentImage) return;
    await saveToCreations(currentImage, prompt, difficulty);
  };

  const handleNewPage = () => {
    clearCurrentImage();
    setPrompt("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard/kids-hub")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Coloring Page Creator</h1>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Generate custom coloring pages based on your child's interests
          </p>
        </div>
      </div>

      {/* Error State */}
      {errorState && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {errorState.code === "RATE_LIMITED" ? "Daily Limit Reached" : "Error"}
          </AlertTitle>
          <AlertDescription>{errorState.message}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "history")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Create
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
            {history.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {history.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
        {/* Creation Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Create a Coloring Page
            </CardTitle>
            <CardDescription>
              Describe what you'd like to see and choose a difficulty level
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Prompt Input */}
            <div className="space-y-2">
              <Label htmlFor="prompt">What should the coloring page show?</Label>
              <Input
                id="prompt"
                placeholder="e.g., A friendly unicorn in a garden of flowers"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={generating}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              />
            </div>

            {/* Example Prompts */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Try these examples:</Label>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleExampleClick(example)}
                    disabled={generating}
                  >
                    {example.length > 25 ? example.slice(0, 25) + "..." : example}
                  </Button>
                ))}
              </div>
            </div>

            {/* Difficulty Toggle */}
            <div className="space-y-3">
              <Label>Difficulty Level</Label>
              <ToggleGroup
                type="single"
                value={difficulty}
                onValueChange={(value) => value && setDifficulty(value as Difficulty)}
                className="justify-start"
                disabled={generating}
              >
                {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((level) => (
                  <ToggleGroupItem
                    key={level}
                    value={level}
                    className="flex-col h-auto py-2 px-4"
                  >
                    <span className="font-medium">{DIFFICULTY_INFO[level].label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {DIFFICULTY_INFO[level].ages}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                {DIFFICULTY_INFO[difficulty].description}
              </p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Coloring Page
                </>
              )}
            </Button>

            {/* Privacy Note */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Generated images are saved to your account. You can save them to your Document Vault for easy access and sharing with your co-parent.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {currentImage ? "Your coloring page is ready!" : "Your coloring page will appear here"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-square bg-muted/30 rounded-lg border-2 border-dashed border-muted flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                {generating ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center p-4 w-full h-full flex flex-col items-center justify-center"
                  >
                    <Skeleton className="w-full h-full absolute inset-0" />
                    <div className="relative z-10 space-y-4">
                      <Palette className="h-12 w-12 text-primary mx-auto animate-pulse" />
                      <p className="text-sm text-muted-foreground">Creating your coloring page...</p>
                      <p className="text-xs text-muted-foreground">This may take a moment</p>
                    </div>
                  </motion.div>
                ) : currentImage ? (
                  <motion.img
                    key="image"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    src={currentImage}
                    alt="Generated coloring page"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center p-4"
                  >
                    <Palette className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No coloring page yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter a description and click Generate
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Buttons */}
            {currentImage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 space-y-3"
              >
                {/* Save Options */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleSaveToCreations}
                    disabled={saving}
                    variant="default"
                    className="gap-2"
                  >
                    <FolderOpen className="h-4 w-4" />
                    {saving ? "Saving..." : "Save to Library"}
                  </Button>
                  <Button
                    onClick={handleSaveToVault}
                    disabled={saving}
                    variant="outline"
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save to Vault
                  </Button>
                </div>

                {/* Export Options */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadPNG(currentImage, prompt)}
                    className="flex-col h-auto py-3"
                  >
                    <Download className="h-4 w-4 mb-1" />
                    <span className="text-xs">PNG</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportPDF}
                    className="flex-col h-auto py-3"
                  >
                    <FileText className="h-4 w-4 mb-1" />
                    <span className="text-xs">PDF</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePrint}
                    className="flex-col h-auto py-3"
                  >
                    <Printer className="h-4 w-4 mb-1" />
                    <span className="text-xs">Print</span>
                  </Button>
                </div>

                {/* New Page Button */}
                <Button
                  variant="ghost"
                  onClick={handleNewPage}
                  className="w-full text-muted-foreground"
                >
                  Create New Page
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Tips for Great Results</h3>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                <li>Be specific about the subject and scene</li>
                <li>Mention the style you want (cartoon, realistic, etc.)</li>
                <li>Choose a difficulty that matches your child's age</li>
                <li>Save your favorites to the Document Vault for easy access</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Your Coloring Pages
              </CardTitle>
              <CardDescription>
                Browse and re-download your previously generated coloring pages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ColoringPageGallery
                pages={history}
                loading={loadingHistory}
                onDownloadPNG={downloadPNG}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ColoringPagesPage = () => {
  return (
    <DashboardLayout>
      {/* Role gate: block third-party and child accounts */}
      <RoleGate requireParent restrictedMessage="Coloring Page Creator is only available to parents and guardians.">
        {/* Premium gate: require Power plan */}
        <PremiumFeatureGate featureName="Coloring Page Creator">
          <ColoringPagesContent />
        </PremiumFeatureGate>
      </RoleGate>
    </DashboardLayout>
  );
};

export default ColoringPagesPage;
