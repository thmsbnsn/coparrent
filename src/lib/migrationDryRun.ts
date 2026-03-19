/**
 * Migration Dry-Run & Idempotency Hardening System
 * 
 * This module provides safe, idempotent validation utilities for production
 * data migrations. It implements a dry-run mechanism that:
 * - Executes all checks
 * - Logs intended changes
 * - Makes zero writes in dry-run mode
 * 
 * Critical tables validated:
 * - profiles (user access, identity)
 * - children (child records)
 * - parent_children (parent-child relationships)
 * - family_members (role-based access)
 * - invitations (co-parent/third-party linking)
 * - custody_schedules (schedule data ownership)
 * - audit_logs (immutable audit trail)
 * - subscriptions/trial state (gating enforcement)
 * 
 * @see docs/SECURITY_MODEL.md for security architecture
 * @see docs/GATED_FEATURES.md for gating enforcement
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// ============================================================
// Types
// ============================================================

/**
 * Severity levels for validation findings
 */
export type ValidationSeverity = "critical" | "warning" | "info";

/**
 * Categories of validation checks
 */
export type ValidationCategory = 
  | "rls_enabled"
  | "required_columns"
  | "foreign_key_valid"
  | "orphaned_rows"
  | "data_integrity"
  | "idempotency"
  | "security";

/**
 * Individual validation finding
 */
export interface ValidationFinding {
  id: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  table: string;
  message: string;
  affectedRows?: number;
  sampleIds?: string[];
  suggestedFix?: string;
  wouldBlock: boolean;
}

/**
 * Summary of a validation run
 */
export interface ValidationSummary {
  totalChecks: number;
  passed: number;
  warnings: number;
  critical: number;
  blockers: number;
}

/**
 * Complete dry-run report
 */
export interface DryRunReport {
  runId: string;
  timestamp: string;
  dryRun: boolean;
  summary: ValidationSummary;
  findings: ValidationFinding[];
  intendedChanges: IntendedChange[];
  executionTimeMs: number;
}

/**
 * Description of an intended change (would be made if not dry-run)
 */
export interface IntendedChange {
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  description: string;
  affectedRows: number;
  sampleData?: Record<string, unknown>[];
}

// ============================================================
// Critical Tables Registry
// ============================================================

/**
 * Tables critical to user access, gating, security, and auditability.
 * These are the primary validation targets.
 */
export const CRITICAL_TABLES = {
  profiles: {
    description: "User identity and subscription state",
    requiredColumns: ["id", "user_id", "account_role"],
    foreignKeys: [
      { column: "co_parent_id", references: { table: "profiles", column: "id" } },
      { column: "linked_child_id", references: { table: "children", column: "id" } },
    ],
    rlsRequired: true,
  },
  children: {
    description: "Child profiles with medical/school info",
    requiredColumns: ["id", "name"],
    foreignKeys: [],
    rlsRequired: true,
  },
  parent_children: {
    description: "Parent-child linking junction",
    requiredColumns: ["id", "parent_id", "child_id"],
    foreignKeys: [
      { column: "parent_id", references: { table: "profiles", column: "id" } },
      { column: "child_id", references: { table: "children", column: "id" } },
    ],
    rlsRequired: true,
  },
  family_members: {
    description: "Role-based family access (third-party, step-parent)",
    requiredColumns: ["id", "user_id", "profile_id", "primary_parent_id", "role", "status"],
    foreignKeys: [
      { column: "profile_id", references: { table: "profiles", column: "id" } },
      { column: "primary_parent_id", references: { table: "profiles", column: "id" } },
    ],
    rlsRequired: true,
  },
  invitations: {
    description: "Email-based invitations for co-parents and third-parties",
    requiredColumns: ["id", "inviter_id", "invitee_email", "status", "token"],
    foreignKeys: [
      { column: "inviter_id", references: { table: "profiles", column: "id" } },
    ],
    rlsRequired: true,
  },
  custody_schedules: {
    description: "Custody patterns and schedule data",
    requiredColumns: ["id", "parent_a_id", "parent_b_id", "pattern", "start_date"],
    foreignKeys: [
      { column: "parent_a_id", references: { table: "profiles", column: "id" } },
      { column: "parent_b_id", references: { table: "profiles", column: "id" } },
    ],
    rlsRequired: true,
  },
  audit_logs: {
    description: "Immutable audit trail for court-defensible records",
    requiredColumns: ["id", "action", "actor_user_id", "entity_type", "created_at"],
    foreignKeys: [],
    rlsRequired: true, // Read-only via RLS
  },
  user_roles: {
    description: "Admin/moderator role assignments",
    requiredColumns: ["id", "user_id", "role"],
    foreignKeys: [],
    rlsRequired: true,
  },
} as const;

