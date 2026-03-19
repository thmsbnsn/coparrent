import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { History, Upload, Eye, Download, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Document, DocumentAccessLog } from '@/hooks/useDocuments';

interface DocumentAccessLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document;
  getAccessLogs: (docId: string) => Promise<DocumentAccessLog[]>;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'upload':
      return <Upload className="w-4 h-4 text-green-500" />;
    case 'view':
      return <Eye className="w-4 h-4 text-blue-500" />;
    case 'download':
      return <Download className="w-4 h-4 text-purple-500" />;
    case 'delete':
      return <Trash2 className="w-4 h-4 text-destructive" />;
    default:
      return <History className="w-4 h-4 text-muted-foreground" />;
  }
};

const getActionLabel = (action: string) => {
  switch (action) {
    case 'upload':
      return 'Uploaded';
    case 'view':
      return 'Viewed';
    case 'download':
      return 'Downloaded';
    case 'delete':
      return 'Deleted';
    default:
      return action;
  }
};

export const DocumentAccessLogDialog = ({
  open,
  onOpenChange,
  document,
  getAccessLogs,
}: DocumentAccessLogDialogProps) => {
  const [logs, setLogs] = useState<DocumentAccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getAccessLogs(document.id)
        .then(setLogs)
        .finally(() => setLoading(false));
    }
  }, [open, document.id, getAccessLogs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <History className="w-5 h-5" />
            Access History
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Complete audit trail for "{document.title}"
          </p>

          <ScrollArea className="h-[300px] pr-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No access logs found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {getActionLabel(log.action)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
              All access is logged for legal compliance
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
