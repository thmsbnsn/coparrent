/**
 * Development-only seed data generator
 * 
 * Creates demo data for testing, screenshots, and onboarding walkthroughs.
 * 
 * IMPORTANT:
 * - Disabled in production
 * - Respects plan limits and RLS
 * - Data is clearly labeled as demo/test
 */

import { supabase } from "@/integrations/supabase/client";

// Guard: Only allow in development
const isDev = import.meta.env.DEV;

export interface SeedResult {
  success: boolean;
  message: string;
  data?: {
    children?: string[];
    scheduleId?: string;
    messageCount?: number;
  };
}

/**
 * Check if seeding is allowed
 */
export const canSeed = (): boolean => {
  return isDev;
};

/**
 * Create sample children for the current user
 * Uses the proper RPC function to respect plan limits
 */
export const seedChildren = async (): Promise<SeedResult> => {
  if (!canSeed()) {
    return { success: false, message: "Seeding is disabled in production" };
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { success: false, message: "Must be logged in to seed data" };
    }

    const sampleChildren = [
      { name: "[Demo] Emma Thompson", dob: "2018-03-15" },
      { name: "[Demo] Liam Thompson", dob: "2020-07-22" },
    ];

    const createdIds: string[] = [];

    for (const child of sampleChildren) {
      const { data, error } = await supabase.rpc("rpc_add_child", {
        p_name: child.name,
        p_dob: child.dob,
      });

      if (error) {
        console.error("Failed to create child:", error);
        continue;
      }

      const result = data as { ok: boolean; data?: { id: string } };
      if (result.ok && result.data?.id) {
        createdIds.push(result.data.id);
      }
    }

    return {
      success: createdIds.length > 0,
      message: `Created ${createdIds.length} sample children`,
      data: { children: createdIds },
    };
  } catch (error) {
    console.error("Seed children error:", error);
    return { success: false, message: "Failed to create sample children" };
  }
};

/**
 * Create a basic custody schedule
 */
export const seedSchedule = async (): Promise<SeedResult> => {
  if (!canSeed()) {
    return { success: false, message: "Seeding is disabled in production" };
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { success: false, message: "Must be logged in to seed data" };
    }

    // Get current user's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, co_parent_id")
      .eq("user_id", user.user.id)
      .single();

    if (!profile) {
      return { success: false, message: "Profile not found" };
    }

    // Need a co-parent for schedule
    if (!profile.co_parent_id) {
      return { 
        success: false, 
        message: "Need a linked co-parent to create a schedule. Invite a co-parent first." 
      };
    }

    // Create a basic 2-2-3 schedule
    const { data: schedule, error } = await supabase
      .from("custody_schedules")
      .insert({
        parent_a_id: profile.id,
        parent_b_id: profile.co_parent_id,
        pattern: "2-2-3",
        start_date: new Date().toISOString().split("T")[0],
        exchange_time: "18:00",
        exchange_location: "[Demo] Central Park Playground",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create schedule:", error);
      return { success: false, message: "Failed to create schedule" };
    }

    return {
      success: true,
      message: "Created demo custody schedule (2-2-3 pattern)",
      data: { scheduleId: schedule.id },
    };
  } catch (error) {
    console.error("Seed schedule error:", error);
    return { success: false, message: "Failed to create schedule" };
  }
};

/**
 * Create sample journal entries
 */
export const seedJournalEntries = async (): Promise<SeedResult> => {
  if (!canSeed()) {
    return { success: false, message: "Seeding is disabled in production" };
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { success: false, message: "Must be logged in to seed data" };
    }

    const sampleEntries = [
      {
        title: "[Demo] Great weekend",
        content: "Kids had a wonderful time at the park. Emma learned to ride her bike without training wheels!",
        mood: "happy",
        tags: ["weekend", "milestone"],
      },
      {
        title: "[Demo] School pickup notes",
        content: "Liam mentioned he has a project due next week. Need to coordinate materials with co-parent.",
        mood: "neutral",
        tags: ["school", "coordination"],
      },
    ];

    let created = 0;
    for (const entry of sampleEntries) {
      const { error } = await supabase.from("journal_entries").insert({
        user_id: user.user.id,
        ...entry,
      });

      if (!error) created++;
    }

    return {
      success: created > 0,
      message: `Created ${created} sample journal entries`,
    };
  } catch (error) {
    console.error("Seed journal error:", error);
    return { success: false, message: "Failed to create journal entries" };
  }
};

/**
 * Run all seed operations
 */
export const seedAll = async (): Promise<SeedResult> => {
  if (!canSeed()) {
    return { success: false, message: "Seeding is disabled in production" };
  }

  const results: string[] = [];

  const childResult = await seedChildren();
  results.push(childResult.message);

  const journalResult = await seedJournalEntries();
  results.push(journalResult.message);

  // Schedule requires co-parent, so it may fail - that's okay
  const scheduleResult = await seedSchedule();
  results.push(scheduleResult.message);

  return {
    success: true,
    message: results.join(". "),
  };
};

/**
 * Clear demo data (items prefixed with [Demo])
 */
export const clearDemoData = async (): Promise<SeedResult> => {
  if (!canSeed()) {
    return { success: false, message: "Clearing is disabled in production" };
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { success: false, message: "Must be logged in" };
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.user.id)
      .single();

    if (!profile) {
      return { success: false, message: "Profile not found" };
    }

    // Delete demo children (via parent_children join)
    const { data: demoChildren } = await supabase
      .from("children")
      .select("id")
      .ilike("name", "[Demo]%");

    if (demoChildren && demoChildren.length > 0) {
      const childIds = demoChildren.map((c) => c.id);
      
      // Delete parent_children links first
      await supabase
        .from("parent_children")
        .delete()
        .in("child_id", childIds);
      
      // Then delete children
      await supabase.from("children").delete().in("id", childIds);
    }

    // Delete demo journal entries
    await supabase
      .from("journal_entries")
      .delete()
      .eq("user_id", user.user.id)
      .ilike("title", "[Demo]%");

    // Delete demo schedules
    await supabase
      .from("custody_schedules")
      .delete()
      .ilike("exchange_location", "[Demo]%");

    return {
      success: true,
      message: "Demo data cleared",
    };
  } catch (error) {
    console.error("Clear demo data error:", error);
    return { success: false, message: "Failed to clear demo data" };
  }
};
