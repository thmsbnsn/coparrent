import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, Image, Calendar, Download, Edit2, Check, Tag, Filter, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChildPhotos, ChildPhoto, UploadProgress } from "@/hooks/useChildPhotos";
import { cn } from "@/lib/utils";

// Predefined tag categories
const TAG_CATEGORIES = {
  events: {
    label: "Events",
    tags: ["Birthday", "Holiday", "Vacation", "First Day of School", "Graduation", "Sports Event", "Recital", "Party"],
  },
  family: {
    label: "Family",
    tags: ["With Mom", "With Dad", "With Siblings", "With Grandparents", "Family Gathering", "Extended Family"],
  },
  activities: {
    label: "Activities",
    tags: ["School", "Sports", "Art", "Music", "Outdoors", "Swimming", "Reading", "Playing"],
  },
  milestones: {
    label: "Milestones",
    tags: ["First Steps", "Lost Tooth", "New Skill", "Award", "Achievement"],
  },
};

const ALL_TAGS = Object.values(TAG_CATEGORIES).flatMap((cat) => cat.tags);

interface ChildPhotoGalleryProps {
  childId: string;
  childName: string;
}

// Tag selector component
const TagSelector = ({
  selectedTags,
  onTagsChange,
  compact = false,
}: {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  compact?: boolean;
}) => {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            {selectedTags.length > 0 ? `${selectedTags.length} tags` : "Add tags"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="space-y-3">
            {Object.entries(TAG_CATEGORIES).map(([key, category]) => (
              <div key={key}>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{category.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {category.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "px-2 py-1 text-xs rounded-full border transition-colors",
                        selectedTags.includes(tag)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-transparent"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(TAG_CATEGORIES).map(([key, category]) => (
        <div key={key}>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{category.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {category.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "px-2 py-1 text-xs rounded-full border transition-colors",
                  selectedTags.includes(tag)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 hover:bg-muted border-transparent"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const ChildPhotoGallery = ({ childId, childName }: ChildPhotoGalleryProps) => {
  const { photos, loading, uploading, uploadProgress, uploadPhoto, uploadPhotos, clearUploadProgress, deletePhoto, updateCaption, updateTags } = useChildPhotos(childId);
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ChildPhoto | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<ChildPhoto | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [newCaption, setNewCaption] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  
  // Filter state
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Upload form state (single)
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadDate, setUploadDate] = useState("");
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  
  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkPreviews, setBulkPreviews] = useState<string[]>([]);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    if (filterTags.length === 0) return photos;
    return photos.filter((photo) =>
      filterTags.some((tag) => photo.tags?.includes(tag))
    );
  }, [photos, filterTags]);

  // Get unique tags from all photos
  const usedTags = useMemo(() => {
    const tags = new Set<string>();
    photos.forEach((photo) => photo.tags?.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [photos]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setUploadPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setBulkFiles(files);
      // Generate previews for all files
      const previews: string[] = [];
      files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          previews[index] = e.target?.result as string;
          if (previews.filter(Boolean).length === files.length) {
            setBulkPreviews([...previews]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    
    const success = await uploadPhoto(uploadFile, uploadCaption, uploadDate, uploadTags);
    if (success) {
      setIsUploadOpen(false);
      resetUploadForm();
    }
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) return;
    
    await uploadPhotos(bulkFiles, bulkTags);
  };

  const closeBulkUploadDialog = () => {
    setIsBulkUploadOpen(false);
    resetBulkUploadForm();
    clearUploadProgress();
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadCaption("");
    setUploadDate("");
    setUploadTags([]);
    setUploadPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetBulkUploadForm = () => {
    setBulkFiles([]);
    setBulkPreviews([]);
    setBulkTags([]);
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
  };

  const removeBulkFile = (index: number) => {
    setBulkFiles((prev) => prev.filter((_, i) => i !== index));
    setBulkPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteConfirm = async () => {
    if (!photoToDelete) return;
    await deletePhoto(photoToDelete.id, photoToDelete.file_path);
    setPhotoToDelete(null);
    if (selectedPhoto?.id === photoToDelete.id) {
      setSelectedPhoto(null);
    }
  };

  const handleCaptionEdit = (photo: ChildPhoto) => {
    setEditingCaption(photo.id);
    setNewCaption(photo.caption || "");
  };

  const handleCaptionSave = async (photoId: string) => {
    await updateCaption(photoId, newCaption);
    setEditingCaption(null);
    setNewCaption("");
  };

  const handleTagsEdit = (photo: ChildPhoto) => {
    setEditingTags(photo.id);
    setNewTags(photo.tags || []);
  };

  const handleTagsSave = async (photoId: string) => {
    await updateTags(photoId, newTags);
    // Update selected photo if it's the one being edited
    if (selectedPhoto?.id === photoId) {
      setSelectedPhoto({ ...selectedPhoto, tags: newTags });
    }
    setEditingTags(null);
    setNewTags([]);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const clearFilters = () => {
    setFilterTags([]);
    setShowFilters(false);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with upload and filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {photos.length === 0
              ? "No photos yet"
              : filterTags.length > 0
              ? `${filteredPhotos.length} of ${photos.length} photos`
              : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
          </p>
          {filterTags.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs">
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {photos.length > 0 && usedTags.length > 0 && (
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(filterTags.length > 0 && "border-primary")}>
                  <Filter className="w-4 h-4 mr-1.5" />
                  Filter
                  {filterTags.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                      {filterTags.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Filter by tag</p>
                    {filterTags.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setFilterTags([])} className="h-7 px-2 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {usedTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          if (filterTags.includes(tag)) {
                            setFilterTags(filterTags.filter((t) => t !== tag));
                          } else {
                            setFilterTags([...filterTags, tag]);
                          }
                        }}
                        className={cn(
                          "px-2 py-1 text-xs rounded-full border transition-colors",
                          filterTags.includes(tag)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 hover:bg-muted border-transparent"
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" size="sm" onClick={() => setIsBulkUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-1.5" />
            Bulk Upload
          </Button>
          <Button size="sm" onClick={() => setIsUploadOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Photo
          </Button>
        </div>
      </div>

      {/* Active filters display */}
      {filterTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                onClick={() => setFilterTags(filterTags.filter((t) => t !== tag))}
                className="ml-0.5 hover:bg-muted rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Photo Grid */}
      {photos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
              <Image className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">No photos yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload photos to share memories with your co-parent
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Upload First Photo
            </Button>
          </CardContent>
        </Card>
      ) : filteredPhotos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
              <Filter className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">No matching photos</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filters
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredPhotos.map((photo) => (
              <motion.button
                key={photo.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setSelectedPhoto(photo)}
                className="relative aspect-square rounded-xl overflow-hidden bg-muted group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {photo.signedUrl ? (
                  <img
                    src={photo.signedUrl}
                    alt={photo.caption || `Photo of ${childName}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {/* Tags indicator */}
                {photo.tags && photo.tags.length > 0 && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-black/50 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-white" />
                      <span className="text-xs text-white">{photo.tags.length}</span>
                    </div>
                  </div>
                )}
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate">{photo.caption}</p>
                  </div>
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => {
        if (!open) resetUploadForm();
        setIsUploadOpen(open);
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle>Add Photo</DialogTitle>
            <DialogDescription>
              Upload a photo to {childName}'s gallery
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* File input */}
            <div className="space-y-2">
              <Label>Photo</Label>
              {uploadPreview ? (
                <div className="relative">
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    className="w-full aspect-video object-cover rounded-lg"
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={resetUploadForm}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <Image className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to select a photo</p>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label htmlFor="upload-caption">Caption (optional)</Label>
              <Input
                id="upload-caption"
                placeholder="Add a caption..."
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
              />
            </div>

            {/* Date taken */}
            <div className="space-y-2">
              <Label htmlFor="upload-date">Date taken (optional)</Label>
              <Input
                id="upload-date"
                type="date"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags (optional)</Label>
              {uploadTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {uploadTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button
                        onClick={() => setUploadTags(uploadTags.filter((t) => t !== tag))}
                        className="ml-0.5 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <TagSelector selectedTags={uploadTags} onTagsChange={setUploadTags} />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
              {uploading ? "Uploading..." : "Upload Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={isBulkUploadOpen} onOpenChange={(open) => {
        if (!open && !uploading) closeBulkUploadDialog();
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Photos</DialogTitle>
            <DialogDescription>
              Upload multiple photos at once to {childName}'s gallery
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* File selection (only show if no files selected or not uploading) */}
            {bulkFiles.length === 0 && uploadProgress.length === 0 && (
              <div className="space-y-2">
                <Label>Select Photos</Label>
                <button
                  onClick={() => bulkFileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to select multiple photos</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP, or GIF (max 10MB each)</p>
                </button>
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleBulkFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {/* Selected files preview (before upload) */}
            {bulkFiles.length > 0 && uploadProgress.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{bulkFiles.length} photo{bulkFiles.length > 1 ? 's' : ''} selected</Label>
                  <Button variant="ghost" size="sm" onClick={resetBulkUploadForm} className="h-7 px-2 text-xs">
                    Clear all
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                  {bulkPreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                      {preview ? (
                        <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      <button
                        onClick={() => removeBulkFile(index)}
                        className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Shared tags for all photos */}
                <div className="space-y-2 pt-2 border-t">
                  <Label>Apply tags to all photos (optional)</Label>
                  {bulkTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {bulkTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                          {tag}
                          <button
                            onClick={() => setBulkTags(bulkTags.filter((t) => t !== tag))}
                            className="ml-0.5 hover:bg-muted rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <TagSelector selectedTags={bulkTags} onTagsChange={setBulkTags} compact />
                </div>
              </div>
            )}

            {/* Upload progress */}
            {uploadProgress.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Upload Progress</Label>
                  <span className="text-sm text-muted-foreground">
                    {uploadProgress.filter(p => p.status === 'success').length} / {uploadProgress.length} complete
                  </span>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {uploadProgress.map((progress, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        {progress.status === 'success' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : progress.status === 'error' ? (
                          <AlertCircle className="w-5 h-5 text-destructive" />
                        ) : progress.status === 'uploading' ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                          <Image className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{progress.fileName}</p>
                        {progress.status === 'error' && progress.error && (
                          <p className="text-xs text-destructive">{progress.error}</p>
                        )}
                        {progress.status === 'uploading' && (
                          <Progress value={progress.progress} className="h-1.5 mt-1" />
                        )}
                        {progress.status === 'success' && (
                          <p className="text-xs text-green-500">Uploaded</p>
                        )}
                        {progress.status === 'pending' && (
                          <p className="text-xs text-muted-foreground">Waiting...</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {uploadProgress.length > 0 ? (
              <Button 
                onClick={closeBulkUploadDialog} 
                disabled={uploading}
                className="w-full sm:w-auto"
              >
                {uploading ? "Uploading..." : "Done"}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeBulkUploadDialog} disabled={uploading}>
                  Cancel
                </Button>
                <Button onClick={handleBulkUpload} disabled={bulkFiles.length === 0 || uploading}>
                  {uploading ? "Uploading..." : `Upload ${bulkFiles.length} Photo${bulkFiles.length !== 1 ? 's' : ''}`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => {
        if (!open) {
          setSelectedPhoto(null);
          setEditingCaption(null);
          setEditingTags(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden mx-4 sm:mx-auto">
          {selectedPhoto && (
            <div className="flex flex-col">
              {/* Image */}
              <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[60vh]">
                {selectedPhoto.signedUrl ? (
                  <img
                    src={selectedPhoto.signedUrl}
                    alt={selectedPhoto.caption || `Photo of ${childName}`}
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <Image className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                {/* Close button */}
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-3 right-3"
                  onClick={() => setSelectedPhoto(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Details */}
              <div className="p-4 space-y-3 max-h-[30vh] overflow-y-auto">
                {/* Caption */}
                <div className="flex items-start gap-2">
                  {editingCaption === selectedPhoto.id ? (
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={newCaption}
                        onChange={(e) => setNewCaption(e.target.value)}
                        placeholder="Add a caption..."
                        className="flex-1"
                        autoFocus
                      />
                      <Button size="icon" onClick={() => handleCaptionSave(selectedPhoto.id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => setEditingCaption(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className={cn(
                        "flex-1 text-sm",
                        !selectedPhoto.caption && "text-muted-foreground italic"
                      )}>
                        {selectedPhoto.caption || "No caption"}
                      </p>
                      <Button size="icon" variant="ghost" onClick={() => handleCaptionEdit(selectedPhoto)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Tags</p>
                    {editingTags !== selectedPhoto.id && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleTagsEdit(selectedPhoto)}>
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {editingTags === selectedPhoto.id ? (
                    <div className="space-y-3">
                      {newTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {newTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                              {tag}
                              <button
                                onClick={() => setNewTags(newTags.filter((t) => t !== tag))}
                                className="ml-0.5 hover:bg-muted rounded-full p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <TagSelector selectedTags={newTags} onTagsChange={setNewTags} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleTagsSave(selectedPhoto.id)}>
                          <Check className="w-4 h-4 mr-1" />
                          Save Tags
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTags(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPhoto.tags && selectedPhoto.tags.length > 0 ? (
                        selectedPhoto.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No tags</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {selectedPhoto.taken_at && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Taken {formatDate(selectedPhoto.taken_at)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Uploaded {formatDate(selectedPhoto.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {selectedPhoto.signedUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedPhoto.signedUrl} download={selectedPhoto.file_name} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 mr-1.5" />
                        Download
                      </a>
                    </Button>
                  )}
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setPhotoToDelete(selectedPhoto)}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!photoToDelete} onOpenChange={(open) => !open && setPhotoToDelete(null)}>
        <AlertDialogContent className="mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this photo from {childName}'s gallery. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Photo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
