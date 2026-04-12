import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Film, FolderOpen, Images, RefreshCw, Search, Shield, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AssetViewerDialog } from "@/components/media/AssetViewerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useFamilyMediaGallery, type FamilyMediaGalleryItem } from "@/hooks/useFamilyMediaGallery";

const formatFileSize = (bytes: number) => {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const MediaGalleryPage = () => {
  const { activeFamilyId, assets, error, loading, refresh } = useFamilyMediaGallery();
  const [query, setQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<FamilyMediaGalleryItem | null>(null);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return assets;
    }

    return assets.filter((asset) =>
      [asset.title, asset.fileName].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [assets, query]);

  const imageCount = assets.filter((asset) => asset.kind === "image").length;
  const videoCount = assets.filter((asset) => asset.kind === "video").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-display font-bold tracking-tight sm:text-3xl">
                Media Gallery
              </h1>
              <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Family scoped
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Photos and videos shared in this family appear here. Open any item to review or download it without digging back through a thread.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/messages">Open Messages</Link>
            </Button>
            <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-3 gap-3 lg:w-auto">
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Total
                </p>
                <p className="mt-2 text-xl font-semibold">{assets.length}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Images
                </p>
                <p className="mt-2 text-xl font-semibold">{imageCount}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Videos
                </p>
                <p className="mt-2 text-xl font-semibold">{videoCount}</p>
              </div>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search shared media"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {!activeFamilyId && !loading ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-6">
            <h2 className="text-lg font-semibold text-foreground">Family selection required</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Select an active family before opening the Media Gallery. This page fails closed when family scope is missing.
            </p>
          </div>
        ) : loading ? (
          <div className="flex min-h-[18rem] items-center justify-center rounded-2xl border border-border/70 bg-card/70">
            <LoadingSpinner size="lg" message="Loading shared media..." />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6">
            <h2 className="text-lg font-semibold text-foreground">Shared media unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : filteredAssets.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedAsset(asset)}
                aria-label={`Open ${asset.title}`}
                className="group overflow-hidden rounded-[28px] border border-border/70 bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_22px_40px_-28px_rgba(15,23,42,0.5)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-950">
                  {asset.kind === "image" ? (
                    <img
                      src={asset.url}
                      alt={asset.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <>
                      <video
                        src={asset.url}
                        muted
                        preload="metadata"
                        className="h-full w-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white">
                          <Film className="h-6 w-6" />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                    {asset.kind}
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <p className="truncate text-base font-semibold text-foreground">{asset.title}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{asset.fileName}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                      {format(new Date(asset.createdAt), "MMM d, yyyy")}
                    </span>
                    <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                      {formatFileSize(asset.fileSize)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-border/80 bg-card/65 px-6 py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-border/70 bg-background/80">
              {query ? <Search className="h-7 w-7 text-muted-foreground" /> : <FolderOpen className="h-7 w-7 text-muted-foreground" />}
            </div>
            <h2 className="mt-5 text-xl font-semibold text-foreground">
              {query ? "No matching media" : "No media yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              {query
                ? "Try a different search term."
                : "Photos and videos shared in this family's message threads will appear here."}
            </p>
            {!query ? (
              <Button asChild className="mt-5">
                <Link to="/dashboard/messages">Start in Messages</Link>
              </Button>
            ) : null}
          </div>
        )}

        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-primary/15 bg-background/90 text-primary">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Family record context</p>
              <p className="mt-1 leading-6">
                This gallery only shows media scoped to the active family. Message-specific record details still stay with the thread itself.
              </p>
            </div>
          </div>
        </div>
      </div>

      <AssetViewerDialog
        asset={selectedAsset}
        open={Boolean(selectedAsset)}
        onBack={() => setSelectedAsset(null)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAsset(null);
          }
        }}
        sourceLabel="Media Gallery"
      />
    </DashboardLayout>
  );
};

export default MediaGalleryPage;
