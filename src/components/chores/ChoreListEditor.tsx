import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Child } from "@/hooks/useChildren";
import type { ChoreItem, ChoreList, CompletionStyle, Weekday } from "@/hooks/useChoreCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface DraftChore {
  title: string;
  description: string;
  completion_style: CompletionStyle;
  days_active: Weekday[];
  assigned_child_ids: string[];
}

interface ChoreListEditorProps {
  choreList?: ChoreList | null;
  existingChores?: ChoreItem[];
  children: Child[];
  onSave: (data: {
    householdLabel: string;
    colorScheme: string;
    allowChildCompletion: boolean;
    requireParentConfirm: boolean;
    chores: DraftChore[];
  }) => Promise<void> | void;
  onCancel: () => void;
  isSaving?: boolean;
}

const WEEKDAYS: Array<{ value: Weekday; label: string }> = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

const emptyDraft = (): DraftChore => ({
  title: "",
  description: "",
  completion_style: "check",
  days_active: ["mon", "tue", "wed", "thu", "fri"],
  assigned_child_ids: [],
});

export const ChoreListEditor = ({
  choreList,
  existingChores = [],
  children,
  onSave,
  onCancel,
  isSaving = false,
}: ChoreListEditorProps) => {
  const [householdLabel, setHouseholdLabel] = useState(choreList?.household_label || "My House");
  const [colorScheme, setColorScheme] = useState(choreList?.color_scheme || "sky");
  const [allowChildCompletion, setAllowChildCompletion] = useState(
    choreList?.allow_child_completion ?? true
  );
  const [requireParentConfirm, setRequireParentConfirm] = useState(
    choreList?.require_parent_confirm ?? false
  );
  const [chores, setChores] = useState<DraftChore[]>(
    existingChores.length > 0
      ? existingChores.map((chore) => ({
          title: chore.title,
          description: chore.description,
          completion_style: chore.completion_style,
          days_active: chore.days_active,
          assigned_child_ids: chore.assigned_child_ids,
        }))
      : [emptyDraft()]
  );

  useEffect(() => {
    if (existingChores.length > 0) {
      setChores(
        existingChores.map((chore) => ({
          title: chore.title,
          description: chore.description,
          completion_style: chore.completion_style,
          days_active: chore.days_active,
          assigned_child_ids: chore.assigned_child_ids,
        }))
      );
    }
  }, [existingChores]);

  const updateChore = (index: number, updates: Partial<DraftChore>) => {
    setChores((current) =>
      current.map((chore, itemIndex) =>
        itemIndex === index ? { ...chore, ...updates } : chore
      )
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Chart settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="household-label">Household label</Label>
              <Input
                id="household-label"
                value={householdLabel}
                onChange={(event) => setHouseholdLabel(event.target.value)}
                placeholder="My House"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color-scheme">Color theme</Label>
              <Input
                id="color-scheme"
                value={colorScheme}
                onChange={(event) => setColorScheme(event.target.value)}
                placeholder="sky"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Allow child completion</p>
                <p className="text-xs text-muted-foreground">
                  Children can mark chores complete themselves.
                </p>
              </div>
              <Switch checked={allowChildCompletion} onCheckedChange={setAllowChildCompletion} />
            </label>
            <label className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Require parent confirmation</p>
                <p className="text-xs text-muted-foreground">
                  Parents confirm chores before they count.
                </p>
              </div>
              <Switch checked={requireParentConfirm} onCheckedChange={setRequireParentConfirm} />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Chores</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setChores((current) => [...current, emptyDraft()])}>
            <Plus className="mr-2 h-4 w-4" />
            Add chore
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {chores.map((chore, index) => (
            <div key={index} className="rounded-xl border p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={chore.title}
                    onChange={(event) => updateChore(index, { title: event.target.value })}
                    placeholder="Unload dishwasher"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setChores((current) =>
                      current.length === 1 ? [emptyDraft()] : current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={chore.description}
                  onChange={(event) => updateChore(index, { description: event.target.value })}
                  rows={3}
                  placeholder="Clear dishes, wipe counter, and start dishwasher."
                />
              </div>

              <div className="space-y-2">
                <Label>Active days</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const active = chore.days_active.includes(day.value);
                    return (
                      <Button
                        key={day.value}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() =>
                          updateChore(index, {
                            days_active: active
                              ? chore.days_active.filter((value) => value !== day.value)
                              : [...chore.days_active, day.value],
                          })
                        }
                      >
                        {day.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assigned children</Label>
                <div className="flex flex-wrap gap-2">
                  {children.map((child) => {
                    const selected = chore.assigned_child_ids.includes(child.id);
                    return (
                      <button
                        key={child.id}
                        type="button"
                        className="focus:outline-none"
                        onClick={() =>
                          updateChore(index, {
                            assigned_child_ids: selected
                              ? chore.assigned_child_ids.filter((id) => id !== child.id)
                              : [...chore.assigned_child_ids, child.id],
                          })
                        }
                      >
                        <Badge variant={selected ? "default" : "outline"}>{child.name}</Badge>
                      </button>
                    );
                  })}
                  {children.length === 0 && (
                    <p className="text-sm text-muted-foreground">Add a child first to assign chores.</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={() =>
                onSave({
                  householdLabel: householdLabel.trim() || "My House",
                  colorScheme: colorScheme.trim() || "sky",
                  allowChildCompletion,
                  requireParentConfirm,
                  chores: chores.filter((chore) => chore.title.trim()),
                })
              }
            >
              {isSaving ? "Saving..." : "Save chart"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
