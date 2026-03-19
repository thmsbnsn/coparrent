import { addDays, format, isSameDay } from "date-fns";
import { CheckCircle2, Circle, Pencil } from "lucide-react";
import { Child } from "@/hooks/useChildren";
import type { AgeGroup, ChoreCompletion, ChoreItem, ChoreList } from "@/hooks/useChoreCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ChoreChartViewProps {
  choreList: ChoreList;
  chores: ChoreItem[];
  completions: ChoreCompletion[];
  children: Child[];
  selectedChildId: string | null;
  ageGroup: AgeGroup;
  weekStart: Date;
  isOwner: boolean;
  readOnly?: boolean;
  onToggleCompletion: (choreId: string, childId: string, date: Date, isComplete: boolean) => Promise<void> | void;
  onEdit?: () => void;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const ChoreChartView = ({
  choreList,
  chores,
  completions,
  children,
  selectedChildId,
  ageGroup,
  weekStart,
  isOwner,
  readOnly = false,
  onToggleCompletion,
  onEdit,
}: ChoreChartViewProps) => {
  const selectedChild = children.find((child) => child.id === selectedChildId) || null;
  const filteredChores = selectedChildId
    ? chores.filter(
        (chore) =>
          chore.assigned_child_ids.length === 0 ||
          chore.assigned_child_ids.includes(selectedChildId)
      )
    : chores;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{choreList.household_label}</CardTitle>
          <CardDescription>
            {selectedChild
              ? `Weekly chores for ${selectedChild.name} (${ageGroup})`
              : "Select a child to filter the chart."}
          </CardDescription>
        </div>
        {isOwner && onEdit && !readOnly && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit chart
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredChores.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="font-medium">No chores assigned yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add chores or change the child filter to populate this week.
            </p>
          </div>
        ) : (
          filteredChores.map((chore) => (
            <div key={chore.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{chore.title}</p>
                  {chore.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{chore.description}</p>
                  )}
                  {chore.assigned_child_ids.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {children
                        .filter((child) => chore.assigned_child_ids.includes(child.id))
                        .map((child) => (
                          <Badge key={child.id} variant="outline">
                            {child.name}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
                {readOnly && <Badge variant="secondary">View only</Badge>}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {DAY_KEYS.map((dayKey, index) => {
                  const dayDate = addDays(weekStart, index);
                  const completion = completions.find(
                    (item) =>
                      item.chore_id === chore.id &&
                      item.child_id === selectedChildId &&
                      isSameDay(new Date(item.date), dayDate)
                  );
                  const active = chore.days_active.includes(dayKey);
                  const isComplete = completion?.completed === true;

                  return (
                    <button
                      key={`${chore.id}-${dayKey}`}
                      type="button"
                      disabled={!active || !selectedChildId || readOnly}
                      className="rounded-lg border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() =>
                        selectedChildId &&
                        onToggleCompletion(chore.id, selectedChildId, dayDate, !isComplete)
                      }
                    >
                      <div className="text-xs font-medium text-muted-foreground">
                        {DAY_LABELS[index]}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(dayDate, "MMM d")}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>
                          {!active
                            ? "Off"
                            : isComplete
                              ? "Done"
                              : selectedChildId
                                ? "Open"
                                : "Choose child"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
