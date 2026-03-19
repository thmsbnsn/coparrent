import { useState, useEffect } from "react";
import { Gift, Link, Edit } from "lucide-react";
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
import { GIFT_CATEGORIES, GiftItem } from "@/hooks/useGiftLists";

interface EditGiftItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: GiftItem | null;
  isParent: boolean;
  onSubmit: (itemId: string, updates: Partial<GiftItem>) => Promise<boolean>;
}

export const EditGiftItemDialog = ({
  open,
  onOpenChange,
  item,
  isParent,
  onSubmit,
}: EditGiftItemDialogProps) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [ageRange, setAgeRange] = useState("");
  const [notes, setNotes] = useState("");
  const [parentNotes, setParentNotes] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  // Populate form when item changes
  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setCategory(item.category);
      setAgeRange(item.suggested_age_range || "");
      setNotes(item.notes || "");
      setParentNotes(item.parent_only_notes || "");
      setLink(item.link || "");
    }
  }, [item]);

  const handleSubmit = async () => {
    if (!item || !title.trim()) return;

    setLoading(true);
    const updates: Partial<GiftItem> = {
      title: title.trim(),
      category,
      suggested_age_range: ageRange || null,
      notes: notes || null,
      parent_only_notes: parentNotes || null,
      link: link || null,
    };

    const result = await onSubmit(item.id, updates);

    if (result) {
      onOpenChange(false);
    }
    setLoading(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-primary" />
            Edit Gift Idea
          </DialogTitle>
          <DialogDescription>
            Update the gift details.
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
                placeholder="Private notes for parents only"
                rows={2}
              />
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