import { Home, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Household } from "@/hooks/useChoreCharts";

interface HouseholdToggleProps {
  value: Household;
  onChange: (value: Household) => void;
  parentALabel?: string;
  parentBLabel?: string;
  showAllOption?: boolean;
  className?: string;
}

export const HouseholdToggle = ({
  value,
  onChange,
  parentALabel = "My House",
  parentBLabel = "Other House",
  showAllOption = false,
  className,
}: HouseholdToggleProps) => {
  const options: Array<{ value: Household; label: string }> = [
    ...(showAllOption ? [{ value: "all" as Household, label: "All homes" }] : []),
    { value: "parent_a", label: parentALabel },
    { value: "parent_b", label: parentBLabel },
  ];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => onChange(option.value)}
        >
          {option.value === "all" ? (
            <Users className="h-4 w-4" />
          ) : (
            <Home className="h-4 w-4" />
          )}
          {option.label}
        </Button>
      ))}
    </div>
  );
};
