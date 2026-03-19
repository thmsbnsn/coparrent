/**
 * @page-role Reference
 * @summary-pattern Category counts + document grid with search/filter
 * @ownership Both co-parents can view all documents (shared vault)
 * @court-view Court Export dialog generates neutral, print-safe document bundles
 * 
 * LAW 1: Reference role - read-only browsing, low cognitive load
 * LAW 2: Stats summary (total, legal, medical, school) before document grid
 * LAW 6: Court Export is first-class - accessible from header actions
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  Shield,
  Filter,
  Search,
  FolderOpen,
  Scale,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary';
import { useDocuments, DOCUMENT_CATEGORIES } from '@/hooks/useDocuments';
import { DocumentUploadDialog } from '@/components/documents/DocumentUploadDialog';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { CourtExportDialog } from '@/components/documents/CourtExportDialog';
import { ViewOnlyBadge } from '@/components/ui/ViewOnlyBadge';
import { PermissionButton } from '@/components/ui/PermissionButton';
import { usePermissions } from '@/hooks/usePermissions';

const DocumentsPageContent = () => {
  const {
    documents,
    loading,
    uploading,
    uploadDocument,
    downloadDocument,
    viewDocument,
    deleteDocument,
    getAccessLogs,
  } = useDocuments();

  const { permissions } = usePermissions();

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCourtExportDialog, setShowCourtExportDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-display font-bold">
                Document Vault
              </h1>
              {permissions.isViewOnly && (
                <ViewOnlyBadge reason={permissions.viewOnlyReason || undefined} />
              )}
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Secure storage with complete audit trail
            </p>
          </div>
          <div className="flex gap-2">
            <PermissionButton
              variant="outline"
              hasPermission={permissions.canManageDocuments}
              deniedMessage="Only parents can export documents"
              onClick={() => setShowCourtExportDialog(true)}
            >
              <Scale className="w-4 h-4 mr-2" />
              Court Export
            </PermissionButton>
            <PermissionButton
              hasPermission={permissions.canManageDocuments}
              deniedMessage="Only parents can upload documents"
              onClick={() => setShowUploadDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Upload Document
            </PermissionButton>
          </div>
        </motion.div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-primary/20 bg-primary/5 p-4"
        >
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-sm">Court-Ready Security</h3>
              <p className="text-sm text-muted-foreground mt-1">
                All documents are encrypted and access is logged for legal
                compliance. Both co-parents can view all documents.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {DOCUMENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Documents Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" message="Loading documents..." />
          </div>
        ) : filteredDocuments.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredDocuments.map((doc, index) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onView={viewDocument}
                onDownload={downloadDocument}
                onDelete={deleteDocument}
                getAccessLogs={getAccessLogs}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card p-12 text-center"
          >
            <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-display font-semibold mb-2">
              {searchQuery || categoryFilter !== 'all'
                ? 'No documents found'
                : 'No documents yet'}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {searchQuery || categoryFilter !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Upload important documents like custody agreements, medical records, and school information to share securely with your co-parent.'}
            </p>
            {!searchQuery && categoryFilter === 'all' && permissions.canManageDocuments && (
              <Button onClick={() => setShowUploadDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Upload Your First Document
              </Button>
            )}
          </motion.div>
        )}

        {/* Stats */}
        {documents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-display font-bold text-primary">
                {documents.length}
              </p>
              <p className="text-sm text-muted-foreground">Total Documents</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-display font-bold text-primary">
                {documents.filter((d) => d.category === 'legal').length}
              </p>
              <p className="text-sm text-muted-foreground">Legal</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-display font-bold text-primary">
                {documents.filter((d) => d.category === 'medical').length}
              </p>
              <p className="text-sm text-muted-foreground">Medical</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-display font-bold text-primary">
                {documents.filter((d) => d.category === 'school').length}
              </p>
              <p className="text-sm text-muted-foreground">School</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={uploadDocument}
        uploading={uploading}
      />

      {/* Court Export Dialog */}
      <CourtExportDialog
        open={showCourtExportDialog}
        onOpenChange={setShowCourtExportDialog}
      />
    </DashboardLayout>
  );
};

const DocumentsPage = () => (
  <FeatureErrorBoundary featureName="Document Vault">
    <DocumentsPageContent />
  </FeatureErrorBoundary>
);

export default DocumentsPage;
