import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gift, Calendar, Edit } from "lucide-react";
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
import { OCCASION_TYPES, GiftList } from "@/hooks/useGiftLists";

interface Child {
  id: string;
  name: string;
}

interface EditGiftListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: GiftList | null;
  children: Child[];
  onSubmit: (listId: string, updates: Partial<GiftList>) => Promise<boolean>;
}

export const EditGiftListDialog = ({
  open,
  onOpenChange,
  list,
  children,
  onSubmit,
}: EditGiftListDialogProps) => {
  const [childId, setChildId] = useState("");
  const [occasionType, setOccasionType] = useState("birthday");
  const [customName, setCustomName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [loading, setLoading] = useState(false);

  // Populate form when list changes
  useEffect(() => {
    if (list) {
      setChildId(list.child_id);
      setOccasionType(list.occasion_type);
      setCustomName(list.custom_occasion_name || "");
      setEventDate(list.event_date || "");
      setAllowMultiple(list.allow_multiple_claims);
    }
  }, [list]);

  const handleSubmit = async () => {
    if (!list || !childId || !occasionType) return;
    if (occasionType === "custom" && !customName.trim()) return;

    setLoading(true);
    const updates: Partial<GiftList> = {
      child_id: childId,
      occasion_type: occasionType,
      custom_occasion_name: occasionType === "custom" ? customName : null,
      event_date: eventDate || null,
      allow_multiple_claims: allowMultiple,
    };

    const result = await onSubmit(list.id, updates);

    if (result) {
      onOpenChange(false);
    }
    setLoading(false);
  };

  if (!list) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-primary" />
            Edit Gift List
          </DialogTitle>
          <DialogDescription>
            Update the gift list details.
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

          <div className="flex items-center space-x-2">
            <Switch
              id="allow-multiple"
              checked={allowMultiple}
              onCheckedChange={setAllowMultiple}
            />
            <Label htmlFor="allow-multiple">Allow multiple claims per gift</Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};