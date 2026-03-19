import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Eye,
  ExternalLink,
  Calendar,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LawLibraryResource, RESOURCE_CATEGORIES, US_STATES } from '@/hooks/useLawLibrary';

interface LawLibraryCardProps {
  resource: LawLibraryResource;
  onView: (resource: LawLibraryResource) => void;
  onDownload: (resource: LawLibraryResource) => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const LawLibraryCard = ({
  resource,
  onView,
  onDownload,
}: LawLibraryCardProps) => {
  const category = RESOURCE_CATEGORIES.find((c) => c.value === resource.category);
  const state = US_STATES.find((s) => s.value === resource.state);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 hover:shadow-lg transition-all hover:border-primary/20"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground line-clamp-2">
            {resource.title}
          </h3>
          
          {resource.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {resource.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              <MapPin className="w-3 h-3 mr-1" />
              {state?.label || resource.state}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {category?.label || resource.category}
            </Badge>
            {resource.file_size > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatFileSize(resource.file_size)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-secondary" />
              Verified {format(new Date(resource.last_verified_at), 'MMM d, yyyy')}
            </span>
            {resource.source_url && (
              <a
                href={resource.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Source
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onView(resource)}
        >
          <Eye className="w-4 h-4 mr-2" />
          View
        </Button>
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={() => onDownload(resource)}
        >
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>
    </motion.div>
  );
};
