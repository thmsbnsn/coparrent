import { useState, useEffect } from "react";
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
import { 
  CreateEventInput, 
  ChildActivity, 
  ActivityEvent,
  EquipmentItem, 
  EVENT_TYPES 
} from "@/hooks/useSportsActivities";

const eventSchema = z.object({
  activity_id: z.string().min(1, "Please select an activity"),
  event_type: z.string().min(1, "Please select an event type"),
  title: z.string().min(1, "Event title is required").max(100),
  event_date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().optional(),
  location_name: z.string().max(100).optional(),
  location_address: z.string().max(200).optional(),
  venue_notes: z.string().max(300).optional(),
  dropoff_parent_id: z.string().optional(),
  pickup_parent_id: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ActivityEvent | null;
  activities: ChildActivity[];
  parentProfiles: { id: string; full_name: string }[];
  onSubmit: (eventId: string, data: Partial<CreateEventInput>) => Promise<boolean>;
}

export const EditEventDialog = ({
  open,
  onOpenChange,
  event,
  activities,
  parentProfiles,
  onSubmit,
}: EditEventDialogProps) => {
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
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });

  // Populate form when event changes
  useEffect(() => {
    if (event && open) {
      setValue("activity_id", event.activity_id);
      setValue("event_type", event.event_type);
      setValue("title", event.title);
      setValue("event_date", event.event_date);
      setValue("start_time", event.start_time);
      setValue("end_time", event.end_time || "");
      setValue("location_name", event.location_name || "");
      setValue("location_address", event.location_address || "");
      setValue("venue_notes", event.venue_notes || "");
      setValue("dropoff_parent_id", event.dropoff_parent_id || "");
      setValue("pickup_parent_id", event.pickup_parent_id || "");
      setValue("notes", event.notes || "");
      setEquipment(event.equipment_needed || []);
    }
  }, [event, open, setValue]);

  const selectedActivityId = watch("activity_id");
  const selectedEventType = watch("event_type");

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

  const handleFormSubmit = async (data: EventFormData) => {
    if (!event) return;
    
    setIsSubmitting(true);
    const success = await onSubmit(event.id, {
      activity_id: data.activity_id,
      event_type: data.event_type as CreateEventInput["event_type"],
      title: data.title,
      event_date: data.event_date,
      start_time: data.start_time,
      end_time: data.end_time || undefined,
      location_name: data.location_name || undefined,
      location_address: data.location_address || undefined,
      venue_notes: data.venue_notes || undefined,
      dropoff_parent_id: data.dropoff_parent_id || undefined,
      pickup_parent_id: data.pickup_parent_id || undefined,
      notes: data.notes || undefined,
      equipment_needed: equipment,
    });
    setIsSubmitting(false);

    if (success) {
      handleClose();
    }
  };

  const handleClose = () => {
    reset();
    setEquipment([]);
    setNewEquipment("");
    onOpenChange(false);
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            Update event details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="activity_id">Activity *</Label>
              <Select
                value={selectedActivityId}
                onValueChange={(value) => setValue("activity_id", value)}
              >
                <SelectTrigger className={errors.activity_id ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select activity" />
                </SelectTrigger>
                <SelectContent>
                  {activities.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      {activity.name} ({activity.child_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_type">Event Type *</Label>
              <Select
                value={selectedEventType}
                onValueChange={(value) => setValue("event_type", value)}
              >
                <SelectTrigger className={errors.event_type ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Game vs. Eagles"
              {...register("title")}
              className={errors.title ? "border-destructive" : ""}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_date">Date *</Label>
              <Input 
                type="date" 
                id="event_date" 
                {...register("event_date")} 
                className={errors.event_date ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time *</Label>
              <Input 
                type="time" 
                id="start_time" 
                {...register("start_time")}
                className={errors.start_time ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Input type="time" id="end_time" {...register("end_time")} />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Location</h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="location_name">Venue Name</Label>
                <Input
                  id="location_name"
                  placeholder="e.g., Memorial Park Field 3"
                  {...register("location_name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location_address">Address</Label>
                <Input
                  id="location_address"
                  placeholder="123 Main St, City, State ZIP"
                  {...register("location_address")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue_notes">Venue Notes</Label>
                <Textarea
                  id="venue_notes"
                  placeholder="Parking info, field number, entrance tips..."
                  {...register("venue_notes")}
                  className="resize-none"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Parent Responsibilities</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dropoff_parent_id">Drop-off By</Label>
                <Select
                  value={watch("dropoff_parent_id") || ""}
                  onValueChange={(value) => setValue("dropoff_parent_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not assigned</SelectItem>
                    {parentProfiles.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickup_parent_id">Pick-up By</Label>
                <Select
                  value={watch("pickup_parent_id") || ""}
                  onValueChange={(value) => setValue("pickup_parent_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not assigned</SelectItem>
                    {parentProfiles.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Equipment Needed</h4>
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
                    <Badge key={item.id} variant="secondary" className="gap-1 pr-1">
                      {item.name}
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
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional information..."
              {...register("notes")}
              className="resize-none"
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
