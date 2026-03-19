/**
 * @page-role Overview
 * @summary-pattern Unified creations grid with folder organization and sharing
 * @ownership Private-by-default; explicit sharing to family members
 * @court-view PDF/Print export via creationsExport.ts branding contract
 * 
 * LAW 1: Overview role - creation cards with minimal inline actions
 * LAW 2: Filter tabs and folder structure provide summary before detail
 * LAW 3: Ownership icons (Lock/Users) show private vs shared state
 * LAW 4: All creation cards use identical Card component structure
 * LAW 6: Export follows CoParrent Creations branding contract
 * 
 * Creations Library Page
 * Unified view for all Kids Hub generated content.
 * Route: /dashboard/kids-hub/creations
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { RoleGate } from "@/components/gates/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Search,
  FolderPlus,
  MoreVertical,
  Download,
  Printer,
  Share2,
  FolderOpen,
  Trash2,
  Palette,
  Sparkles,
  Clock,
  Grid3X3,
  List,
  Filter,
  Users,
  Lock,
  Eye,
} from "lucide-react";
import { useCreations, type Creation, type CreationType, type CreationFilters } from "@/hooks/useCreations";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CreationsPrivacyTooltip } from "@/components/onboarding/CreationsPrivacyTooltip";

const CreationsLibraryContent = () => {
  const navigate = useNavigate();
  const {
    creations,
    folders,
    familyMembers,
    loading,
    fetchCreations,
    fetchFolders,
    fetchFamilyMembers,
    createFolder,
    deleteFolder,
    deleteCreation,
    moveToFolder,
    shareCreation,
    unshareCreation,
    fetchShares,
    fetchActivityDetail,
    fetchColoringPageDetail,
  } = useCreations();

  // UI State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | CreationType>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'mine' | 'shared'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  
  // Dialogs
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedCreation, setSelectedCreation] = useState<Creation | null>(null);
  const [currentShares, setCurrentShares] = useState<string[]>([]);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Load data
  useEffect(() => {
    const filters: CreationFilters = {
      search: searchQuery || undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
      folderId: folderFilter === 'all' ? undefined : (folderFilter === 'unsorted' ? null : folderFilter),
      ownership: ownershipFilter === 'all' ? undefined : ownershipFilter,
      sortBy,
    };
    fetchCreations(filters);
  }, [fetchCreations, searchQuery, typeFilter, folderFilter, ownershipFilter, sortBy]);

  useEffect(() => {
    fetchFolders();
    fetchFamilyMembers();
  }, [fetchFolders, fetchFamilyMembers]);

  // Handlers
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName);
    setNewFolderName('');
    setNewFolderDialogOpen(false);
  };

  const handleOpenCreation = (creation: Creation) => {
    if (creation.type === 'activity') {
      navigate(`/dashboard/kids-hub/activities?view=${creation.detail_id}`);
    } else if (creation.type === 'coloring_page') {
      navigate(`/dashboard/kids-hub/coloring?view=${creation.detail_id}`);
    }
  };

  const handleShareClick = async (creation: Creation) => {
    setSelectedCreation(creation);
    const shares = await fetchShares(creation.id);
    setCurrentShares(shares.map(s => s.shared_with_profile_id));
    setShareDialogOpen(true);
  };

  const handleToggleShare = async (profileId: string) => {
    if (!selectedCreation) return;
    
    if (currentShares.includes(profileId)) {
      await unshareCreation(selectedCreation.id, profileId);
      setCurrentShares(prev => prev.filter(id => id !== profileId));
    } else {
      await shareCreation(selectedCreation.id, profileId);
      setCurrentShares(prev => [...prev, profileId]);
    }
  };

  const handleMoveClick = (creation: Creation) => {
    setSelectedCreation(creation);
    setMoveDialogOpen(true);
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    if (!selectedCreation) return;
    await moveToFolder(selectedCreation.id, folderId);
    setMoveDialogOpen(false);
    setSelectedCreation(null);
    // Refresh
    fetchCreations();
  };

  const handleDeleteClick = (creation: Creation) => {
    setSelectedCreation(creation);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCreation) return;
    await deleteCreation(selectedCreation.id);
    setDeleteDialogOpen(false);
    setSelectedCreation(null);
  };

  const getTypeIcon = (type: CreationType) => {
    switch (type) {
      case 'activity':
        return <Sparkles className="h-4 w-4" />;
      case 'coloring_page':
        return <Palette className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: CreationType) => {
    switch (type) {
      case 'activity':
        return 'Activity';
      case 'coloring_page':
        return 'Coloring Page';
      default:
        return type;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard/kids-hub")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Creations Library</h1>
              <p className="text-muted-foreground">
                All your Kids Hub creations in one place
              </p>
            </div>
          </div>
          <Button onClick={() => setNewFolderDialogOpen(true)} variant="outline" className="gap-2">
            <FolderPlus className="h-4 w-4" />
            New Folder
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search creations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | CreationType)}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="activity">Activities</SelectItem>
              <SelectItem value="coloring_page">Coloring Pages</SelectItem>
            </SelectContent>
          </Select>

          {/* Folder Filter */}
          <Select value={folderFilter} onValueChange={setFolderFilter}>
            <SelectTrigger className="w-[150px]">
              <FolderOpen className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Folders</SelectItem>
              <SelectItem value="unsorted">Unsorted</SelectItem>
              {folders.map(folder => (
                <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Ownership Filter */}
          <Select value={ownershipFilter} onValueChange={(v) => setOwnershipFilter(v as 'all' | 'mine' | 'shared')}>
            <SelectTrigger className="w-[150px]">
              <Users className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ownership" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="mine">My Creations</SelectItem>
              <SelectItem value="shared">Shared with Me</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'newest' | 'oldest' | 'title')}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="title">A–Z</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className={cn(
            viewMode === 'grid' 
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
              : "space-y-2"
          )}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className={viewMode === 'grid' ? "h-48" : "h-16"} />
            ))}
          </div>
        ) : creations.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No creations yet</h3>
                <p className="text-muted-foreground">
                  Start creating activities or coloring pages in Kids Hub!
                </p>
              </div>
              <Button onClick={() => navigate('/dashboard/kids-hub')}>
                Go to Kids Hub
              </Button>
            </div>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {creations.map(creation => (
              <CreationCard
                key={creation.id}
                creation={creation}
                onOpen={handleOpenCreation}
                onShare={handleShareClick}
                onMove={handleMoveClick}
                onDelete={handleDeleteClick}
                getTypeIcon={getTypeIcon}
                getTypeLabel={getTypeLabel}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {creations.map(creation => (
              <CreationListItem
                key={creation.id}
                creation={creation}
                onOpen={handleOpenCreation}
                onShare={handleShareClick}
                onMove={handleMoveClick}
                onDelete={handleDeleteClick}
                getTypeIcon={getTypeIcon}
                getTypeLabel={getTypeLabel}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Organize your creations into folders
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Creation</DialogTitle>
            <DialogDescription>
              Choose who can view and export this creation
            </DialogDescription>
          </DialogHeader>
          {familyMembers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No family members to share with
            </p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {familyMembers.map(member => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={currentShares.includes(member.id)}
                      onCheckedChange={() => handleToggleShare(member.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </label>
                ))}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button onClick={() => setShareDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to Folder Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogDescription>
              Select a folder for this creation
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => handleMoveToFolder(null)}
              >
                <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                Unsorted
              </Button>
              {folders.map(folder => (
                <Button
                  key={folder.id}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleMoveToFolder(folder.id)}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {folder.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Creation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedCreation?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Privacy onboarding tooltip - shown once per user */}
      <CreationsPrivacyTooltip />
    </DashboardLayout>
  );
};

// Creation Card Component
interface CreationItemProps {
  creation: Creation;
  onOpen: (creation: Creation) => void;
  onShare: (creation: Creation) => void;
  onMove: (creation: Creation) => void;
  onDelete: (creation: Creation) => void;
  getTypeIcon: (type: CreationType) => React.ReactNode;
  getTypeLabel: (type: CreationType) => string;
}

const CreationCard = ({ creation, onOpen, onShare, onMove, onDelete, getTypeIcon, getTypeLabel }: CreationItemProps) => {
  return (
    <Card className="group overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div 
        className="aspect-video bg-muted relative cursor-pointer"
        onClick={() => onOpen(creation)}
      >
        {creation.thumbnail_url ? (
          <img 
            src={creation.thumbnail_url} 
            alt={creation.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {getTypeIcon(creation.type)}
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge variant="secondary" className="gap-1 text-xs">
            {getTypeIcon(creation.type)}
            {getTypeLabel(creation.type)}
          </Badge>
        </div>
        
        {!creation.is_owner && (
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="bg-background/80 gap-1 text-xs">
              <Users className="h-3 w-3" />
              Shared
            </Badge>
          </div>
        )}
      </div>
      
      {/* Info */}
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{creation.title}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              {format(new Date(creation.created_at), 'MMM d, yyyy')}
              {creation.folder && (
                <>
                  <span>•</span>
                  <FolderOpen className="h-3 w-3" />
                  <span className="truncate">{creation.folder.name}</span>
                </>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpen(creation)}>
                <Eye className="h-4 w-4 mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </DropdownMenuItem>
              
              {creation.is_owner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onShare(creation)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMove(creation)}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Move to Folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDelete(creation)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
              
              {!creation.is_owner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    <Lock className="h-4 w-4 mr-2" />
                    View only
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};

const CreationListItem = ({ creation, onOpen, onShare, onMove, onDelete, getTypeIcon, getTypeLabel }: CreationItemProps) => {
  return (
    <Card className="group hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-4 p-3">
        {/* Thumbnail */}
        <div 
          className="h-12 w-16 bg-muted rounded flex items-center justify-center flex-shrink-0 cursor-pointer"
          onClick={() => onOpen(creation)}
        >
          {creation.thumbnail_url ? (
            <img 
              src={creation.thumbnail_url} 
              alt={creation.title}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            getTypeIcon(creation.type)
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate cursor-pointer" onClick={() => onOpen(creation)}>
              {creation.title}
            </h3>
            {!creation.is_owner && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Users className="h-3 w-3" />
                Shared
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <Badge variant="secondary" className="gap-1 text-xs h-5">
              {getTypeIcon(creation.type)}
              {getTypeLabel(creation.type)}
            </Badge>
            <span>•</span>
            {format(new Date(creation.created_at), 'MMM d, yyyy')}
            {creation.folder && (
              <>
                <span>•</span>
                <FolderOpen className="h-3 w-3" />
                <span className="truncate">{creation.folder.name}</span>
              </>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpen(creation)}>
              <Eye className="h-4 w-4 mr-2" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </DropdownMenuItem>
            
            {creation.is_owner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onShare(creation)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove(creation)}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Move to Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete(creation)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
            
            {!creation.is_owner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-muted-foreground">
                  <Lock className="h-4 w-4 mr-2" />
                  View only
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
};

const CreationsLibraryPage = () => {
  return (
    <RoleGate requireParent>
      <CreationsLibraryContent />
    </RoleGate>
  );
};

export default CreationsLibraryPage;
