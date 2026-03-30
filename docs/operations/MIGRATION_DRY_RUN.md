# Migration Dry-Run System

This document describes the **Data Migration Dry-Run & Idempotency Hardening** system for CoParrent, designed to ensure safe production migrations with zero risk of silent data corruption.

---

## Overview

The migration system provides:

1. **Dry-Run Mode** - Execute all validation checks without making any writes
2. **Idempotency Guarantees** - Ensure backfill/migration logic can be safely re-run
3. **Blocker Detection** - Identify issues that would prevent production migration
4. **Human-Readable Reports** - Clear output for developer review

---

## Critical Tables Validated

The following tables are validated as they are critical to user access, gating, security, and auditability:

| Table | Purpose | Validations |
|-------|---------|-------------|
| `profiles` | User identity, subscription state | Required columns, orphaned rows, subscription mismatches |
| `children` | Child records | Orphaned children (no parent link) |
| `parent_children` | Parent-child junction | Broken foreign keys, duplicate entries |
| `family_members` | Family-scoped access and active role membership | Missing profile references, duplicates, orphaned family bootstrap state |
| `invitations` | Co-parent/third-party invites with family binding | Orphaned invitations, expired pending, missing `family_id` after invite migration |
| `custody_schedules` | Custody patterns | Invalid parent references |
| `audit_logs` | Immutable audit trail | RLS enabled |
| `user_roles` | Admin/moderator roles | RLS enabled |

---

## Validation Categories

### 1. RLS Enabled
Verifies Row Level Security is active on all critical tables.

### 2. Required Columns
Confirms mandatory columns exist and are populated (e.g., `profiles.user_id`).

### 3. Foreign Key Valid
Checks that all foreign key references point to existing records.

### 4. Orphaned Rows
Detects records that should have relationships but don't:
- Children without parent_children links
- Invitations with missing inviters
- Family members with broken profile references

### 5. Data Integrity
Identifies logical inconsistencies:
- Profiles with NULL user_id
- Profiles without account_role
- Subscription tier mismatches (tier set but no active subscription/trial)

### 6. Idempotency
Ensures migration/backfill logic is safely re-runnable:
- Duplicate parent_children entries (same parent-child pair)
- Duplicate family_members entries

---

## Known Risk Scenarios

The system explicitly validates and handles:

| Scenario | Detection | Suggested Fix |
|----------|-----------|---------------|
| Children created before co-parent linking | Check for children with no parent_children rows | Link to creating parent |
| Invitations created pre-migration | Check for expired pending invitations | Update status to 'expired' |
| Users with missing profiles | Check for profiles with NULL user_id | Delete or link to auth user |
| Subscription/trial mismatches | Check for tier set but no active subscription | Grant free_access or downgrade |

---

## Usage

### Admin Dashboard

Navigate to **Admin Dashboard → Migration** tab to run the dry-run validation.

1. Click **Run Dry-Run**
2. Review the findings report
3. Address any blocking issues before production migration
4. Export report for documentation

### Programmatic Usage

```typescript
import { 
  executeMigrationDryRun, 
  canProceedToProduction,
  formatReportForConsole 
} from "@/lib/migrationDryRun";

// Run dry-run validation
const report = await executeMigrationDryRun(true);

// Check if ready for production
if (canProceedToProduction(report)) {
  console.log("✅ Ready for production migration");
} else {
  console.log("❌ Blocking issues found:", report.summary.blockers);
}

// Print human-readable report
console.log(formatReportForConsole(report));
```

---

## Report Structure

```typescript
interface DryRunReport {
  runId: string;           // Unique run identifier
  timestamp: string;       // ISO timestamp
  dryRun: boolean;         // Always true for dry-runs
  summary: {
    totalChecks: number;   // Total validation checks run
    passed: number;        // Checks with no issues
    warnings: number;      // Non-blocking issues
    critical: number;      // Serious issues
    blockers: number;      // Issues that block production
  };
  findings: ValidationFinding[];  // Detailed findings
  intendedChanges: IntendedChange[];  // What would change if executed
  executionTimeMs: number;  // Performance metric
}
```

---

## Severity Levels

| Level | Icon | Meaning | Blocks Production |
|-------|------|---------|-------------------|
| Critical | 🔴 | Serious data integrity issue | Yes (if `wouldBlock: true`) |
| Warning | 🟡 | Potential issue, review recommended | No |
| Info | 🔵 | Informational finding | No |

---

## Integration with Production Checklist

This system integrates with the existing Production Checklist in the Admin Dashboard. Before marking **Data Migration** as complete, run the dry-run and ensure:

1. `summary.blockers === 0`
2. All critical findings are addressed
3. Report is exported for audit trail

---

## Files

| File | Purpose |
|------|---------|
| `src/lib/migrationDryRun.ts` | Core validation logic and types |
| `src/components/admin/MigrationDryRunPanel.tsx` | Admin UI component |
| `docs/operations/MIGRATION_DRY_RUN.md` | This documentation |

---

## Related Documentation

- `docs/security/SECURITY_MODEL.md` - Security architecture
- `docs/security/GATED_FEATURES.md` - Feature access rules
- `README.md` - Project overview and design principles

---

_Last Updated: 2026-03-13_
