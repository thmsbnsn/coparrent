import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  Scale,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LawLibraryUploadDialog } from './LawLibraryUploadDialog';
import { LawLibraryEditDialog } from './LawLibraryEditDialog';
import { LawLibraryCleanupTool } from './LawLibraryCleanupTool';
import {
  useAdminLawLibrary,
  US_STATES,
  RESOURCE_CATEGORIES,
} from '@/hooks/useAdminLawLibrary';
import { LawLibraryResource } from '@/hooks/useLawLibrary';
import { supabase } from '@/integrations/supabase/client';

export const AdminLawLibraryManager = () => {
  const {
    resources,
    loading,
    uploading,
    fetchResources,
    uploadResource,
    updateResource,
    deleteResource,
    updateVerificationDate,
  } = useAdminLawLibrary();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingResource, setEditingResource] = useState<LawLibraryResource | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LawLibraryResource | null>(null);

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const matchesSearch =
        searchQuery === '' ||
        resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.state.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesState = filterState === 'all' || resource.state === filterState;

      return matchesSearch && matchesState;
    });
  }, [resources, searchQuery, filterState]);

  const handleView = (resource: LawLibraryResource) => {
    const { data } = supabase.storage
      .from('law-library')
      .getPublicUrl(resource.file_path);
    window.open(data.publicUrl, '_blank');
  };

  const handleDownload = async (resource: LawLibraryResource) => {
    try {
      const { data, error } = await supabase.storage
        .from('law-library')
        .download(resource.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteResource(deleteConfirm);
    setDeleteConfirm(null);
  };

  const getStateName = (code: string) => {
    return US_STATES.find((s) => s.value === code)?.label || code;
  };

  const getCategoryName = (code: string) => {
    return RESOURCE_CATEGORIES.find((c) => c.value === code)?.label || code;
  };

  const statesWithResources = useMemo(() => {
    const states = new Set(resources.map((r) => r.state));
    return US_STATES.filter((s) => s.value === 'all' || states.has(s.value));
  }, [resources]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>Law Library Resources</CardTitle>
              <CardDescription>
                Manage public-domain family law documents
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchResources} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowUploadDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Upload Resource
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterState} onValueChange={setFilterState}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by state" />
            </SelectTrigger>
            <SelectContent>
              {statesWithResources.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{resources.length}</strong> total resources
          </span>
          <span>
            <strong className="text-foreground">{filteredResources.length}</strong> showing
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {resources.length === 0
              ? 'No resources uploaded yet. Click "Upload Resource" to add one.'
              : 'No resources match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResources.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell>
                      <div className="max-w-[250px]">
                        <p className="font-medium truncate">{resource.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {resource.file_name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getStateName(resource.state)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getCategoryName(resource.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <CheckCircle2 className="w-3 h-3 text-secondary" />
                        {format(new Date(resource.last_verified_at), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {resource.source_url ? (
                        <a
                          href={resource.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Link
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(resource)}
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(resource)}
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingResource(resource)}
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(resource)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Cleanup Tool */}
      <LawLibraryCleanupTool resources={resources} onCleanupComplete={fetchResources} />

      {/* Upload Dialog */}
      <LawLibraryUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={uploadResource}
        uploading={uploading}
      />

      {/* Edit Dialog */}
      <LawLibraryEditDialog
        open={!!editingResource}
        onOpenChange={(open) => !open && setEditingResource(null)}
        resource={editingResource}
        onUpdate={updateResource}
        onVerify={updateVerificationDate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.title}"? This will permanently remove
              the file from storage and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
