import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Child } from "@/hooks/useChildren";

interface DeleteChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child: Child | null;
  onConfirm: (childId: string) => Promise<boolean>;
}

export const DeleteChildDialog = ({
  open,
  onOpenChange,
  child,
  onConfirm,
}: DeleteChildDialogProps) => {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const requiredText = child?.name.toUpperCase() || "DELETE";
  const isConfirmValid = confirmText.toUpperCase() === requiredText;

  const handleConfirm = async () => {
    if (!child || !isConfirmValid) return;
    
    setIsDeleting(true);
    const success = await onConfirm(child.id);
    setIsDeleting(false);
    
    if (success) {
      setConfirmText("");
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmText("");
    onOpenChange(false);
  };

  if (!child) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Delete {child.name}'s Profile?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p>
              This action <strong>cannot be undone</strong>. This will permanently delete:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>All profile information</li>
              <li>Photo gallery and avatar</li>
              <li>Health and school records</li>
              <li>Associated sports activities and events</li>
              <li>Documents, journal entries, and expenses</li>
              <li>Gift lists and items</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4 space-y-2">
          <Label htmlFor="confirm-delete">
            Type <span className="font-bold text-destructive">{child.name.toUpperCase()}</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Type ${child.name.toUpperCase()} to confirm`}
            disabled={isDeleting}
            className={isConfirmValid ? "border-destructive" : ""}
          />
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting}
            className="gap-2"
          >
            {isDeleting ? (
              "Deleting..."
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Permanently
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