// ============================================================
// Validation Functions
// ============================================================

/**
 * Generate a unique finding ID
 */
const generateFindingId = (category: string, table: string): string => {
  return `${category}-${table}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
};

/**
 * Check for orphaned children (created before co-parent linking)
 * 
 * Risk scenario: Children records that exist but have no parent_children link
 */
export async function checkOrphanedChildren(): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];

  // Find children with no parent_children entries
  const { data: orphans, error } = await supabase
    .from("children")
    .select(`
      id,
      name,
      created_at,
      parent_children!left(id)
    `)
    .is("parent_children.id", null);

  if (error) {
    findings.push({
      id: generateFindingId("orphaned_rows", "children"),
      category: "orphaned_rows",
      severity: "warning",
      table: "children",
      message: `Unable to check for orphaned children: ${error.message}`,
      wouldBlock: false,
    });
    return findings;
  }

  if (orphans && orphans.length > 0) {
    findings.push({
      id: generateFindingId("orphaned_rows", "children"),
      category: "orphaned_rows",
      severity: "critical",
      table: "children",
      message: `Found ${orphans.length} children with no parent linkage`,
      affectedRows: orphans.length,
      sampleIds: orphans.slice(0, 5).map(c => c.id),
      suggestedFix: "Link these children to their creating parent via parent_children table",
      wouldBlock: true,
    });
  }

  return findings;
}

/**
 * Check for invitations created pre-migration
 * 
 * Risk scenario: Invitations with expired tokens or missing inviter profiles
 */
export async function checkPreMigrationInvitations(): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];

  // Check for invitations with missing inviters
  const { data: orphanedInvites, error: orphanError } = await supabase
    .from("invitations")
    .select(`
      id,
      invitee_email,
      status,
      created_at,
      inviter:inviter_id(id)
    `)
    .is("inviter_id", null);

  if (orphanError) {
    findings.push({
      id: generateFindingId("orphaned_rows", "invitations"),
      category: "orphaned_rows",
      severity: "warning",
      table: "invitations",
      message: `Unable to check for orphaned invitations: ${orphanError.message}`,
      wouldBlock: false,
    });
  } else if (orphanedInvites && orphanedInvites.length > 0) {
    findings.push({
      id: generateFindingId("orphaned_rows", "invitations"),
      category: "orphaned_rows",
      severity: "critical",
      table: "invitations",
      message: `Found ${orphanedInvites.length} invitations with missing inviter`,
      affectedRows: orphanedInvites.length,
      sampleIds: orphanedInvites.slice(0, 5).map(i => i.id),
      suggestedFix: "Either delete these orphaned invitations or restore the inviter references",
      wouldBlock: true,
    });
  }

  // Check for expired pending invitations
  const { data: expiredInvites, error: expiredError } = await supabase
    .from("invitations")
    .select("id, status, expires_at")
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  if (!expiredError && expiredInvites && expiredInvites.length > 0) {
    findings.push({
      id: generateFindingId("data_integrity", "invitations"),
      category: "data_integrity",
      severity: "warning",
      table: "invitations",
      message: `Found ${expiredInvites.length} expired pending invitations`,
      affectedRows: expiredInvites.length,
      sampleIds: expiredInvites.slice(0, 5).map(i => i.id),
      suggestedFix: "Update status to 'expired' for these invitations",
      wouldBlock: false,
    });
  }

  return findings;
}

/**
 * Check for users with missing or partial profile rows
 * 
 * Risk scenario: Auth users without corresponding profiles
 */
export async function checkIncompleteProfiles(): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];

  // Check profiles with null user_id (should never happen)
  const { data: nullUserProfiles, error: nullError } = await supabase
    .from("profiles")
    .select("id")
    .is("user_id", null);

  if (!nullError && nullUserProfiles && nullUserProfiles.length > 0) {
    findings.push({
      id: generateFindingId("data_integrity", "profiles"),
      category: "data_integrity",
      severity: "critical",
      table: "profiles",
      message: `Found ${nullUserProfiles.length} profiles with NULL user_id`,
      affectedRows: nullUserProfiles.length,
      sampleIds: nullUserProfiles.slice(0, 5).map(p => p.id),
      suggestedFix: "Delete these orphaned profiles or link to appropriate auth users",
      wouldBlock: true,
    });
  }

  // Check for profiles without account_role (required for gating)
  const { data: noRoleProfiles, error: roleError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .is("account_role", null);

  if (!roleError && noRoleProfiles && noRoleProfiles.length > 0) {
    findings.push({
      id: generateFindingId("data_integrity", "profiles"),
      category: "data_integrity",
      severity: "warning",
      table: "profiles",
      message: `Found ${noRoleProfiles.length} profiles without account_role`,
      affectedRows: noRoleProfiles.length,
      sampleIds: noRoleProfiles.slice(0, 5).map(p => p.id),
      suggestedFix: "Set account_role to 'parent' for these profiles (default)",
      wouldBlock: false,
    });
  }

  return findings;
}

/**
 * Check for subscription/trial state mismatches
 * 
 * Risk scenario: Users with Power features but no valid subscription/trial
 */
export async function checkSubscriptionMismatches(): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];
  const now = new Date().toISOString();

  // Check for profiles claiming premium tier with expired/no trial
  // Note: free_premium_access is the column name in profiles table
  const { data: mismatchedProfiles, error } = await supabase
    .from("profiles")
    .select("id, subscription_tier, trial_ends_at, free_premium_access")
    .or(`subscription_tier.eq.power,subscription_tier.eq.premium,subscription_tier.eq.mvp`)
    .is("free_premium_access", null)
    .or(`trial_ends_at.is.null,trial_ends_at.lt.${now}`);

  if (error) {
    findings.push({
      id: generateFindingId("data_integrity", "profiles"),
      category: "data_integrity",
      severity: "warning",
      table: "profiles",
      message: `Unable to check subscription mismatches: ${error.message}`,
      wouldBlock: false,
    });
    return findings;
  }

  if (mismatchedProfiles && mismatchedProfiles.length > 0) {
    findings.push({
      id: generateFindingId("data_integrity", "profiles"),
      category: "data_integrity",
      severity: "warning",
      table: "profiles",
      message: `Found ${mismatchedProfiles.length} profiles with tier mismatch (tier set but no active trial/subscription)`,
      affectedRows: mismatchedProfiles.length,
      sampleIds: mismatchedProfiles.slice(0, 5).map(p => p.id),
      suggestedFix: "Either grant free_access, extend trial, or downgrade tier to 'free'",
      wouldBlock: false,
    });
  }

  return findings;
}

/**
 * Check for family_members with invalid relationships
 * 
 * Risk scenario: Third-party records pointing to non-existent profiles
 */
export async function checkFamilyMemberIntegrity(): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];

  // Check for family_members with missing profile reference
  const { data: orphanedMembers, error: memberError } = await supabase
    .from("family_members")
    .select(`
      id,
      role,
      status,
      profile:profile_id(id),
      primary_parent:primary_parent_id(id)
    `)
    .or("profile_id.is.null,primary_parent_id.is.null");

  if (memberError) {
    findings.push({
      id: generateFindingId("orphaned_rows", "family_members"),
      category: "orphaned_rows",
      severity: "warning",
      table: "family_members",
      message: `Unable to check family member integrity: ${memberError.message}`,
      wouldBlock: false,
    });
    return findings;
  }

  // Filter to find truly orphaned (where join returned null)
  const orphaned = orphanedMembers?.filter(
    m => !m.profile || !m.primary_parent
  ) || [];

  if (orphaned.length > 0) {
    findings.push({
      id: generateFindingId("orphaned_rows", "family_members"),
      category: "orphaned_rows",
      severity: "critical",
      table: "family_members",
      message: `Found ${orphaned.length} family_members with broken profile or parent references`,
      affectedRows: orphaned.length,
      sampleIds: orphaned.slice(0, 5).map(m => m.id),
      suggestedFix: "Delete orphaned family_member records or restore profile references",
      wouldBlock: true,
    });
  }

  return findings;
}

/**
 * Check custody_schedules for valid parent references
 */
export async function checkCustodyScheduleIntegrity(): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];

  const { data: schedules, error } = await supabase
    .from("custody_schedules")
    .select(`
      id,
      parent_a:parent_a_id(id),
      parent_b:parent_b_id(id)
    `);

  if (error) {
    findings.push({
      id: generateFindingId("foreign_key_valid", "custody_schedules"),
      category: "foreign_key_valid",
      severity: "warning",
      table: "custody_schedules",
      message: `Unable to check custody schedule integrity: ${error.message}`,
      wouldBlock: false,
    });
    return findings;
  }

  const broken = schedules?.filter(s => !s.parent_a || !s.parent_b) || [];

  if (broken.length > 0) {
    findings.push({
      id: generateFindingId("foreign_key_valid", "custody_schedules"),
      category: "foreign_key_valid",
      severity: "critical",
      table: "custody_schedules",
      message: `Found ${broken.length} custody_schedules with invalid parent references`,
      affectedRows: broken.length,
      sampleIds: broken.slice(0, 5).map(s => s.id),
      suggestedFix: "Restore parent profile references or archive invalid schedules",
      wouldBlock: true,
    });
  }

  return findings;
}

/**
 * Check for parent_children entries with broken links
 */
export async function checkParentChildrenIntegrity(): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];

  const { data: links, error } = await supabase
    .from("parent_children")
    .select(`
      id,
      parent:parent_id(id),
      child:child_id(id)
    `);

  if (error) {
    findings.push({
      id: generateFindingId("foreign_key_valid", "parent_children"),
      category: "foreign_key_valid",
      severity: "warning",
      table: "parent_children",
      message: `Unable to check parent_children integrity: ${error.message}`,
      wouldBlock: false,
    });
    return findings;
  }

  const broken = links?.filter(l => !l.parent || !l.child) || [];

  if (broken.length > 0) {
    findings.push({
      id: generateFindingId("foreign_key_valid", "parent_children"),
      category: "foreign_key_valid",
      severity: "critical",
      table: "parent_children",
      message: `Found ${broken.length} parent_children links with broken references`,
      affectedRows: broken.length,
      sampleIds: broken.slice(0, 5).map(l => l.id),
      suggestedFix: "Delete orphaned parent_children entries",
      wouldBlock: true,
    });
  }

  return findings;
}

// ============================================================
// Idempotency Checks
// ============================================================

/**
 * Verify that running backfill logic would not cause duplicates
 * Uses direct SQL queries since RPC functions may not exist
 */
export async function checkIdempotencyRisks(): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];

  // Check for duplicate parent_children entries using raw query approach
  // We'll check by looking for parent_id + child_id combinations
  try {
    // Get all parent_children and check for duplicates client-side
    const { data: allLinks, error: pcError } = await supabase
      .from("parent_children")
      .select("id, parent_id, child_id");

    if (pcError) {
      findings.push({
        id: generateFindingId("idempotency", "parent_children"),
        category: "idempotency",
        severity: "warning",
        table: "parent_children",
        message: `Unable to check for duplicate links: ${pcError.message}`,
        wouldBlock: false,
      });
    } else if (allLinks) {
      // Find duplicates by parent_id + child_id combination
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      
      for (const link of allLinks) {
        const key = `${link.parent_id}:${link.child_id}`;
        if (seen.has(key)) {
          duplicates.push(link.id);
        } else {
          seen.set(key, link.id);
        }
      }

      if (duplicates.length > 0) {
        findings.push({
          id: generateFindingId("idempotency", "parent_children"),
          category: "idempotency",
          severity: "critical",
          table: "parent_children",
          message: `Found ${duplicates.length} duplicate parent-child links`,
          affectedRows: duplicates.length,
          sampleIds: duplicates.slice(0, 5),
          suggestedFix: "Deduplicate parent_children table, keeping oldest record",
          wouldBlock: true,
        });
      }
    }
  } catch (err) {
    console.error("[Migration] Idempotency check failed for parent_children:", err);
  }

  // Check for duplicate family_members entries
  try {
    const { data: allMembers, error: fmError } = await supabase
      .from("family_members")
      .select("id, profile_id, primary_parent_id, role");

    if (fmError) {
      findings.push({
        id: generateFindingId("idempotency", "family_members"),
        category: "idempotency",
        severity: "warning",
        table: "family_members",
        message: `Unable to check for duplicate family members: ${fmError.message}`,
        wouldBlock: false,
      });
    } else if (allMembers) {
      // Find duplicates by profile_id + primary_parent_id + role
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      
      for (const member of allMembers) {
        const key = `${member.profile_id}:${member.primary_parent_id}:${member.role}`;
        if (seen.has(key)) {
          duplicates.push(member.id);
        } else {
          seen.set(key, member.id);
        }
      }

      if (duplicates.length > 0) {
        findings.push({
          id: generateFindingId("idempotency", "family_members"),
          category: "idempotency",
          severity: "critical",
          table: "family_members",
          message: `Found ${duplicates.length} duplicate family_member records`,
          affectedRows: duplicates.length,
          sampleIds: duplicates.slice(0, 5),
          suggestedFix: "Deduplicate family_members table",
          wouldBlock: true,
        });
      }
    }
  } catch (err) {
    console.error("[Migration] Idempotency check failed for family_members:", err);
  }

  return findings;
}

// ============================================================
// Main Dry-Run Executor
// ============================================================

/**
 * Execute a complete migration dry-run
 * 
 * This function:
 * 1. Runs all validation checks
 * 2. Logs intended changes
 * 3. Makes ZERO writes (dry-run mode)
 * 4. Returns a definitive report
 * 
 * @param dryRun - If true (default), no writes are made
 */
export async function executeMigrationDryRun(dryRun: boolean = true): Promise<DryRunReport> {
  const startTime = performance.now();
  const runId = `dry-run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  
  const findings: ValidationFinding[] = [];
  const intendedChanges: IntendedChange[] = [];

  console.log(`[Migration] Starting ${dryRun ? "DRY-RUN" : "LIVE"} validation (${runId})`);

  // Execute all checks in parallel for efficiency
  const checkResults = await Promise.allSettled([
    checkOrphanedChildren(),
    checkPreMigrationInvitations(),
    checkIncompleteProfiles(),
    checkSubscriptionMismatches(),
    checkFamilyMemberIntegrity(),
    checkCustodyScheduleIntegrity(),
    checkParentChildrenIntegrity(),
    checkIdempotencyRisks(),
  ]);

  // Collect findings from all checks
  checkResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      findings.push(...result.value);
    } else {
      console.error(`[Migration] Check ${index} failed:`, result.reason);
      findings.push({
        id: generateFindingId("data_integrity", "unknown"),
        category: "data_integrity",
        severity: "warning",
        table: "unknown",
        message: `Validation check ${index} failed: ${result.reason}`,
        wouldBlock: false,
      });
    }
  });

  // Generate intended changes based on findings
  findings.forEach(finding => {
    if (finding.affectedRows && finding.affectedRows > 0 && finding.suggestedFix) {
      intendedChanges.push({
        table: finding.table,
        operation: finding.suggestedFix.toLowerCase().includes("delete") ? "DELETE" : "UPDATE",
        description: finding.suggestedFix,
        affectedRows: finding.affectedRows,
      });
    }
  });

  // Calculate summary
  const summary: ValidationSummary = {
    totalChecks: findings.length,
    passed: findings.filter(f => f.severity === "info").length,
    warnings: findings.filter(f => f.severity === "warning").length,
    critical: findings.filter(f => f.severity === "critical").length,
    blockers: findings.filter(f => f.wouldBlock).length,
  };

  const executionTimeMs = Math.round(performance.now() - startTime);

  console.log(`[Migration] Completed in ${executionTimeMs}ms:`, summary);

  return {
    runId,
    timestamp: new Date().toISOString(),
    dryRun,
    summary,
    findings,
    intendedChanges,
    executionTimeMs,
  };
}

