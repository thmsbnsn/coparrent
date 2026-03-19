/**
 * ChoreChartPage - Multi-household chore chart management
 * 
 * Features:
 * - Database-backed with RLS
 * - Household separation (parent_a / parent_b)
 * - Age-based UX for children
 * - PDF/Print export with CoParrent Creations branding
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Printer, Plus, Home, Users } from "lucide-react";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { RoleGate } from "@/components/gates/RoleGate";
import { useToast } from "@/hooks/use-toast";
import { useChildren } from "@/hooks/useChildren";
import { useChoreCharts, getAgeGroup, type ChoreItem, type Household } from "@/hooks/useChoreCharts";
import { HouseholdToggle } from "@/components/chores/HouseholdToggle";
import { ChoreListEditor } from "@/components/chores/ChoreListEditor";
import { ChoreChartView } from "@/components/chores/ChoreChartView";
import { generateChoreChartPDF, openChoreChartPrint } from "@/components/chores/ChoreChartExport";

type ChoreListEditorData = {
  householdLabel: string;
  colorScheme: string;
  allowChildCompletion: boolean;
  requireParentConfirm: boolean;
  chores: Array<
    Pick<
      ChoreItem,
      "title" | "description" | "completion_style" | "days_active" | "assigned_child_ids"
    >
  >;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Please try again.";

const ChoreChartContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { children } = useChildren();
  
  const {
    choreLists,
    choreListsLoading,
    myActiveChoreList,
    otherParentChoreList,
    createChoreList,
    updateChoreList,
    isCreatingList,
    useChoresForList,
    addChore,
    deleteChore,
    useCompletions,
    toggleCompletion,
    selectedHousehold,
    setSelectedHousehold,
    isParent,
    profileId,
  } = useChoreCharts();

  const [isEditing, setIsEditing] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Get chores for active lists
  const { data: myChores = [] } = useChoresForList(myActiveChoreList?.id || null);
  const { data: otherChores = [] } = useChoresForList(otherParentChoreList?.id || null);

  // Get completions for the week
  const weekEnd = addWeeks(weekStart, 1);
  const { data: myCompletions = [] } = useCompletions(myActiveChoreList?.id || null, weekStart, weekEnd);
  const { data: otherCompletions = [] } = useCompletions(otherParentChoreList?.id || null, weekStart, weekEnd);

  // Auto-select first child if none selected
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const ageGroup = getAgeGroup(selectedChild?.date_of_birth || null);

  // Determine which list to show based on filter
  const showMyList = selectedHousehold === "all" || selectedHousehold === (myActiveChoreList?.household || "parent_a");
  const showOtherList = selectedHousehold === "all" || selectedHousehold === (otherParentChoreList?.household || "parent_b");

  const handleCreateList = async (data: ChoreListEditorData) => {
    try {
      const newList = await createChoreList({
        household: "parent_a", // Will be determined by system
        household_label: data.householdLabel,
        color_scheme: data.colorScheme,
        allow_child_completion: data.allowChildCompletion,
        require_parent_confirm: data.requireParentConfirm,
      });

      // Add chores
      for (const chore of data.chores) {
        await addChore({
          chore_list_id: newList.id,
          title: chore.title,
          description: chore.description,
          completion_style: chore.completion_style,
          days_active: chore.days_active,
          assigned_child_ids: chore.assigned_child_ids,
        });
      }

      setIsEditing(false);
      toast({ title: "Chore chart created!" });
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleToggleCompletion = async (choreId: string, childId: string, date: Date, isComplete: boolean) => {
    try {
      await toggleCompletion({
        choreId,
        childId,
        date,
        isComplete,
        role: isParent ? "parent" : "child",
      });
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleExportPDF = () => {
    const list = myActiveChoreList || otherParentChoreList;
    const chores = myActiveChoreList ? myChores : otherChores;
    if (!list) return;

    generateChoreChartPDF({
      choreList: list,
      chores,
      children,
      selectedChildId,
      weekStart,
    });
    toast({ title: "Downloaded!", description: "Chore chart PDF saved." });
  };

  const handlePrint = () => {
    const list = myActiveChoreList || otherParentChoreList;
    const chores = myActiveChoreList ? myChores : otherChores;
    if (!list) return;

    const success = openChoreChartPrint({
      choreList: list,
      chores,
      children,
      selectedChildId,
      weekStart,
    });
    if (!success) {
      toast({ title: "Popup blocked", description: "Please allow popups to print.", variant: "destructive" });
    }
  };

  // Show editor if editing or no active list exists
  if (isEditing || (!myActiveChoreList && isParent)) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-3 p-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">
            {myActiveChoreList ? "Edit Chore Chart" : "Create Chore Chart"}
          </h1>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <ChoreListEditor
              choreList={myActiveChoreList}
              existingChores={myChores}
              children={children}
              onSave={handleCreateList}
              onCancel={() => setIsEditing(false)}
              isSaving={isCreatingList}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/kids-hub")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Home className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Chore Charts</h1>
              <p className="text-xs text-muted-foreground">Track chores across households</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF} className="gap-2" disabled={!myActiveChoreList && !otherParentChoreList}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2" disabled={!myActiveChoreList && !otherParentChoreList}>
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          {isParent && (
            <Button onClick={() => setIsEditing(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{myActiveChoreList ? "Edit" : "Create"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b bg-muted/30">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-4 items-center">
          {/* Child selector */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedChildId || ""} onValueChange={setSelectedChildId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Household toggle */}
          {(myActiveChoreList || otherParentChoreList) && (
            <HouseholdToggle
              value={selectedHousehold}
              onChange={setSelectedHousehold}
              parentALabel={myActiveChoreList?.household_label || "My House"}
              parentBLabel={otherParentChoreList?.household_label || "Other House"}
              showAllOption
              className="flex-1 max-w-md"
            />
          )}

          {/* Week navigation */}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
              ←
            </Button>
            <span className="text-sm font-medium min-w-32 text-center">
              {format(weekStart, "MMM d")} - {format(addWeeks(weekStart, 1), "MMM d")}
            </span>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
              →
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* No charts message */}
          {!myActiveChoreList && !otherParentChoreList && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No chore charts yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create a chore chart for your household to help kids build responsibility.
                </p>
                {isParent && (
                  <Button onClick={() => setIsEditing(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Chore Chart
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* My chore chart */}
          {myActiveChoreList && showMyList && (
            <ChoreChartView
              choreList={myActiveChoreList}
              chores={myChores}
              completions={myCompletions}
              children={children}
              selectedChildId={selectedChildId}
              ageGroup={ageGroup}
              weekStart={weekStart}
              isOwner={true}
              onToggleCompletion={handleToggleCompletion}
              onEdit={() => setIsEditing(true)}
            />
          )}

          {/* Other parent's chore chart (view only) */}
          {otherParentChoreList && showOtherList && (
            <ChoreChartView
              choreList={otherParentChoreList}
              chores={otherChores}
              completions={otherCompletions}
              children={children}
              selectedChildId={selectedChildId}
              ageGroup={ageGroup}
              weekStart={weekStart}
              isOwner={false}
              onToggleCompletion={handleToggleCompletion}
              readOnly={otherParentChoreList.created_by_parent_id !== profileId}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const ChoreChartPage = () => {
  return (
    <DashboardLayout>
      <RoleGate requireParent restrictedMessage="Chore Chart is only available to parents and guardians.">
        <PremiumFeatureGate featureName="Chore Chart">
          <ChoreChartContent />
        </PremiumFeatureGate>
      </RoleGate>
    </DashboardLayout>
  );
};

export default ChoreChartPage;
