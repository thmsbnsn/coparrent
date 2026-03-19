import { useState } from "react";
import { Gift, Link, Plus } from "lucide-react";
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
import { GIFT_CATEGORIES } from "@/hooks/useGiftLists";

interface AddGiftItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isParent: boolean;
  onSubmit: (data: {
    title: string;
    category?: string;
    suggested_age_range?: string;
    notes?: string;
    parent_only_notes?: string;
    link?: string;
  }) => Promise<GiftItem | null>;
}

export const AddGiftItemDialog = ({
  open,
  onOpenChange,
  isParent,
  onSubmit,
}: AddGiftItemDialogProps) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [ageRange, setAgeRange] = useState("");
  const [notes, setNotes] = useState("");
  const [parentNotes, setParentNotes] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setLoading(true);
    const result = await onSubmit({
      title: title.trim(),
      category,
      suggested_age_range: ageRange || undefined,
      notes: notes || undefined,
      parent_only_notes: parentNotes || undefined,
      link: link || undefined,
    });

    if (result) {
      onOpenChange(false);
      resetForm();
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setCategory("other");
    setAgeRange("");
    setNotes("");
    setParentNotes("");
    setLink("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Add Gift Idea
          </DialogTitle>
          <DialogDescription>
            Add a gift to this list for coordination.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Gift Name *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., LEGO Star Wars Set"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GIFT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="age-range">Age Range</Label>
              <Input
                id="age-range"
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
                placeholder="e.g., 8-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Size, color preferences, etc."
              rows={2}
            />
          </div>

          {isParent && (
            <div className="space-y-2">
              <Label htmlFor="parent-notes" className="flex items-center gap-2">
                🔒 Parent-Only Notes
              </Label>
              <Textarea
                id="parent-notes"
                value={parentNotes}
                onChange={(e) => setParentNotes(e.target.value)}
                placeholder="Private notes only visible to parents"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                These notes are only visible to parents/guardians
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="link" className="flex items-center gap-2">
              <Link className="w-4 h-4" />
              Link (optional)
            </Label>
            <Input
              id="link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Gift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
