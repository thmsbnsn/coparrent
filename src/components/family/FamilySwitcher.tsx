import { Users } from "lucide-react";
import { useFamily } from "@/contexts/FamilyContext";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface FamilySwitcherProps {
  collapsed?: boolean;
}

const formatRole = (role: string | null) => {
  if (!role) return "No role";
  if (role === "third_party") return "Third Party";
  return role.charAt(0).toUpperCase() + role.slice(1);
};

export const FamilySwitcher = ({ collapsed = false }: FamilySwitcherProps) => {
  const { memberships, activeFamily, activeFamilyId, setActiveFamilyId, loading } = useFamily();

  if (loading) {
    return <Skeleton className={cn("h-10", collapsed ? "w-10" : "w-full")} />;
  }

  if (memberships.length === 0) {
    return (
      <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground">
          <Users className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground">No family selected</div>
            <div className="text-xs text-sidebar-foreground/70">Family access will appear here.</div>
          </div>
        )}
      </div>
    );
  }

  if (collapsed) {
    return (
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground"
        title={activeFamily?.display_name ?? "Family"}
      >
        <Users className="h-4 w-4" />
      </div>
    );
  }

  if (memberships.length === 1) {
    const membership = memberships[0];
    return (
      <div className="space-y-1">
        <div className="truncate text-sm font-medium text-sidebar-foreground">
          {membership.familyName ?? "Family"}
        </div>
        <Badge variant="secondary" className="bg-sidebar-accent text-sidebar-foreground">
          {formatRole(membership.role)}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Select value={activeFamilyId ?? undefined} onValueChange={setActiveFamilyId}>
        <SelectTrigger className="border-sidebar-border bg-sidebar-accent text-sidebar-foreground">
          <SelectValue placeholder="Select family" />
        </SelectTrigger>
        <SelectContent>
          {memberships.map((membership) => (
            <SelectItem key={`${membership.familyId}-${membership.role}`} value={membership.familyId}>
              {membership.familyName ?? "Family"} · {formatRole(membership.role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="text-xs text-sidebar-foreground/70">
        Permissions follow the selected family.
      </div>
    </div>
  );
};
