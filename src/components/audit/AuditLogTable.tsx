import { useState } from "react";
import { format } from "date-fns";
import { Eye, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Filter } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  AuditLog,
  useAuditLogs,
  getActionLabel,
  getActionVariant,
  getRoleLabel,
  getRoleVariant,
} from "@/hooks/useAuditLogs";
import { resolvePersonName, resolveChildName } from "@/lib/displayResolver";
import type { Child } from "@/hooks/useChildren";

interface AuditLogTableProps {
  children?: Child[];
}

const getActionIcon = (action: string) => {
  switch (action) {
    case "CHILD_VIEW":
      return <Eye className="w-4 h-4" />;
    case "CHILD_INSERT":
      return <Plus className="w-4 h-4" />;
    case "CHILD_UPDATE":
      return <Pencil className="w-4 h-4" />;
    case "CHILD_DELETE":
      return <Trash2 className="w-4 h-4" />;
    default:
      return null;
  }
};

export const AuditLogTable = ({ children = [] }: AuditLogTableProps) => {
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const { logs, loading, error, refetch } = useAuditLogs({
    childId: selectedChild,
    action: selectedAction,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate + "T23:59:59") : null,
  });

  const clearFilters = () => {
    setSelectedChild(null);
    setSelectedAction(null);
    setStartDate("");
    setEndDate("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" message="Loading audit logs..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={refetch} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-4 h-4" />
              Filters
              {showFilters ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          {(selectedChild || selectedAction || startDate || endDate) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>

        <CollapsibleContent className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label>Child</Label>
              <Select
                value={selectedChild || "all"}
                onValueChange={(v) => setSelectedChild(v === "all" ? null : v)}
              >
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={selectedAction || "all"}
                onValueChange={(v) => setSelectedAction(v === "all" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="CHILD_VIEW">Viewed Child</SelectItem>
                  <SelectItem value="CHILD_INSERT">Created Child</SelectItem>
                  <SelectItem value="CHILD_UPDATE">Updated Child</SelectItem>
                  <SelectItem value="CHILD_DELETE">Deleted Child</SelectItem>
                  <SelectItem value="ACTIVITY_EVENT_VIEW">Viewed Activity</SelectItem>
                  <SelectItem value="ACTIVITY_EVENT_INSERT">Created Activity Event</SelectItem>
                  <SelectItem value="ACTIVITY_EVENT_UPDATE">Updated Activity Event</SelectItem>
                  <SelectItem value="ACTIVITY_EVENT_DELETE">Deleted Activity Event</SelectItem>
                  <SelectItem value="CALENDAR_EVENT_VIEW">Viewed Calendar Event</SelectItem>
                  <SelectItem value="CALENDAR_EVENT_INSERT">Created Calendar Event</SelectItem>
                  <SelectItem value="CALENDAR_EVENT_UPDATE">Updated Calendar Event</SelectItem>
                  <SelectItem value="CALENDAR_EVENT_DELETE">Deleted Calendar Event</SelectItem>
                  <SelectItem value="MESSAGE_VIEW">Viewed Message</SelectItem>
                  <SelectItem value="MESSAGE_INSERT">Sent Message</SelectItem>
                  <SelectItem value="MESSAGE_UPDATE">Edited Message</SelectItem>
                  <SelectItem value="MESSAGE_DELETE">Deleted Message</SelectItem>
                  <SelectItem value="DOCUMENT_VIEW">Viewed Document</SelectItem>
                  <SelectItem value="DOCUMENT_INSERT">Uploaded Document</SelectItem>
                  <SelectItem value="DOCUMENT_UPDATE">Updated Document</SelectItem>
                  <SelectItem value="DOCUMENT_DELETE">Deleted Document</SelectItem>
                  <SelectItem value="EXPENSE_VIEW">Viewed Expense</SelectItem>
                  <SelectItem value="EXPENSE_INSERT">Created Expense</SelectItem>
                  <SelectItem value="EXPENSE_UPDATE">Updated Expense</SelectItem>
                  <SelectItem value="EXPENSE_DELETE">Deleted Expense</SelectItem>
                  <SelectItem value="GIFT_LIST_VIEW">Viewed Gift List</SelectItem>
                  <SelectItem value="GIFT_LIST_INSERT">Created Gift List</SelectItem>
                  <SelectItem value="GIFT_LIST_UPDATE">Updated Gift List</SelectItem>
                  <SelectItem value="GIFT_LIST_DELETE">Deleted Gift List</SelectItem>
                  <SelectItem value="GIFT_ITEM_VIEW">Viewed Gift Item</SelectItem>
                  <SelectItem value="GIFT_ITEM_INSERT">Added Gift Item</SelectItem>
                  <SelectItem value="GIFT_ITEM_UPDATE">Updated Gift Item</SelectItem>
                  <SelectItem value="GIFT_ITEM_DELETE">Removed Gift Item</SelectItem>
                  <SelectItem value="CHORE_VIEW">Viewed Chore</SelectItem>
                  <SelectItem value="CHORE_INSERT">Created Chore</SelectItem>
                  <SelectItem value="CHORE_UPDATE">Updated Chore</SelectItem>
                  <SelectItem value="CHORE_DELETE">Deleted Chore</SelectItem>
                  <SelectItem value="CHORE_COMPLETE">Completed Chore</SelectItem>
                  <SelectItem value="PERMISSION_VIEW">Viewed Permissions</SelectItem>
                  <SelectItem value="PERMISSION_UPDATE">Updated Permissions</SelectItem>
                  <SelectItem value="PROFILE_VIEW">Viewed Profile</SelectItem>
                  <SelectItem value="PROFILE_UPDATE">Updated Profile</SelectItem>
                  <SelectItem value="FAMILY_MEMBER_VIEW">Viewed Family Member</SelectItem>
                  <SelectItem value="FAMILY_MEMBER_INSERT">Added Family Member</SelectItem>
                  <SelectItem value="FAMILY_MEMBER_UPDATE">Updated Family Member</SelectItem>
                  <SelectItem value="FAMILY_MEMBER_DELETE">Removed Family Member</SelectItem>
                  <SelectItem value="NOTIFICATION_VIEW">Viewed Notification</SelectItem>
                  <SelectItem value="NOTIFICATION_SEND">Sent Notification</SelectItem>
                  <SelectItem value="DATA_EXPORT">Exported Data</SelectItem>
                  <SelectItem value="ADMIN_CLEANUP">Admin Cleanup</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Table */}
      {logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No audit logs found</p>
          <p className="text-sm mt-1">
            Activity will appear here when child records are viewed or modified.
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp (UTC)</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Child</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm font-mono">
                    {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{resolvePersonName(log.actor_name, log.actor_email)}</p>
                      {log.actor_email && (
                        <p className="text-xs text-muted-foreground">
                          {log.actor_email}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleVariant(log.actor_role_at_action)} className="text-xs">
                      {getRoleLabel(log.actor_role_at_action)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getActionVariant(log.action)}
                      className="gap-1"
                    >
                      {getActionIcon(log.action)}
                      {getActionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell>{resolveChildName(log.child_name)}</TableCell>
                  <TableCell>
                    {(log.before || log.after) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedLog(
                            expandedLog === log.id ? null : log.id
                          )
                        }
                      >
                        {expandedLog === log.id ? "Hide" : "Show"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
};
