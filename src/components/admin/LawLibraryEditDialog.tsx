import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LawLibraryResource } from '@/hooks/useLawLibrary';
import { US_STATES, RESOURCE_CATEGORIES, NewLawLibraryResource } from '@/hooks/useAdminLawLibrary';

interface LawLibraryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: LawLibraryResource | null;
  onUpdate: (id: string, updates: Partial<NewLawLibraryResource & { last_verified_at?: string }>) => Promise<boolean>;
  onVerify: (id: string) => Promise<boolean>;
}

export const LawLibraryEditDialog = ({
  open,
  onOpenChange,
  resource,
  onUpdate,
  onVerify,
}: LawLibraryEditDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (resource) {
      setTitle(resource.title);
      setDescription(resource.description || '');
      setState(resource.state);
      setCategory(resource.category);
      setSourceUrl(resource.source_url || '');
    }
  }, [resource]);

  const handleSave = async () => {
    if (!resource || !title.trim() || !state) return;

    setSaving(true);
    const success = await onUpdate(resource.id, {
      title,
      description,
      state,
      category,
      source_url: sourceUrl,
    });
    setSaving(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const handleVerify = async () => {
    if (!resource) return;

    setVerifying(true);
    await onVerify(resource.id);
    setVerifying(false);
  };

  if (!resource) return null;

  const stateOptions = US_STATES.filter((s) => s.value !== 'all');
  const categoryOptions = RESOURCE_CATEGORIES.filter((c) => c.value !== 'all');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Resource</DialogTitle>
          <DialogDescription>
            Update metadata for "{resource.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Verification Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-medium">Last Verified</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(resource.last_verified_at), 'MMMM d, yyyy')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerify}
              disabled={verifying}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {verifying ? 'Updating...' : 'Mark Verified Today'}
            </Button>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
            />
          </div>

          {/* State */}
          <div className="space-y-2">
            <Label>State *</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger>
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Topic Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Source URL */}
          <div className="space-y-2">
            <Label htmlFor="edit-sourceUrl">Official Source URL</Label>
            <Input
              id="edit-sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* File Info (read-only) */}
          <div className="space-y-2">
            <Label>File</Label>
            <p className="text-sm text-muted-foreground">
              {resource.file_name} ({(resource.file_size / 1024).toFixed(1)} KB)
            </p>
            <p className="text-xs text-muted-foreground">
              To replace the file, delete this resource and upload a new one.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || !state || saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