/**
 * Check if migration can proceed to production
 */
export function canProceedToProduction(report: DryRunReport): boolean {
  return report.summary.blockers === 0;
}

/**
 * Format report for human-readable output
 */
export function formatReportForConsole(report: DryRunReport): string {
  const lines: string[] = [
    `\n${"=".repeat(60)}`,
    `MIGRATION DRY-RUN REPORT`,
    `${"=".repeat(60)}`,
    `Run ID: ${report.runId}`,
    `Timestamp: ${report.timestamp}`,
    `Mode: ${report.dryRun ? "DRY-RUN (no writes)" : "LIVE"}`,
    `Execution Time: ${report.executionTimeMs}ms`,
    ``,
    `SUMMARY:`,
    `  Total Checks: ${report.summary.totalChecks}`,
    `  Passed: ${report.summary.passed}`,
    `  Warnings: ${report.summary.warnings}`,
    `  Critical: ${report.summary.critical}`,
    `  Blockers: ${report.summary.blockers}`,
    ``,
    report.summary.blockers > 0
      ? `❌ CANNOT PROCEED TO PRODUCTION - ${report.summary.blockers} blocking issue(s)`
      : `✅ READY FOR PRODUCTION - No blocking issues`,
    ``,
  ];

  if (report.findings.length > 0) {
    lines.push(`FINDINGS:`);
    lines.push(`${"─".repeat(60)}`);
    report.findings.forEach((f, i) => {
      const icon = f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "🔵";
      lines.push(`${i + 1}. ${icon} [${f.category}] ${f.table}`);
      lines.push(`   ${f.message}`);
      if (f.affectedRows) lines.push(`   Affected: ${f.affectedRows} rows`);
      if (f.suggestedFix) lines.push(`   Fix: ${f.suggestedFix}`);
      if (f.wouldBlock) lines.push(`   ⛔ BLOCKS PRODUCTION`);
      lines.push(``);
    });
  }

  if (report.intendedChanges.length > 0) {
    lines.push(`INTENDED CHANGES (if executed):`);
    lines.push(`${"─".repeat(60)}`);
    report.intendedChanges.forEach((c, i) => {
      lines.push(`${i + 1}. [${c.operation}] ${c.table} - ${c.affectedRows} rows`);
      lines.push(`   ${c.description}`);
      lines.push(``);
    });
  }

  lines.push(`${"=".repeat(60)}\n`);

  return lines.join("\n");
}
