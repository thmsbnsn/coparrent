/**
 * Type-safe component for rendering human-readable labels
 * Only accepts HumanLabel branded types to prevent raw ID/token display
 */

import type { HumanLabel } from "@/lib/safeText";

interface HumanTextProps {
  /** The HumanLabel value to render (must be sanitized via resolveDisplayName) */
  value: HumanLabel;
  /** Optional className for styling */
  className?: string;
}

/**
 * Renders a human-readable label in a type-safe way
 * Use with resolveDisplayName() to ensure no raw IDs are displayed
 */
export function HumanText({ value, className }: HumanTextProps) {
  return <span className={className}>{value}</span>;
}

export default HumanText;
