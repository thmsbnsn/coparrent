import { useState } from "react";
import { format } from "date-fns";
import { Download, FileText, Printer, Image, Calendar, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportColoringPagePDF, printColoringPage } from "@/lib/coloringPageExport";
import { toast } from "sonner";
import type { ColoringPage, Difficulty } from "@/hooks/useColoringPages";

const DIFFICULTY_LABELS: Record<Difficulty, { label: string; color: string }> = {
  simple: { label: "Simple", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  detailed: { label: "Detailed", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

interface ColoringPageGalleryProps {
  pages: ColoringPage[];
  loading: boolean;
  onDownloadPNG: (imageUrl: string, prompt: string) => void;
}

export const ColoringPageGallery = ({ pages, loading, onDownloadPNG }: ColoringPageGalleryProps) => {
  const [selectedPage, setSelectedPage] = useState<ColoringPage | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async (page: ColoringPage) => {
    if (!page.image_url) return;
    setExporting(true);
    try {
      await exportColoringPagePDF(page.image_url, page.prompt);
      toast.success("PDF exported!");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = (page: ColoringPage) => {
    if (!page.image_url) return;
    try {
      printColoringPage(page.image_url, page.prompt);
    } catch (error) {
      console.error("Print error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to print");
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <Image className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="font-medium text-muted-foreground">No coloring pages yet</h3>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Generate your first coloring page above!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {pages.map((page, index) => (
          <motion.div
            key={page.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card 
              className="group cursor-pointer overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
              onClick={() => setSelectedPage(page)}
            >
              <div className="aspect-square bg-muted/30 relative overflow-hidden">
                {page.image_url ? (
                  <img
                    src={page.image_url}
                    alt={page.prompt}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-3 space-y-1">
                <p className="text-sm font-medium line-clamp-1" title={page.prompt}>
                  {page.prompt}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge 
                    variant="secondary" 
                    className={`text-[10px] px-1.5 py-0 ${DIFFICULTY_LABELS[page.difficulty].color}`}
                  >
                    {DIFFICULTY_LABELS[page.difficulty].label}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(page.created_at), "MMM d")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedPage} onOpenChange={() => setSelectedPage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Coloring Page
            </DialogTitle>
          </DialogHeader>
          
          {selectedPage && (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="aspect-square max-h-[50vh] bg-muted/30 rounded-lg border overflow-hidden flex items-center justify-center">
                {selectedPage.image_url ? (
                  <img
                    src={selectedPage.image_url}
                    alt={selectedPage.prompt}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Image not available</p>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Prompt:</span> {selectedPage.prompt}
                </p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Badge 
                    variant="secondary" 
                    className={DIFFICULTY_LABELS[selectedPage.difficulty].color}
                  >
                    {DIFFICULTY_LABELS[selectedPage.difficulty].label}
                  </Badge>
                  <span>
                    Created {format(new Date(selectedPage.created_at), "MMMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedPage.image_url && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => onDownloadPNG(selectedPage.image_url!, selectedPage.prompt)}
                    className="flex-col h-auto py-3"
                  >
                    <Download className="h-4 w-4 mb-1" />
                    <span className="text-xs">Download PNG</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportPDF(selectedPage)}
                    disabled={exporting}
                    className="flex-col h-auto py-3"
                  >
                    <FileText className="h-4 w-4 mb-1" />
                    <span className="text-xs">{exporting ? "Exporting..." : "Export PDF"}</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handlePrint(selectedPage)}
                    className="flex-col h-auto py-3"
                  >
                    <Printer className="h-4 w-4 mb-1" />
                    <span className="text-xs">Print</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
