import { useState } from "react";
import { motion } from "framer-motion";
import { Gift, Calendar, Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OCCASION_TYPES } from "@/hooks/useGiftLists";

interface Child {
  id: string;
  name: string;
}

interface CreateGiftListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: Child[];
  onSubmit: (data: {
    child_id: string;
    occasion_type: string;
    custom_occasion_name?: string;
    event_date?: string;
    allow_multiple_claims?: boolean;
  }) => Promise<GiftList | null>;
}

export const CreateGiftListDialog = ({
  open,
  onOpenChange,
  children,
  onSubmit,
}: CreateGiftListDialogProps) => {
  const [childId, setChildId] = useState("");
  const [occasionType, setOccasionType] = useState("birthday");
  const [customName, setCustomName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!childId || !occasionType) return;
    if (occasionType === "custom" && !customName.trim()) return;

    setLoading(true);
    const result = await onSubmit({
      child_id: childId,
      occasion_type: occasionType,
      custom_occasion_name: occasionType === "custom" ? customName : undefined,
      event_date: eventDate || undefined,
      allow_multiple_claims: allowMultiple,
    });

    if (result) {
      onOpenChange(false);
      resetForm();
    }
    setLoading(false);
  };

  const resetForm = () => {
    setChildId("");
    setOccasionType("birthday");
    setCustomName("");
    setEventDate("");
    setAllowMultiple(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Create Gift List
          </DialogTitle>
          <DialogDescription>
            Create a gift list for a child to coordinate presents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="child">Child</Label>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a child" />
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

          <div className="space-y-2">
            <Label htmlFor="occasion">Occasion</Label>
            <Select value={occasionType} onValueChange={setOccasionType}>
              <SelectTrigger>
                <SelectValue placeholder="Select occasion" />
              </SelectTrigger>
              <SelectContent>
                {OCCASION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {occasionType === "custom" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-2"
            >
              <Label htmlFor="custom-name">Custom Occasion Name</Label>
              <Input
                id="custom-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Graduation"
              />
            </motion.div>
          )}

          <div className="space-y-2">
            <Label htmlFor="event-date" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Event Date (optional)
            </Label>
            <Input
              id="event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="multiple-claims">Allow Multiple Claims</Label>
              <p className="text-xs text-muted-foreground">
                Let multiple people claim the same gift
              </p>
            </div>
            <Switch
              id="multiple-claims"
              checked={allowMultiple}
              onCheckedChange={setAllowMultiple}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !childId || (occasionType === "custom" && !customName.trim())}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
