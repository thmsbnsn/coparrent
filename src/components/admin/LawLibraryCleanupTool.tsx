import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileX,
  HardDrive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LawLibraryResource, US_STATES } from '@/hooks/useLawLibrary';

interface CleanupCandidate extends LawLibraryResource {
  selected: boolean;
  reason: string;
}

interface Props {
  resources: LawLibraryResource[];
  onCleanupComplete: () => void;
}

// Threshold: files under 100 bytes are considered empty/placeholder
const EMPTY_FILE_THRESHOLD = 100;

export const LawLibraryCleanupTool = ({ resources, onCleanupComplete }: Props) => {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [results, setResults] = useState<{
    success: string[];
    failed: { title: string; error: string }[];
  } | null>(null);

  const scanForEmptyFiles = async () => {
    setScanning(true);
    setResults(null);
    
    try {
      const emptyFiles: CleanupCandidate[] = [];
      
      for (const resource of resources) {
        let reason = '';
        
        // Check 1: File size in DB is 0 or very small
        if (resource.file_size <= EMPTY_FILE_THRESHOLD) {
          reason = `File size: ${resource.file_size} bytes`;
        }
        
        // Check 2: Title or description is empty/placeholder-like
        if (!reason && (!resource.title || resource.title.trim().length < 3)) {
          reason = 'Empty or placeholder title';
        }
        
        // Check 3: File path is missing
        if (!reason && !resource.file_path) {
          reason = 'Missing file path';
        }
        
        // Try to verify actual storage size if file_size is suspicious
        if (reason || resource.file_size <= EMPTY_FILE_THRESHOLD) {
          try {
            const { data: fileList, error } = await supabase.storage
              .from('law-library')
              .list(resource.file_path.split('/').slice(0, -1).join('/'), {
                search: resource.file_path.split('/').pop(),
              });
            
            if (!error && fileList && fileList.length > 0) {
              const file = fileList.find(f => resource.file_path.endsWith(f.name));
              if (file && file.metadata?.size !== undefined && file.metadata.size <= EMPTY_FILE_THRESHOLD) {
                reason = `Storage size: ${file.metadata.size} bytes`;
              }
            } else if (error || !fileList || fileList.length === 0) {
              reason = 'File not found in storage';
            }
          } catch {
            // If we can't verify, keep the DB-based reason
          }
        }
        
        if (reason) {
          emptyFiles.push({
            ...resource,
            selected: true,
            reason,
          });
        }
      }
      
      setCandidates(emptyFiles);
      
      toast({
        title: 'Scan Complete',
        description: `Found ${emptyFiles.length} empty/placeholder file(s)`,
      });
    } catch (error: unknown) {
      console.error('Scan error:', error);
      toast({
        title: 'Scan Failed',
        description: error instanceof Error ? error.message : 'Could not scan for empty files',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const toggleCandidate = (id: string) => {
    setCandidates(prev =>
      prev.map(c => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const toggleAll = (selected: boolean) => {
    setCandidates(prev => prev.map(c => ({ ...c, selected })));
  };

  const selectedCount = candidates.filter(c => c.selected).length;

  const deleteSelectedFiles = async () => {
    const toDelete = candidates.filter(c => c.selected);
    if (toDelete.length === 0) return;
    
    setDeleting(true);
    setShowConfirm(false);
    
    const success: string[] = [];
    const failed: { title: string; error: string }[] = [];
    
    for (const resource of toDelete) {
      try {
        // Delete from storage first
        const { error: storageError } = await supabase.storage
          .from('law-library')
          .remove([resource.file_path]);
        
        if (storageError) {
          console.warn('Storage deletion warning:', storageError);
          // Continue anyway - file might already be gone
        }
        
        // Delete from database
        const { error: dbError } = await supabase
          .from('law_library_resources')
          .delete()
          .eq('id', resource.id);
        
        if (dbError) throw dbError;
        
        // Log the cleanup action to audit log (fire and forget)
        try {
          await supabase.rpc('log_audit_event', {
            _entity_type: 'law_library_resource',
            _entity_id: resource.id,
            _action: 'cleanup_delete',
            _before: {
              title: resource.title,
              file_path: resource.file_path,
              file_size: resource.file_size,
              state: resource.state,
              reason: resource.reason,
            },
            _metadata: { cleanup_tool: true },
          });
        } catch (auditErr) {
          console.warn('Audit log failed:', auditErr);
        }
        
        success.push(resource.title);
      } catch (error: unknown) {
        failed.push({
          title: resource.title,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    setResults({ success, failed });
    setCandidates(prev => prev.filter(c => !success.includes(c.title)));
    
    if (success.length > 0) {
      toast({
        title: 'Cleanup Complete',
        description: `Deleted ${success.length} file(s)${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
      });
      onCleanupComplete();
    } else if (failed.length > 0) {
      toast({
        title: 'Cleanup Failed',
        description: 'Could not delete any files. Check the results below.',
        variant: 'destructive',
      });
    }
    
    setDeleting(false);
  };

  const getStateName = (code: string) => {
    return US_STATES.find(s => s.value === code)?.label || code;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileX className="w-5 h-5 text-amber-500" />
            <div>
              <CardTitle className="text-lg">Cleanup Empty Files</CardTitle>
              <CardDescription>
                Scan and remove placeholder files (0 bytes or empty)
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={scanForEmptyFiles}
            disabled={scanning || deleting}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
            {candidates.length > 0 ? 'Re-scan' : 'Scan for Empty Files'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {scanning && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-muted-foreground">Scanning files...</span>
          </div>
        )}

        {!scanning && candidates.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Click "Scan for Empty Files" to find placeholder files that can be removed.</p>
          </div>
        )}

        {!scanning && candidates.length > 0 && (
          <>
            <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Review the list carefully before deleting. Only empty/placeholder files are shown.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Checkbox
                  id="select-all"
                  checked={selectedCount === candidates.length}
                  onCheckedChange={(checked) => toggleAll(!!checked)}
                />
                <label htmlFor="select-all" className="text-sm cursor-pointer">
                  Select all ({candidates.length})
                </label>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowConfirm(true)}
                disabled={selectedCount === 0 || deleting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedCount})
              </Button>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Title / Filename</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map(candidate => (
                    <TableRow
                      key={candidate.id}
                      className={candidate.selected ? 'bg-destructive/5' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={candidate.selected}
                          onCheckedChange={() => toggleCandidate(candidate.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="font-medium truncate">{candidate.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {candidate.file_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getStateName(candidate.state)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFileSize(candidate.file_size)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(candidate.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {candidate.reason}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {results && (
          <div className="mt-6 space-y-3">
            {results.success.length > 0 && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <strong>Deleted ({results.success.length}):</strong>{' '}
                  {results.success.join(', ')}
                </AlertDescription>
              </Alert>
            )}
            {results.failed.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Failed ({results.failed.length}):</strong>
                  <ul className="mt-1 list-disc list-inside">
                    {results.failed.map((f, i) => (
                      <li key={i}>
                        {f.title}: {f.error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete <strong>{selectedCount}</strong> file(s) from
              storage and database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-40 overflow-y-auto my-4 text-sm">
            <ul className="list-disc list-inside space-y-1">
              {candidates
                .filter(c => c.selected)
                .map(c => (
                  <li key={c.id} className="truncate">
                    {c.title} ({c.state})
                  </li>
                ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteSelectedFiles}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : `Delete ${selectedCount} Files`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
