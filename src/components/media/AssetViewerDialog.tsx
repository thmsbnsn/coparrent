import { ArrowLeft, Download, ExternalLink, FileText, Play } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AssetViewerItem {
  fileName: string;
  fileType: string;
  title: string;
  url: string;
}

interface AssetViewerDialogProps {
  asset: AssetViewerItem | null;
  open: boolean;
  onBack?: () => void;
  onOpenChange: (open: boolean) => void;
  sourceLabel: string;
}

const isImageAsset = (fileType: string) => fileType.startsWith("image/");
const isVideoAsset = (fileType: string) => fileType.startsWith("video/");
const isPdfAsset = (fileType: string) => fileType === "application/pdf";

export const AssetViewerDialog = ({
  asset,
  open,
  onBack,
  onOpenChange,
  sourceLabel,
}: AssetViewerDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-5xl border-border/70 bg-slate-950 p-0 text-white [&>button]:hidden">
      {asset ? (
        <div className="flex max-h-[92vh] min-h-[60vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  if (onBack) {
                    onBack();
                    return;
                  }

                  onOpenChange(false);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to {sourceLabel}</span>
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{asset.title}</p>
                <p className="truncate text-xs text-slate-300">{sourceLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <a href={asset.url} download={asset.fileName} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <a href={asset.url} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/70 p-4">
            {isImageAsset(asset.fileType) ? (
              <img
                src={asset.url}
                alt={asset.title}
                className="max-h-full max-w-full rounded-2xl object-contain"
              />
            ) : isVideoAsset(asset.fileType) ? (
              <video
                controls
                className="max-h-full max-w-full rounded-2xl bg-black"
                src={asset.url}
              />
            ) : isPdfAsset(asset.fileType) ? (
              <iframe
                className="h-full min-h-[70vh] w-full rounded-2xl border border-white/10 bg-white"
                src={asset.url}
                title={asset.title}
              />
            ) : (
              <div className="flex max-w-md flex-col items-center rounded-[28px] border border-white/10 bg-white/5 px-6 py-8 text-center">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10",
                    isVideoAsset(asset.fileType) && "text-primary",
                  )}
                >
                  {isVideoAsset(asset.fileType) ? (
                    <Play className="h-7 w-7" />
                  ) : (
                    <FileText className="h-7 w-7" />
                  )}
                </div>
                <p className="mt-4 text-lg font-semibold">{asset.title}</p>
                <p className="mt-2 text-sm text-slate-300">
                  This file does not have an in-app preview. Use the actions above to download it or open it in a new tab.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </DialogContent>
  </Dialog>
);
