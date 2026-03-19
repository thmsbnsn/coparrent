/**
 * Centralized display labels for all backend values
 * Never render raw IDs, enums, or tokens in the UI
 */

// Subscription Status Labels
export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  free: "Free Plan",
  trial: "Free Trial",
  trialing: "Free Trial",
  active: "Power",
  premium: "Power", // Legacy mapping
  mvp: "Power", // Legacy mapping
  power: "Power",
  past_due: "Payment Issue",
  canceled: "Canceled",
  incomplete: "Setup Incomplete",
  incomplete_expired: "Expired",
  unpaid: "Unpaid",
  paused: "Paused",
} as const;

// Subscription Tier Labels
export const SUBSCRIPTION_TIER_LABELS: Record<string, string> = {
  free: "Free",
  trial: "Trial",
  power: "Power",
  // Legacy mappings
  premium: "Power",
  mvp: "Power",
} as const;

// User Role Labels (for family members)
export const MEMBER_ROLE_LABELS: Record<string, string> = {
  parent: "Parent",
  guardian: "Guardian",
  third_party: "Family Member",
  child: "Child",
  step_parent: "Step-Parent",
} as const;

// Account Role Labels (admin, etc.)
export const ACCOUNT_ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  moderator: "Moderator",
  user: "User",
  parent: "Parent",
  child: "Child Account",
} as const;

// Invitation Type Labels
export const INVITATION_TYPE_LABELS: Record<string, string> = {
  co_parent: "Co-Parent Invitation",
  third_party: "Family Member Invitation",
  step_parent: "Step-Parent Invitation",
} as const;

// Invitation Status Labels
export const INVITATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  declined: "Declined",
} as const;

// Schedule Request Type Labels
export const SCHEDULE_REQUEST_LABELS: Record<string, string> = {
  swap: "Schedule Swap",
  give: "Give Time",
  take: "Request Time",
  cancel: "Cancel Request",
} as const;

// Schedule Request Status Labels
export const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
} as const;

// Expense Category Labels
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  medical: "Medical",
  education: "Education",
  clothing: "Clothing",
  activities: "Activities",
  childcare: "Childcare",
  food: "Food",
  transportation: "Transportation",
  other: "Other",
} as const;

// Document Category Labels
export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  legal: "Legal Documents",
  medical: "Medical Records",
  education: "Education",
  identification: "Identification",
  financial: "Financial",
  other: "Other",
} as const;

// Thread Type Labels
export const THREAD_TYPE_LABELS: Record<string, string> = {
  family_channel: "Family Chat",
  direct_message: "Direct Message",
  group_chat: "Group Chat",
} as const;

// Access Reason Labels
export const ACCESS_REASON_LABELS: Record<string, string> = {
  "MVP Tester": "Early Access Tester",
  "Beta Tester": "Beta Tester",
  "Free Trial": "Free Trial",
  "Promotional Access": "Promotional Access",
} as const;

/**
 * Helper functions to get display labels with fallbacks
 */

export function getSubscriptionStatusLabel(status: string | null | undefined): string {
  if (!status) return "Free Plan";
  return SUBSCRIPTION_STATUS_LABELS[status.toLowerCase()] || "Free Plan";
}

export function getSubscriptionTierLabel(tier: string | null | undefined): string {
  if (!tier) return "Free";
  return SUBSCRIPTION_TIER_LABELS[tier.toLowerCase()] || "Free";
}

export function getMemberRoleLabel(role: string | null | undefined): string {
  if (!role) return "Member";
  return MEMBER_ROLE_LABELS[role.toLowerCase()] || "Member";
}

export function getAccountRoleLabel(role: string | null | undefined): string {
  if (!role) return "User";
  return ACCOUNT_ROLE_LABELS[role.toLowerCase()] || "User";
}

export function getInvitationTypeLabel(type: string | null | undefined): string {
  if (!type) return "Invitation";
  return INVITATION_TYPE_LABELS[type.toLowerCase()] || "Invitation";
}

export function getInvitationStatusLabel(status: string | null | undefined): string {
  if (!status) return "Pending";
  return INVITATION_STATUS_LABELS[status.toLowerCase()] || "Pending";
}

export function getScheduleRequestLabel(type: string | null | undefined): string {
  if (!type) return "Schedule Request";
  return SCHEDULE_REQUEST_LABELS[type.toLowerCase()] || "Schedule Request";
}

export function getScheduleStatusLabel(status: string | null | undefined): string {
  if (!status) return "Pending";
  return SCHEDULE_STATUS_LABELS[status.toLowerCase()] || "Pending";
}

export function getExpenseCategoryLabel(category: string | null | undefined): string {
  if (!category) return "Other";
  return EXPENSE_CATEGORY_LABELS[category.toLowerCase()] || category;
}

export function getDocumentCategoryLabel(category: string | null | undefined): string {
  if (!category) return "Other";
  return DOCUMENT_CATEGORY_LABELS[category.toLowerCase()] || category;
}

export function getThreadTypeLabel(type: string | null | undefined): string {
  if (!type) return "Chat";
  return THREAD_TYPE_LABELS[type] || "Chat";
}

export function getAccessReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "—";
  return ACCESS_REASON_LABELS[reason] || reason;
}

/**
 * Safe fallback for any display value
 * Never returns undefined, null, or raw IDs
 */
export function safeDisplayValue(
  value: string | null | undefined,
  fallback: string = "—"
): string {
  if (!value) return fallback;
  // Check if value looks like a UUID or ID
  if (/^[a-f0-9-]{36}$/i.test(value)) return fallback;
  // Check if value looks like a Stripe ID
  if (/^(price_|prod_|sub_|cus_|pi_|ch_|in_)/i.test(value)) return fallback;
  return value;
}

/**
 * Format a name with a fallback
 */
export function formatDisplayName(
  name: string | null | undefined,
  email: string | null | undefined,
  fallback: string = "Unknown"
): string {
  if (name && name.trim()) return name.trim();
  if (email && email.trim()) {
    // Return just the part before @ for privacy
    const atIndex = email.indexOf("@");
    if (atIndex > 0) return email.substring(0, atIndex);
    return email;
  }
  return fallback;
}
