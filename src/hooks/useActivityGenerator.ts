import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCreations } from "@/hooks/useCreations";

// ============= Type Exports =============

export type ActivityType = "activity" | "recipe" | "craft";

export interface AIResponse {
  type: ActivityType;
  title: string;
  age_range: string;
  duration_minutes?: number;
  indoor_outdoor?: string;
  energy_level?: string;
  mess_level?: string;
  supervision_level?: string;
  materials: string[];
  steps: string[];
  variations: {
    easier?: string;
    harder?: string;
  };
  learning_goals: string[];
  safety_notes?: string;
  // Recipe specific
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  ingredients?: Array<{ item: string; amount: string }>;
  instructions?: string[];
  kidTasks?: string[];
  adultTasks?: string[];
  nutritionNotes?: string;
  tips?: string[];
  // Craft specific
  skillsLearned?: string[];
  displayIdeas?: string[];
}

export interface GeneratedActivity {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  age_range: string;
  duration_minutes: number | null;
  indoor_outdoor: string | null;
  energy_level: string | null;
  mess_level: string | null;
  supervision_level: string | null;
  materials: string[];
  steps: string[];
  variations: {
    easier?: string;
    harder?: string;
  };
  learning_goals: string[];
  safety_notes: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityFolder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  activityData?: AIResponse;
}

interface GenerateOptions {
  childAge?: number;
  energyLevel?: string;
  location?: "indoor" | "outdoor" | "both";
  duration?: string;
}

export interface UseActivityGeneratorReturn {
  // Data
  folders: ActivityFolder[];
  activities: GeneratedActivity[];
  chatMessages: ChatMessage[];
  
  // Loading states
  loading: boolean;
  generating: boolean;
  error: string | null;
  
  // Folder selection
  selectedFolder: string | null;
  setSelectedFolder: (id: string | null) => void;
  
  // Actions
  fetchFolders: () => Promise<void>;
  fetchActivities: (folderId?: string) => Promise<void>;
  createFolder: (name: string) => Promise<ActivityFolder | null>;
  deleteFolder: (id: string) => Promise<boolean>;
  sendMessage: (message: string, options?: GenerateOptions) => Promise<void>;
  saveActivity: (data: AIResponse, folderId?: string) => Promise<GeneratedActivity | null>;
  deleteActivity: (id: string) => Promise<boolean>;
  clearChat: () => void;
  
  // Legacy API (simple generate)
  generate: (options: { type: ActivityType; childAge?: number; childName?: string; duration?: string; location?: "indoor" | "outdoor" | "both"; materials?: string[]; dietary?: string[] }) => Promise<AIResponse | null>;
  lastResult: AIResponse | null;
}

/**
 * Hook to generate kid activities, recipes, and crafts using AI.
 * Includes folder management and chat-based interaction.
 */
