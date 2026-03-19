import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookHeart, Plus, Search, Calendar, Tag, 
  Smile, Meh, Frown, Heart, CloudRain,
  Trash2, Edit2, Download, Lock, Sparkles
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChildren } from "@/hooks/useChildren";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

interface JournalEntry {
  id: string;
  title: string | null;
  content: string;
  mood: string | null;
  child_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const MOOD_OPTIONS = [
  { value: 'calm', label: 'Calm', icon: Smile, color: 'text-green-500' },
  { value: 'happy', label: 'Happy', icon: Heart, color: 'text-pink-500' },
  { value: 'neutral', label: 'Neutral', icon: Meh, color: 'text-gray-500' },
  { value: 'frustrated', label: 'Frustrated', icon: Frown, color: 'text-orange-500' },
  { value: 'anxious', label: 'Anxious', icon: CloudRain, color: 'text-blue-500' },
];

const SUGGESTED_TAGS = ['exchange', 'milestone', 'concern', 'win', 'gratitude', 'reflection'];

export default function JournalPage() {
  const { user } = useAuth();
  const { children } = useChildren();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMood, setFilterMood] = useState<string>("all");
  const [filterChild, setFilterChild] = useState<string>("all");
  
  // New entry state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string>("neutral");
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error("Failed to load journal entries");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void fetchEntries();
    }
  }, [user, fetchEntries]);

  const handleSaveEntry = async () => {
    if (!user || !content.trim()) return;
    
    setIsSaving(true);
    try {
      const entryData = {
        user_id: user.id,
        title: title.trim() || null,
        content: content.trim(),
        mood,
        child_id: selectedChild && selectedChild !== "none" ? selectedChild : null,
        tags
      };

      if (editingEntry) {
        const { error } = await supabase
          .from('journal_entries')
          .update(entryData)
          .eq('id', editingEntry.id);
        
        if (error) throw error;
        toast.success("Entry updated");
      } else {
        const { error } = await supabase
          .from('journal_entries')
          .insert(entryData);
        
        if (error) throw error;
        toast.success("Entry saved privately");
      }

      resetForm();
      void fetchEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
      toast.error("Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteId) return;
    
    try {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;
      toast.success("Entry deleted");
      setDeleteId(null);
      void fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error("Failed to delete entry");
    }
  };

  const handleEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setTitle(entry.title || "");
    setContent(entry.content);
    setMood(entry.mood || "neutral");
    setSelectedChild(entry.child_id || "");
    setTags(entry.tags || []);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setIsDialogOpen(false);
    setEditingEntry(null);
    setTitle("");
    setContent("");
    setMood("neutral");
    setSelectedChild("");
    setTags([]);
    setCustomTag("");
  };

  const toggleTag = (tag: string) => {
    setTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (customTag.trim() && !tags.includes(customTag.trim())) {
      setTags(prev => [...prev, customTag.trim()]);
      setCustomTag("");
    }
  };

  const exportEntry = (entry: JournalEntry) => {
    const text = `
Title: ${entry.title || 'Untitled'}
Date: ${format(new Date(entry.created_at), 'MMMM d, yyyy h:mm a')}
Mood: ${entry.mood || 'Not specified'}
Tags: ${entry.tags?.join(', ') || 'None'}

${entry.content}
    `.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-${format(new Date(entry.created_at), 'yyyy-MM-dd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Entry exported");
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchQuery || 
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMood = filterMood === "all" || entry.mood === filterMood;
    const matchesChild = filterChild === "all" || entry.child_id === filterChild;
    return matchesSearch && matchesMood && matchesChild;
  });

  const getChildName = (childId: string | null) => {
    if (!childId) return null;
    const child = children.find(c => c.id === childId);
    return child?.name;
  };

  const getMoodIcon = (moodValue: string | null) => {
    const moodOption = MOOD_OPTIONS.find(m => m.value === moodValue);
    if (!moodOption) return null;
    const Icon = moodOption.icon;
    return <Icon className={`h-5 w-5 ${moodOption.color}`} />;
  };

  // Stats
  const thisMonthCount = entries.filter(e => {
    const entryDate = new Date(e.created_at);
    const now = new Date();
    return entryDate.getMonth() === now.getMonth() && 
           entryDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookHeart className="h-7 w-7 text-[#21B0FE]" />
              Private Journal
            </h1>
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <Lock className="h-3 w-3" />
              Your personal reflections—only you can see these
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) resetForm();
            setIsDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-[#21B0FE] hover:bg-[#21B0FE]/90">
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? "Edit Entry" : "New Journal Entry"}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                
                <Textarea
                  placeholder="What's on your mind? How are the kids? What went well today?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[150px]"
                />
                
                {/* Mood selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">How are you feeling?</label>
                  <div className="flex flex-wrap gap-2">
                    {MOOD_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant={mood === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setMood(option.value)}
                          className="gap-1"
                        >
                          <Icon className={`h-4 w-4 ${mood === option.value ? '' : option.color}`} />
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Child selector */}
                {children.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Related to child (optional)</label>
                    <Select value={selectedChild} onValueChange={setSelectedChild}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a child" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {children.map((child) => (
                          <SelectItem key={child.id} value={child.id}>
                            {child.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Tags */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_TAGS.map((tag) => (
                      <Badge
                        key={tag}
                        variant={tags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom tag"
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCustomTag()}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={addCustomTag}>
                      <Tag className="h-4 w-4" />
                    </Button>
                  </div>
                  {tags.filter(t => !SUGGESTED_TAGS.includes(t)).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.filter(t => !SUGGESTED_TAGS.includes(t)).map((tag) => (
                        <Badge
                          key={tag}
                          variant="default"
                          className="cursor-pointer"
                          onClick={() => toggleTag(tag)}
                        >
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <p className="text-xs text-muted-foreground mr-auto flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  This entry is completely private
                </p>
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button 
                  onClick={handleSaveEntry}
                  disabled={!content.trim() || isSaving}
                  className="bg-[#21B0FE] hover:bg-[#21B0FE]/90"
                >
                  {isSaving ? "Saving..." : editingEntry ? "Update" : "Save Entry"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Card className="bg-gradient-to-br from-[#21B0FE]/10 to-transparent border-[#21B0FE]/20">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-[#21B0FE]">{entries.length}</div>
              <div className="text-sm text-muted-foreground">Total Entries</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{thisMonthCount}</div>
              <div className="text-sm text-muted-foreground">This Month</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-500/10 to-transparent border-pink-500/20 col-span-2">
            <CardContent className="p-4 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-pink-500" />
              <div>
                <div className="text-sm font-medium">Keep journaling!</div>
                <div className="text-xs text-muted-foreground">
                  {thisMonthCount > 0 
                    ? "You're building a great habit for calmer co-parenting 🌟"
                    : "Try journaling after exchanges—it helps!"}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterMood} onValueChange={setFilterMood}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All moods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All moods</SelectItem>
              {MOOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {children.length > 0 && (
            <Select value={filterChild} onValueChange={setFilterChild}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All children" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All children</SelectItem>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </motion.div>

        {/* Entries List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading your journal...
            </div>
          ) : filteredEntries.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <BookHeart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {entries.length === 0 ? "Start Your Journal" : "No matching entries"}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {entries.length === 0 
                  ? "This is your private space to reflect on your co-parenting journey. Your entries are never shared."
                  : "Try adjusting your filters or search query."}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {filteredEntries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {getMoodIcon(entry.mood)}
                          <div>
                            <CardTitle className="text-base">
                              {entry.title || "Untitled Entry"}
                            </CardTitle>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => exportEntry(entry)}
                            className="h-8 w-8"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditEntry(entry)}
                            className="h-8 w-8"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(entry.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground whitespace-pre-wrap">{entry.content}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        {getChildName(entry.child_id) && (
                          <Badge variant="secondary" className="text-xs">
                            {getChildName(entry.child_id)}
                          </Badge>
                        )}
                        {entry.tags?.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your journal entry.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
