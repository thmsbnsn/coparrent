import { useState } from "react";
import { PencilLine, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useFamily } from "@/contexts/FamilyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EditFamilyNameDialog } from "@/components/family/EditFamilyNameDialog";
import { cn } from "@/lib/utils";

interface FamilySwitcherProps {
  collapsed?: boolean;
}

const formatRole = (role: string | null) => {
  if (!role) return "No role";
  if (role === "third_party") return "Third Party";
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const getMembershipBadgeLabel = (membership: { accessKind?: string; role: string | null }) =>
  membership.accessKind === "law_office" ? "Law Office Access" : formatRole(membership.role);

const getFamilyLabel = (index: number) => `Family ${index + 1}`;
const canManageFamilies = (role: string | null) => role === "parent" || role === "guardian";

export const FamilySwitcher = ({ collapsed = false }: FamilySwitcherProps) => {
  const { memberships, activeFamilyId, setActiveFamilyId, loading, refresh } = useFamily();
  const [renameOpen, setRenameOpen] = useState(false);
  const activeFamilyIndex = memberships.findIndex((membership) => membership.familyId === activeFamilyId);
  const activeMembership = activeFamilyIndex >= 0 ? memberships[activeFamilyIndex] : memberships[0] ?? null;
  const activeFamilyLabel = activeFamilyIndex >= 0 ? getFamilyLabel(activeFamilyIndex) : "Family";
  const canEditActiveFamily = Boolean(activeMembership && canManageFamilies(activeMembership.role));

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
        title={activeFamilyLabel}
      >
        <Users className="h-4 w-4" />
      </div>
    );
  }

  if (memberships.length === 1) {
    const membership = memberships[0];
    return (
      <div className="space-y-2">
        <div className="truncate text-sm font-medium text-sidebar-foreground">
          {getFamilyLabel(0)}
        </div>
        {membership.familyName && (
          <div className="truncate text-xs text-sidebar-foreground/70">
            {membership.familyName}
          </div>
        )}
        <Badge variant="secondary" className="bg-sidebar-accent text-sidebar-foreground">
          {getMembershipBadgeLabel(membership)}
        </Badge>
        {canEditActiveFamily && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto justify-start px-0 text-xs font-medium text-sidebar-primary hover:bg-transparent hover:text-sidebar-primary/80"
            onClick={() => setRenameOpen(true)}
          >
            <PencilLine className="h-3.5 w-3.5" />
            Edit family label
          </Button>
        )}
        {canManageFamilies(membership.role) && (
          <Link
            to="/dashboard/families/new"
            className="block text-xs font-medium text-sidebar-primary hover:text-sidebar-primary/80"
          >
            Add New or Connect with Another
          </Link>
        )}
        {activeMembership && (
          <EditFamilyNameDialog
            familyId={activeMembership.familyId}
            familyLabel={getFamilyLabel(0)}
            currentName={activeMembership.familyName}
            open={renameOpen}
            onOpenChange={setRenameOpen}
            onSaved={refresh}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Select value={activeFamilyId ?? undefined} onValueChange={setActiveFamilyId}>
        <SelectTrigger className="border-sidebar-border bg-sidebar-accent text-sidebar-foreground">
          {activeMembership ? (
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-medium">{activeFamilyLabel}</div>
              {activeMembership.familyName && (
                <div className="truncate text-xs text-sidebar-foreground/70">
                  {activeMembership.familyName}
                </div>
              )}
            </div>
          ) : (
            <SelectValue placeholder="Select family" />
          )}
        </SelectTrigger>
        <SelectContent>
          {memberships.map((membership, index) => (
            <SelectItem key={`${membership.familyId}-${membership.role}`} value={membership.familyId}>
              <div className="min-w-0">
                <div className="truncate font-medium">{getFamilyLabel(index)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {membership.familyName ?? getMembershipBadgeLabel(membership)}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="text-xs text-sidebar-foreground/70">
        {activeMembership?.accessKind === "law_office"
          ? "Switch between assigned families. Law office access follows the selected family."
          : "Switch between family workspaces. Permissions follow the selected family."}
      </div>
      {canEditActiveFamily && activeMembership && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto justify-start px-0 text-xs font-medium text-sidebar-primary hover:bg-transparent hover:text-sidebar-primary/80"
            onClick={() => setRenameOpen(true)}
          >
            <PencilLine className="h-3.5 w-3.5" />
            Edit family label
          </Button>
          <EditFamilyNameDialog
            familyId={activeMembership.familyId}
            familyLabel={activeFamilyLabel}
            currentName={activeMembership.familyName}
            open={renameOpen}
            onOpenChange={setRenameOpen}
            onSaved={refresh}
          />
        </>
      )}
    </div>
  );
};
