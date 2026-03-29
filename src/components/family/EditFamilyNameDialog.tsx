import { useEffect, useState } from "react";
import { Loader2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UpdateFamilyNameResult {
  success?: boolean;
  error?: string;
  family_id?: string | null;
  display_name?: string | null;
}

interface EditFamilyNameDialogProps {
  familyId: string;
  familyLabel: string;
  currentName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
}

const MAX_FAMILY_NAME_LENGTH = 80;

export const EditFamilyNameDialog = ({
  familyId,
  familyLabel,
  currentName,
  open,
  onOpenChange,
  onSaved,
}: EditFamilyNameDialogProps) => {
  const { toast } = useToast();
  const [name, setName] = useState(currentName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentName ?? "");
      setError(null);
    }
  }, [currentName, open]);

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Enter a family label before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("rpc_update_family_display_name", {
        p_family_id: familyId,
        p_display_name: trimmedName,
      });

      if (rpcError) {
        throw rpcError;
      }

      const result = (data ?? {}) as UpdateFamilyNameResult;
      if (!result.success) {
        throw new Error(result.error || "Unable to update the family label.");
      }

      await onSaved();

      toast({
        title: "Family label updated",
        description: `${familyLabel} now uses “${trimmedName}”.`,
      });

      onOpenChange(false);
    } catch (saveError) {
      console.error("Error updating family label:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Unable to update the family label.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit family label</DialogTitle>
          <DialogDescription>
            Give {familyLabel.toLowerCase()} a clearer name so it is easier to recognize in the switcher.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="family-display-name">Family label</Label>
          <Input
            id="family-display-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_FAMILY_NAME_LENGTH}
            placeholder="Example: Family with Jessica"
            autoFocus
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Examples: Family with Jessica, Ava&apos;s Schedule, Weekend Parenting</span>
            <span>{name.trim().length}/{MAX_FAMILY_NAME_LENGTH}</span>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
            Save label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
