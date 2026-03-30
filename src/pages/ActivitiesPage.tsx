import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Plus,
  Folder,
  FolderPlus,
  Trash2,
  Pencil,
  Download,
  Printer,
  Clock,
  Sparkles,
  Save,
  MoreVertical,
  ChevronRight,
  Users,
  Zap,
  Palette,
  Eye,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { RoleGate } from "@/components/gates/RoleGate";
import { useActivityGenerator, type AIResponse, type GeneratedActivity } from "@/hooks/useActivityGenerator";
import { generateActivityPdf, openActivityPrintView } from "@/lib/activityExport";
import { format } from "date-fns";

// Chat message component
const ChatMessage = ({ message, onSave }: { 
  message: { role: string; content: string; activityData?: AIResponse }; 
  onSave?: (data: AIResponse) => void;
}) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} my-3`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        
        {/* Show save button for activity responses */}
        {message.activityData && message.activityData.type === "activity" && onSave && (
          <Button
            size="sm"
            className="mt-3 w-full gap-2 sm:w-auto"
            onClick={() => onSave(message.activityData!)}
          >
            <Save className="h-4 w-4" />
            Save Activity
          </Button>
        )}
      </div>
    </motion.div>
  );
};

// Activity card component
const ActivityCard = ({ 
  activity, 
  onView, 
  onExport, 
  onPrint, 
  onDelete 
}: { 
  activity: GeneratedActivity;
  onView: () => void;
  onExport: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) => {
  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
      <CardHeader className="pb-2" onClick={onView}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-1">{activity.title}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                Ages {activity.age_range}
              </Badge>
              {activity.duration_minutes && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {activity.duration_minutes} min
                </span>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete activity?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{activity.title}".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0" onClick={onView}>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {activity.energy_level && (
            <Badge variant="outline" className="text-xs capitalize">
              <Zap className="h-3 w-3 mr-1" />
              {activity.energy_level}
            </Badge>
          )}
          {activity.indoor_outdoor && (
            <Badge variant="outline" className="text-xs capitalize">
              📍 {activity.indoor_outdoor}
            </Badge>
          )}
          {activity.mess_level && (
            <Badge variant="outline" className="text-xs capitalize">
              <Palette className="h-3 w-3 mr-1" />
              {activity.mess_level} mess
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Activity detail modal
const ActivityDetailDialog = ({ 
  activity, 
  open, 
  onOpenChange,
  onExport,
  onPrint
}: { 
  activity: GeneratedActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: () => void;
  onPrint: () => void;
}) => {
  if (!activity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{activity.title}</DialogTitle>
          <DialogDescription>
            Ages {activity.age_range} • {activity.duration_minutes} minutes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick facts */}
          <div className="flex flex-wrap gap-2">
            {activity.indoor_outdoor && (
              <Badge variant="secondary" className="capitalize">📍 {activity.indoor_outdoor}</Badge>
            )}
            {activity.energy_level && (
              <Badge variant="secondary" className="capitalize">⚡ {activity.energy_level} energy</Badge>
            )}
            {activity.mess_level && (
              <Badge variant="secondary" className="capitalize">🎨 {activity.mess_level} mess</Badge>
            )}
            {activity.supervision_level && (
              <Badge variant="secondary" className="capitalize">👀 {activity.supervision_level} supervision</Badge>
            )}
          </div>

          {/* Materials */}
          {activity.materials.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Materials</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {activity.materials.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}

          {/* Steps */}
          {activity.steps.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Steps</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                {activity.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )}

          {/* Variations */}
          {(activity.variations.easier || activity.variations.harder) && (
            <div>
              <h3 className="font-semibold mb-2">Variations</h3>
              <div className="space-y-2 text-sm">
                {activity.variations.easier && (
                  <p><strong>Easier:</strong> {activity.variations.easier}</p>
                )}
                {activity.variations.harder && (
                  <p><strong>Harder:</strong> {activity.variations.harder}</p>
                )}
              </div>
            </div>
          )}

          {/* Learning Goals */}
          {activity.learning_goals.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Learning Goals</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {activity.learning_goals.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}

          {/* Safety Notes */}
          {activity.safety_notes && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">⚠️ Safety Notes</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">{activity.safety_notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={onPrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ActivitiesContent = () => {
  const ANY_AGE_VALUE = "any-age";
  const ANY_ENERGY_VALUE = "any-energy";
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [childAge, setChildAge] = useState<string>(ANY_AGE_VALUE);
  const [energyLevel, setEnergyLevel] = useState<string>(ANY_ENERGY_VALUE);
  const [activeTab, setActiveTab] = useState<"generate" | "saved">("generate");
  const [selectedActivity, setSelectedActivity] = useState<GeneratedActivity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    folders,
    activities,
    chatMessages,
    loading,
    generating,
    scopeError,
    selectedFolder,
    setSelectedFolder,
    fetchFolders,
    fetchActivities,
    createFolder,
    deleteFolder,
    sendMessage,
    saveActivity,
    deleteActivity,
    clearChat,
  } = useActivityGenerator();

  const hasActiveFilters = childAge !== ANY_AGE_VALUE || energyLevel !== ANY_ENERGY_VALUE;

  // Initialize
  useEffect(() => {
    fetchFolders();
    fetchActivities();
  }, [fetchFolders, fetchActivities]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!inputValue.trim() || generating) return;
    const message = inputValue.trim();
    setInputValue("");
    
    await sendMessage(message, {
      childAge: childAge !== ANY_AGE_VALUE ? parseInt(childAge, 10) : undefined,
      energyLevel: energyLevel !== ANY_ENERGY_VALUE ? energyLevel : undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveActivity = async (data: AIResponse) => {
    const saved = await saveActivity(data);
    if (saved) {
      fetchActivities();
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim());
    setNewFolderName("");
    setFolderDialogOpen(false);
  };

  const handleResetFilters = () => {
    setChildAge(ANY_AGE_VALUE);
    setEnergyLevel(ANY_ENERGY_VALUE);
  };

  const handleExport = (activity: GeneratedActivity) => {
    generateActivityPdf(activity);
  };

  const handlePrint = (activity: GeneratedActivity) => {
    openActivityPrintView(activity);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/kids-hub")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Activity Generator</h1>
              <p className="text-xs text-muted-foreground">AI-powered activity ideas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "generate" | "saved")} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4">
          <TabsList className="h-12">
            <TabsTrigger value="generate" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              <Folder className="h-4 w-4" />
              Saved ({activities.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Generate Tab */}
        <TabsContent value="generate" className="flex-1 flex flex-col overflow-hidden m-0">
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {/* Context inputs */}
            <div className="mb-4 rounded-xl border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Age:</label>
                    <Select value={childAge} onValueChange={setChildAge}>
                      <SelectTrigger className="w-24 h-9">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY_AGE_VALUE}>Any</SelectItem>
                        {[2,3,4,5,6,7,8,9,10,11,12].map(age => (
                          <SelectItem key={age} value={age.toString()}>{age} yrs</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Energy:</label>
                    <Select value={energyLevel} onValueChange={setEnergyLevel}>
                      <SelectTrigger className="w-28 h-9">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY_ENERGY_VALUE}>Any</SelectItem>
                        <SelectItem value="calm">Calm</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {chatMessages.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearChat}>
                    Clear Chat
                  </Button>
                )}
              </div>

                {hasActiveFilters && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {childAge !== ANY_AGE_VALUE && (
                      <Badge variant="secondary">Age {childAge}</Badge>
                    )}
                  {energyLevel !== ANY_ENERGY_VALUE && (
                    <Badge variant="secondary" className="capitalize">{energyLevel} energy</Badge>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={handleResetFilters}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset filters
                  </Button>
                  </div>
                )}

                <div className="mt-3 rounded-lg border border-dashed bg-background/80 p-3">
                  <p className="text-sm font-medium">Best results come from one clear request.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      Age or stage
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <ChevronRight className="h-3 w-3" />
                      Mood or energy
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Palette className="h-3 w-3" />
                      Materials on hand
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Example: “Need something calm for a 7-year-old after school with only paper, tape, and markers.”
                  </p>
                </div>
            </div>

            {/* Chat area */}
            <ScrollArea className="flex-1 border rounded-lg bg-muted/20">
              <div className="p-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <Sparkles className="h-12 w-12 text-primary/30 mx-auto mb-4" />
                    <h3 className="font-medium mb-2">Generate an Activity</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Tell me what kind of activity you're looking for. For example:
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      {[
                        "Indoor activity for a rainy day",
                        "Something creative with art supplies",
                        "High energy activity to tire them out",
                        "Educational science experiment",
                      ].map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="outline"
                          size="sm"
                          className="h-auto whitespace-normal px-3 py-2 text-left text-xs"
                          onClick={() => setInputValue(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <AnimatePresence>
                    {chatMessages.map((msg, i) => (
                      <ChatMessage
                        key={i}
                        message={msg}
                        onSave={msg.activityData ? handleSaveActivity : undefined}
                      />
                    ))}
                  </AnimatePresence>
                )}
                
                {generating && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start my-3"
                  >
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="flex gap-2 mt-4">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the activity you're looking for..."
                disabled={generating}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={!inputValue.trim() || generating} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Press Enter to send. Save the good ideas so they show up in your library tab.
            </p>
          </div>
        </TabsContent>

        {/* Saved Tab */}
        <TabsContent value="saved" className="flex-1 overflow-hidden m-0">
          <div className="flex h-full">
            {/* Folder sidebar */}
            <div className="w-48 border-r hidden md:block">
              <div className="p-3 border-b">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setFolderDialogOpen(true)}
                >
                  <FolderPlus className="h-4 w-4" />
                  New Folder
                </Button>
              </div>
              <ScrollArea className="h-[calc(100%-52px)]">
                <div className="p-2 space-y-1">
                  <Button
                    variant={selectedFolder === null ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2"
                    onClick={() => { setSelectedFolder(null); fetchActivities(); }}
                  >
                    <Folder className="h-4 w-4" />
                    All Activities
                  </Button>
                  {folders.map(folder => (
                    <Button
                      key={folder.id}
                      variant={selectedFolder === folder.id ? "secondary" : "ghost"}
                      className="w-full justify-start gap-2 group"
                      onClick={() => { setSelectedFolder(folder.id); fetchActivities(folder.id); }}
                    >
                      <Folder className="h-4 w-4" />
                      <span className="truncate flex-1 text-left">{folder.name}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Activities grid */}
            <div className="flex-1 p-4 overflow-auto">
              <div className="mb-4 space-y-3 md:hidden">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Folders</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setFolderDialogOpen(true)}
                  >
                    <FolderPlus className="h-4 w-4" />
                    New Folder
                  </Button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <Button
                    variant={selectedFolder === null ? "secondary" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => { setSelectedFolder(null); fetchActivities(); }}
                  >
                    All Activities
                  </Button>
                  {folders.map(folder => (
                    <Button
                      key={folder.id}
                      variant={selectedFolder === folder.id ? "secondary" : "outline"}
                      size="sm"
                      className="shrink-0"
                      onClick={() => { setSelectedFolder(folder.id); fetchActivities(folder.id); }}
                    >
                      {folder.name}
                    </Button>
                  ))}
                </div>
              </div>

              {scopeError ? (
                <div className="text-center py-12">
                  <Folder className="h-12 w-12 text-amber-600/60 mx-auto mb-4" />
                  <h3 className="font-medium mb-2">Active family required</h3>
                  <p className="text-sm text-muted-foreground">
                    {scopeError}
                  </p>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12">
                  <Folder className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No activities yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate an activity and save it to see it here.
                  </p>
                  <Button className="mt-4 gap-2" onClick={() => setActiveTab("generate")}>
                    <Sparkles className="h-4 w-4" />
                    Generate one now
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {activities.map(activity => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      onView={() => { setSelectedActivity(activity); setDetailOpen(true); }}
                      onExport={() => handleExport(activity)}
                      onPrint={() => handlePrint(activity)}
                      onDelete={() => deleteActivity(activity.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Activity Detail Dialog */}
      <ActivityDetailDialog
        activity={selectedActivity}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onExport={() => selectedActivity && handleExport(selectedActivity)}
        onPrint={() => selectedActivity && handlePrint(selectedActivity)}
      />

      {/* New Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>
              Organize your activities into folders.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ActivitiesPage = () => {
  return (
    <DashboardLayout>
      <RoleGate requireParent restrictedMessage="Activity Generator is only available to parents and guardians.">
        <PremiumFeatureGate featureName="Activity Generator">
          <ActivitiesContent />
        </PremiumFeatureGate>
      </RoleGate>
    </DashboardLayout>
  );
};

export default ActivitiesPage;
