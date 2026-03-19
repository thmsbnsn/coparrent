import { useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Eye,
  Trash2,
  MoreVertical,
  Shield,
  Calendar,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Badge } from '@/components/ui/badge';
import { Document, DOCUMENT_CATEGORIES, type DocumentAccessLog } from '@/hooks/useDocuments';
import { DocumentAccessLogDialog } from './DocumentAccessLogDialog';

interface DocumentCardProps {
  document: Document;
  onView: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  getAccessLogs: (docId: string) => Promise<DocumentAccessLog[]>;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (fileType: string) => {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
  return '📁';
};

export const DocumentCard = ({
  document,
  onView,
  onDownload,
  onDelete,
  getAccessLogs,
}: DocumentCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);

  const category = DOCUMENT_CATEGORIES.find((c) => c.value === document.category);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-4 hover:shadow-lg transition-shadow"
      >
        <div className="flex items-start gap-3">
          <div className="text-2xl">{getFileIcon(document.file_type)}</div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium truncate">{document.title}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {document.file_name}
                </p>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView(document)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownload(document)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowLogsDialog(true)}>
                    <History className="w-4 h-4 mr-2" />
                    Access History
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {document.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {document.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge variant="secondary" className="text-xs">
                {category?.label || document.category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(document.file_size)}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(document.created_at), 'MMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Secure
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{document.title}"? This action
              cannot be undone and the document will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(document)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Access Logs Dialog */}
      <DocumentAccessLogDialog
        open={showLogsDialog}
        onOpenChange={setShowLogsDialog}
        document={document}
        getAccessLogs={getAccessLogs}
      />
    </>
  );
};
