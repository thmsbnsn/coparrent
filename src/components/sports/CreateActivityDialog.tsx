import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  CreateActivityInput, 
  EquipmentItem, 
  SPORT_TYPES 
} from "@/hooks/useSportsActivities";
import type { Child } from "@/hooks/useChildren";

const activitySchema = z.object({
  child_id: z.string().min(1, "Please select a child"),
  name: z.string().min(1, "Activity name is required").max(100),
  sport_type: z.string().min(1, "Please select a sport type"),
  team_name: z.string().max(100).optional(),
  coach_name: z.string().max(100).optional(),
  coach_phone: z.string().max(20).optional(),
  coach_email: z.string().email().optional().or(z.literal("")),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: Child[];
  onSubmit: (data: CreateActivityInput) => Promise<boolean>;
}

export const CreateActivityDialog = ({
  open,
  onOpenChange,
  children,
  onSubmit,
}: CreateActivityDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [newEquipment, setNewEquipment] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      child_id: "",
      name: "",
      sport_type: "",
      team_name: "",
      coach_name: "",
      coach_phone: "",
      coach_email: "",
      season_start: "",
      season_end: "",
      notes: "",
    },
  });

  const selectedChildId = watch("child_id");
  const selectedSport = watch("sport_type");

  const addEquipment = () => {
    if (newEquipment.trim()) {
      setEquipment([
        ...equipment,
        { id: crypto.randomUUID(), name: newEquipment.trim(), required: false },
      ]);
      setNewEquipment("");
    }
  };

  const removeEquipment = (id: string) => {
    setEquipment(equipment.filter((e) => e.id !== id));
  };

  const toggleRequired = (id: string) => {
    setEquipment(
      equipment.map((e) =>
        e.id === id ? { ...e, required: !e.required } : e
      )
    );
  };

  const handleFormSubmit = async (data: ActivityFormData) => {
    setIsSubmitting(true);
    const success = await onSubmit({
      child_id: data.child_id,
      name: data.name,
      sport_type: data.sport_type,
      team_name: data.team_name,
      coach_name: data.coach_name,
      coach_phone: data.coach_phone,
      coach_email: data.coach_email,
      season_start: data.season_start,
      season_end: data.season_end,
      notes: data.notes,
      equipment_checklist: equipment,
    });
    setIsSubmitting(false);

    if (success) {
      reset();
      setEquipment([]);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    reset();
    setEquipment([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Activity</DialogTitle>
          <DialogDescription>
            Add a sport or activity for your child
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="child_id">Child *</Label>
              <Select
                value={selectedChildId}
                onValueChange={(value) => setValue("child_id", value)}
              >
                <SelectTrigger className={errors.child_id ? "border-destructive" : ""}>
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
              {errors.child_id && (
                <p className="text-xs text-destructive">{errors.child_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sport_type">Sport/Activity Type *</Label>
              <Select
                value={selectedSport}
                onValueChange={(value) => setValue("sport_type", value)}
              >
                <SelectTrigger className={errors.sport_type ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {SPORT_TYPES.map((sport) => (
                    <SelectItem key={sport.value} value={sport.value}>
                      {sport.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sport_type && (
                <p className="text-xs text-destructive">{errors.sport_type.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Activity Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Spring Soccer League"
              {...register("name")}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="team_name">Team Name</Label>
            <Input
              id="team_name"
              placeholder="e.g., Thunder FC"
              {...register("team_name")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="season_start">Season Start</Label>
              <Input type="date" id="season_start" {...register("season_start")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="season_end">Season End</Label>
              <Input type="date" id="season_end" {...register("season_end")} />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Coach Information</h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="coach_name">Coach Name</Label>
                <Input
                  id="coach_name"
                  placeholder="Coach's name"
                  {...register("coach_name")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coach_phone">Phone</Label>
                  <Input
                    id="coach_phone"
                    placeholder="(555) 123-4567"
                    {...register("coach_phone")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coach_email">Email</Label>
                  <Input
                    id="coach_email"
                    type="email"
                    placeholder="coach@email.com"
                    {...register("coach_email")}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Equipment Checklist</h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add equipment item..."
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEquipment();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addEquipment}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {equipment.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {equipment.map((item) => (
                    <Badge
                      key={item.id}
                      variant={item.required ? "default" : "secondary"}
                      className="gap-1 pr-1"
                    >
                      <span className="cursor-pointer" onClick={() => toggleRequired(item.id)}>
                        {item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEquipment(item.id)}
                        className="ml-1 hover:bg-background/20 rounded p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Click on an item to mark it as required. Required items are highlighted.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional information..."
              {...register("notes")}
              className="resize-none"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