export const useActivityGenerator = (): UseActivityGeneratorReturn => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { createCreation } = useCreations();
  
  // Data state
  const [folders, setFolders] = useState<ActivityFolder[]>([]);
  const [activities, setActivities] = useState<GeneratedActivity[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selection state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  
  // Legacy state
  const [lastResult, setLastResult] = useState<AIResponse | null>(null);

  // ============= Folder Operations =============
  
  const fetchFolders = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("activity_folders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setFolders(data || []);
    } catch (err) {
      console.error("Failed to fetch folders:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createFolder = useCallback(async (name: string): Promise<ActivityFolder | null> => {
    if (!user) return null;
    
    try {
      const { data, error: insertError } = await supabase
        .from("activity_folders")
        .insert({ user_id: user.id, name })
        .select()
        .single();

      if (insertError) throw insertError;
      
      setFolders(prev => [data, ...prev]);
      toast({ title: "Folder created", description: `"${name}" folder created.` });
      return data;
    } catch (err) {
      toast({ title: "Error", description: "Failed to create folder.", variant: "destructive" });
      return null;
    }
  }, [user, toast]);

  const deleteFolder = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from("activity_folders")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      
      setFolders(prev => prev.filter(f => f.id !== id));
      if (selectedFolder === id) setSelectedFolder(null);
      toast({ title: "Folder deleted" });
      return true;
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete folder.", variant: "destructive" });
      return false;
    }
  }, [selectedFolder, toast]);

  // ============= Activity Operations =============

  const fetchActivities = useCallback(async (folderId?: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from("generated_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (folderId) {
        query = query.eq("folder_id", folderId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      // Parse JSON fields
      const parsed = (data || []).map(activity => ({
        ...activity,
        materials: Array.isArray(activity.materials) ? activity.materials : [],
        steps: Array.isArray(activity.steps) ? activity.steps : [],
        learning_goals: Array.isArray(activity.learning_goals) ? activity.learning_goals : [],
        variations: typeof activity.variations === 'object' && activity.variations !== null 
          ? activity.variations as { easier?: string; harder?: string }
          : { easier: undefined, harder: undefined },
      })) as GeneratedActivity[];
      
      setActivities(parsed);
    } catch (err) {
      console.error("Failed to fetch activities:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveActivity = useCallback(async (data: AIResponse, folderId?: string): Promise<GeneratedActivity | null> => {
    if (!user) return null;
    
    try {
      // Save to legacy generated_activities table for backward compatibility
      const insertData = {
        user_id: user.id,
        folder_id: folderId || selectedFolder || null,
        title: data.title,
        age_range: data.age_range,
        duration_minutes: data.duration_minutes || null,
        indoor_outdoor: data.indoor_outdoor || null,
        energy_level: data.energy_level || null,
        mess_level: data.mess_level || null,
        supervision_level: data.supervision_level || null,
        materials: data.materials || [],
        steps: data.steps || [],
        variations: data.variations || {},
        learning_goals: data.learning_goals || [],
        safety_notes: data.safety_notes || null,
      };

      const { data: saved, error: insertError } = await supabase
        .from("generated_activities")
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;
      
      // Also save to unified creations system
      try {
        // Create activity_details record
        const { data: detail, error: detailError } = await supabase
          .from('activity_details')
          .insert([{
            owner_user_id: user.id,
            activity_type: (data.type || 'activity') as string,
            age_range: data.age_range || null,
            duration: data.duration_minutes ? `${data.duration_minutes} minutes` : null,
            energy_level: data.energy_level || null,
            materials: JSON.parse(JSON.stringify(data.materials || [])),
            steps: JSON.parse(JSON.stringify(data.steps || [])),
            variations: JSON.parse(JSON.stringify(data.variations || {})),
            learning_goals: JSON.parse(JSON.stringify(data.learning_goals || [])),
            safety_notes: data.safety_notes ? JSON.parse(JSON.stringify([data.safety_notes])) : [],
            raw_response: JSON.parse(JSON.stringify(data)),
          }])
          .select()
          .single();

        if (!detailError && detail) {
          // Create creations index entry
          await createCreation({
            type: 'activity',
            title: data.title,
            detail_id: detail.id,
            meta: {
              age_range: data.age_range,
              duration_minutes: data.duration_minutes,
              energy_level: data.energy_level,
            },
          });
        }
      } catch (creationErr) {
        // Log but don't fail the save - legacy table is primary
        console.warn('Failed to save to unified creations:', creationErr);
      }
      
      toast({ title: "Activity saved!", description: `"${data.title}" saved to your collection.` });
      return saved as GeneratedActivity;
    } catch (err) {
      toast({ title: "Error", description: "Failed to save activity.", variant: "destructive" });
      return null;
    }
  }, [user, selectedFolder, toast, createCreation]);

  const deleteActivity = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from("generated_activities")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      
      setActivities(prev => prev.filter(a => a.id !== id));
      toast({ title: "Activity deleted" });
      return true;
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete activity.", variant: "destructive" });
      return false;
    }
  }, [toast]);

  // ============= Chat & AI Generation =============

  const sendMessage = useCallback(async (message: string, options?: GenerateOptions) => {
    setGenerating(true);
    setError(null);

    // Add user message to chat
    setChatMessages(prev => [...prev, { role: "user", content: message }]);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("kid-activity-generator", {
        body: {
          type: "activity",
          prompt: message,
          childAge: options?.childAge,
          energyLevel: options?.energyLevel,
          location: options?.location,
          duration: options?.duration,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        if (data.code === "PREMIUM_REQUIRED") {
          setChatMessages(prev => [...prev, { 
            role: "assistant", 
            content: "This feature requires a premium subscription. Upgrade to unlock AI-powered activity generation!" 
          }]);
          return;
        }
        if (data.code === "RATE_LIMIT") {
          setChatMessages(prev => [...prev, { 
            role: "assistant", 
            content: "You've reached the limit for now. Please wait a moment before generating another activity." 
          }]);
          return;
        }
        throw new Error(data.error);
      }

      const result = data.result as AIResponse;
      setLastResult(result);

      // Format response for chat
      const responseText = formatActivityResponse(result);
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: responseText,
        activityData: result
      }]);

    } catch (err) {
      console.error("Generation failed:", err);
      const userMessage = "I couldn't generate an activity right now. Please try again!";
      setError(userMessage);
      setChatMessages(prev => [...prev, { role: "assistant", content: userMessage }]);
    } finally {
      setGenerating(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setChatMessages([]);
    setLastResult(null);
  }, []);

  // ============= Legacy Generate API =============

  const generate = useCallback(async (options: {
    type: ActivityType;
    childAge?: number;
    childName?: string;
    duration?: string;
    location?: "indoor" | "outdoor" | "both";
    materials?: string[];
    dietary?: string[];
  }): Promise<AIResponse | null> => {
    setGenerating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("kid-activity-generator", {
        body: options,
      });

      if (fnError) throw fnError;

      if (data.error) {
        if (data.code === "PREMIUM_REQUIRED") {
          setError("Premium subscription required");
          toast({
            title: "Premium Feature",
            description: "Upgrade to premium to access AI-powered activities.",
            variant: "destructive",
          });
          return null;
        }
        if (data.code === "RATE_LIMIT") {
          setError("Rate limit exceeded. Please try again later.");
          toast({
            title: "Too Many Requests",
            description: "Please wait a moment before generating another activity.",
            variant: "destructive",
          });
          return null;
        }
        throw new Error(data.error);
      }

      const result = data.result as AIResponse;
      setLastResult(result);
      return result;
    } catch (err) {
      const userMessage = "Unable to generate activity. Please try again.";
      setError(userMessage);
      toast({
        title: "Generation Failed",
        description: userMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setGenerating(false);
    }
  }, [toast]);

  return {
    // Data
    folders,
    activities,
    chatMessages,
    
    // Loading states
    loading,
    generating,
    error,
    
    // Selection
    selectedFolder,
    setSelectedFolder,
    
    // Actions
    fetchFolders,
    fetchActivities,
    createFolder,
    deleteFolder,
    sendMessage,
    saveActivity,
    deleteActivity,
    clearChat,
    
    // Legacy
    generate,
    lastResult,
  };
};

// Helper function to format activity response for chat
function formatActivityResponse(activity: AIResponse): string {
  let response = `## ${activity.title}\n\n`;
  response += `**Ages:** ${activity.age_range}\n`;
  
  if (activity.duration_minutes) response += `**Duration:** ${activity.duration_minutes} min\n`;
  if (activity.energy_level) response += `**Energy:** ${activity.energy_level}\n`;
  if (activity.indoor_outdoor) response += `**Location:** ${activity.indoor_outdoor}\n`;
  
  if (activity.materials?.length) {
    response += `\n**Materials:**\n`;
    activity.materials.forEach(m => response += `• ${m}\n`);
  }
  
  if (activity.steps?.length) {
    response += `\n**Steps:**\n`;
    activity.steps.forEach((s, i) => response += `${i + 1}. ${s}\n`);
  }
  
  if (activity.safety_notes) {
    response += `\n⚠️ **Safety:** ${activity.safety_notes}`;
  }
  
  return response;
}
