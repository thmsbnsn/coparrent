/**
 * MessagingHubPage - Court-Ready Communication System
 * 
 * @page-role Evidence + Action hybrid
 * 
 * DESIGN SYSTEM ENFORCEMENT (docs/DESIGN_CONSTITUTION.md):
 * - This is NOT a chat app. This is a recorded communication system under stress.
 * - Messages may be read by attorneys, mediators, and judges.
 * - UI must de-escalate by structure, not by tone alone.
 * 
 * REQUIRED ENFORCEMENTS:
 * 1. Ownership & Attribution Clarity - Every message shows who, when, what context
 * 2. Message Hierarchy Under Stress - Content primary, emotion neutralized
 * 3. Court View First-Class - Discoverable toggle, not buried in settings
 * 4. Summary Before Scroll - Unread/action status visible immediately
 * 5. Action Discipline - Deliberate composer, no rapid-fire encouragement
 * 6. Mobile Integrity - Attribution visible, court view accessible
 * 
 * PROHIBITED PATTERNS:
 * - Chat-style bubbles ❌
 * - Emoji-first emphasis ❌
 * - Color-coded emotional framing ❌
 * - Hidden timestamps ❌
 * - Collapsed attribution ❌
 */

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Users, 
  Plus,
  Hash,
  FileText,
  UsersRound,
  Search,
  Menu,
  RefreshCw,
  Printer
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMessagingHub, MessageThread, FamilyMember } from "@/hooks/useMessagingHub";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { MessageSearch } from "@/components/messages/MessageSearch";
import { UnreadBadge } from "@/components/messages/UnreadBadge";
import { SwipeableTabs } from "@/components/messages/SwipeableTabs";
import { EvidencePanel } from "@/components/messages/EvidencePanel";
import { DeliberateComposer } from "@/components/messages/DeliberateComposer";
import { ThreadSummaryBar } from "@/components/messages/ThreadSummaryBar";
import { CourtViewToggle } from "@/components/messages/CourtViewToggle";
import { PullToRefreshIndicator } from "@/components/messages/PullToRefreshIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { resolveSenderName } from "@/lib/displayResolver";

/**
 * Role labels for attribution - RULE: No reliance on color alone
 */
const ROLE_LABELS: Record<string, string> = {
  parent: "Parent",
  guardian: "Guardian",
  third_party: "Family Member",
};

const getRoleBadge = (role: string) => {
  const label = ROLE_LABELS[role] || "Member";
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-normal">
      {label}
    </Badge>
  );
};

const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
  if (name) {
    const parts = name.split(" ");
    return parts.length >= 2 
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }
  return email?.substring(0, 2).toUpperCase() || "?";
};

const MessagingHubPage = () => {
  const {
    threads,
    groupChats,
    familyChannel,
    familyMembers,
    activeThread,
    messages,
    loading,
    role,
    profileId,
    setActiveThread,
    sendMessage,
    getOrCreateDMThread,
    createGroupChat,
    ensureFamilyChannel,
    fetchThreads,
  } = useMessagingHub();
  
  const { isThirdParty } = useFamilyRole();
  const { typingText, setTyping, clearTyping } = useTypingIndicator(activeThread?.id || null);
  const { 
    totalUnread, 
    getUnreadForThread, 
    getUnreadByType, 
    showIndicator,
    refresh: refreshUnread 
  } = useUnreadMessages();
  const isMobile = useIsMobile();
  
  // UI State
  const [showNewDM, setShowNewDM] = useState(false);
  const [activeTab, setActiveTab] = useState<"family" | "groups" | "direct">("family");
  const [selectedMembers, setSelectedMembers] = useState<FamilyMember[]>([]);
  const [showGroupConfirm, setShowGroupConfirm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  /**
   * Court View State
   * RULE: Court View is first-class, not a buried setting
   */
  const [courtView, setCourtView] = useState(false);

  // Pull-to-refresh for mobile
  const handleRefresh = useCallback(async () => {
    await fetchThreads();
    await refreshUnread();
  }, [fetchThreads, refreshUnread]);

  const { 
    isRefreshing, 
    pullDistance, 
    bindEvents 
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: isMobile,
  });

  // Initialize family channel
  useEffect(() => {
    if (!loading && !familyChannel) {
      ensureFamilyChannel();
    }
  }, [loading, familyChannel, ensureFamilyChannel]);

  // Set family channel as default active thread
  useEffect(() => {
    if (familyChannel && !activeThread) {
      setActiveThread(familyChannel);
    }
  }, [familyChannel, activeThread, setActiveThread]);

  /**
   * Handle message send - deliberate action
   * RULE: Action discipline - no rapid-fire encouragement
   */
  const handleSend = useCallback(async (message: string) => {
    clearTyping();
    await sendMessage(message);
  }, [clearTyping, sendMessage]);

  /**
   * Export to PDF - Court-ready document
   * RULE: Preserves attribution and order, print-safe
   */
  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    
    // Header with thread context
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Message Record", 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Thread: ${activeThread?.name || getThreadDisplayName(activeThread)}`, 14, 28);
    doc.text(`Exported: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, 14, 34);
    doc.text(`Total Messages: ${messages.length}`, 14, 40);

    // Messages table - full attribution
    const tableData = messages.map((msg) => [
      format(new Date(msg.created_at), "MMM d, yyyy h:mm a"),
      resolveSenderName(msg.sender_name),
      ROLE_LABELS[msg.sender_role] || "Member",
      msg.content,
    ]);

    autoTable(doc, {
      head: [["Date & Time", "Sender", "Role", "Message Content"]],
      body: tableData,
      startY: 48,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [51, 51, 51],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: 22 },
        3: { cellWidth: "auto" },
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Page ${i} of ${pageCount} | CoParrent Message Record`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
    }

    doc.save(`messages-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`);
    toast.success("Message record exported successfully");
  }, [activeThread, messages]);

  /**
   * Print current view
   * RULE: Court View must be printable
   */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const getThreadDisplayName = (thread: MessageThread | null) => {
    if (!thread) return "Messages";
    if (thread.thread_type === "group_chat") {
      return thread.name || "Group Chat";
    }
    if (thread.thread_type === "family_channel") {
      return "Family Channel";
    }
    return thread.other_participant?.full_name || 
           thread.other_participant?.email || 
           "Direct Message";
  };

  // Thread selection handlers
  const toggleMemberSelection = (member: FamilyMember) => {
    if (member.profile_id === profileId) return;
    setSelectedMembers(prev => {
      const isSelected = prev.some(m => m.profile_id === member.profile_id);
      return isSelected 
        ? prev.filter(m => m.profile_id !== member.profile_id)
        : [...prev, member];
    });
  };

  const handleStartConversation = async () => {
    if (selectedMembers.length === 0) {
      toast.error("Please select at least one person");
      return;
    }
    
    if (selectedMembers.length > 1) {
      setShowGroupConfirm(true);
      return;
    }
    
    const member = selectedMembers[0];
    const thread = await getOrCreateDMThread(member.profile_id);
    if (thread) {
      setActiveThread({
        ...thread,
        other_participant: {
          id: member.profile_id,
          full_name: member.full_name,
          email: member.email,
          role: member.role,
        },
      });
      setShowNewDM(false);
      setSelectedMembers([]);
      setActiveTab("direct");
      setShowSidebar(false);
    }
  };

  const handleCreateGroupChat = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    
    setCreatingGroup(true);
    const thread = await createGroupChat(
      groupName.trim(),
      selectedMembers.map(m => m.profile_id)
    );
    
    if (thread) {
      setActiveThread({
        ...thread,
        participants: selectedMembers.map(m => ({
          profile_id: m.profile_id,
          full_name: m.full_name,
          email: m.email,
          avatar_url: m.avatar_url,
        })),
      });
      toast.success("Group created");
      setShowNewDM(false);
      setShowGroupConfirm(false);
      setSelectedMembers([]);
      setGroupName("");
      setActiveTab("groups");
      setShowSidebar(false);
    }
    setCreatingGroup(false);
  };

  const handleSelectThread = (thread: MessageThread) => {
    setActiveThread(thread);
    if (isMobile) setShowSidebar(false);
  };

  // Sidebar content - thread navigation
  const SidebarContent = () => {
    const tabItems = ["family", "groups", "direct"] as const;
    const familyUnread = showIndicator ? getUnreadByType("family_channel") : 0;
    const groupsUnread = showIndicator ? getUnreadByType("group_chat") : 0;
    const directUnread = showIndicator ? getUnreadByType("direct_message") : 0;

    const TabContentInner = () => (
      <>
        <TabsContent value="family" className="flex-1 m-0 p-2 overflow-auto">
          {familyChannel && (
            <button
              onClick={() => handleSelectThread(familyChannel)}
              className={cn(
                "w-full p-3 rounded-lg text-left transition-colors relative",
                activeThread?.id === familyChannel.id
                  ? "bg-muted border border-border"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Hash className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">Family Channel</p>
                  <p className="text-xs text-muted-foreground">
                    {familyMembers.length} members • Official record
                  </p>
                </div>
                {showIndicator && getUnreadForThread(familyChannel.id) > 0 && (
                  <UnreadBadge count={getUnreadForThread(familyChannel.id)} />
                )}
              </div>
            </button>
          )}

          <div className="mt-4">
            <p className="text-[10px] font-medium text-muted-foreground px-3 mb-2 uppercase tracking-wider">
              Members
            </p>
            {familyMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-3 py-2">
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="text-[10px]">
                    {getInitials(member.full_name, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {member.full_name || member.email}
                    {member.profile_id === profileId && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </p>
                </div>
                {getRoleBadge(member.role)}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="groups" className="flex-1 m-0 p-2 overflow-auto">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 mb-2 text-sm"
            onClick={() => setShowNewDM(true)}
          >
            <Plus className="w-4 h-4" />
            New Group
          </Button>

          {groupChats.map((thread) => (
            <button
              key={thread.id}
              onClick={() => handleSelectThread(thread)}
              className={cn(
                "w-full p-3 rounded-lg text-left transition-colors mb-1",
                activeThread?.id === thread.id
                  ? "bg-muted border border-border"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <UsersRound className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {thread.name || "Group"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {thread.participants?.length || 0} members
                  </p>
                </div>
                {showIndicator && getUnreadForThread(thread.id) > 0 && (
                  <UnreadBadge count={getUnreadForThread(thread.id)} />
                )}
              </div>
            </button>
          ))}

          {groupChats.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No group conversations
            </p>
          )}
        </TabsContent>

        <TabsContent value="direct" className="flex-1 m-0 p-2 overflow-auto">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 mb-2 text-sm"
            onClick={() => setShowNewDM(true)}
          >
            <Plus className="w-4 h-4" />
            New Message
          </Button>

          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => handleSelectThread(thread)}
              className={cn(
                "w-full p-3 rounded-lg text-left transition-colors mb-1",
                activeThread?.id === thread.id
                  ? "bg-muted border border-border"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarFallback className="text-sm">
                    {getInitials(
                      thread.other_participant?.full_name,
                      thread.other_participant?.email
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {thread.other_participant?.full_name || 
                     thread.other_participant?.email || 
                     "Unknown"}
                  </p>
                  {thread.other_participant?.role && (
                    <div className="mt-0.5">
                      {getRoleBadge(thread.other_participant.role)}
                    </div>
                  )}
                </div>
                {showIndicator && getUnreadForThread(thread.id) > 0 && (
                  <UnreadBadge count={getUnreadForThread(thread.id)} />
                )}
              </div>
            </button>
          ))}

          {threads.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No direct messages
            </p>
          )}
        </TabsContent>
      </>
    );

    return (
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex flex-col h-full">
        <TabsList className="grid w-full grid-cols-3 mx-2 mb-0" style={{ width: "calc(100% - 16px)" }}>
          <TabsTrigger value="family" className="gap-1 text-xs relative">
            <Hash className="w-3 h-3" />
            <span className="hidden sm:inline">Family</span>
            {familyUnread > 0 && (
              <UnreadBadge count={familyUnread} className="absolute -top-1 -right-1" />
            )}
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1 text-xs relative">
            <UsersRound className="w-3 h-3" />
            <span className="hidden sm:inline">Groups</span>
            {groupsUnread > 0 && (
              <UnreadBadge count={groupsUnread} className="absolute -top-1 -right-1" />
            )}
          </TabsTrigger>
          <TabsTrigger value="direct" className="gap-1 text-xs relative">
            <MessageSquare className="w-3 h-3" />
            <span className="hidden sm:inline">Direct</span>
            {directUnread > 0 && (
              <UnreadBadge count={directUnread} className="absolute -top-1 -right-1" />
            )}
          </TabsTrigger>
        </TabsList>

        {isMobile ? (
          <SwipeableTabs
            tabs={[...tabItems]}
            activeTab={activeTab}
            onTabChange={(t) => setActiveTab(t as typeof activeTab)}
            className="flex-1"
          >
            <TabContentInner />
          </SwipeableTabs>
        ) : (
          <TabContentInner />
        )}
      </Tabs>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TooltipProvider>
        {/* 
          Print styles for Court View
          RULE: Court View must be printable and export-safe
        */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>

        <div className={cn(
          "h-[calc(100vh-8rem)] flex flex-col",
          courtView && "print-area"
        )}>
          {/* 
            Header - Minimal, functional
            RULE: No "friendly app" aesthetics
          */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 no-print"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {isMobile && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="flex-shrink-0 relative"
                    onClick={() => setShowSidebar(true)}
                  >
                    <Menu className="w-5 h-5" />
                    {showIndicator && totalUnread > 0 && (
                      <UnreadBadge 
                        count={totalUnread} 
                        className="absolute -top-1 -right-1"
                        size="sm"
                      />
                    )}
                  </Button>
                )}
                <div className="min-w-0">
                  <h1 className="text-lg md:text-xl font-semibold truncate">
                    {isMobile && activeThread 
                      ? getThreadDisplayName(activeThread) 
                      : "Messages"}
                  </h1>
                  {!isMobile && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Recorded communication • All messages are permanent
                    </p>
                  )}
                </div>
              </div>
              
              {/* Action buttons - Court View prominently placed */}
              <div className="flex gap-1.5 flex-shrink-0">
                {isMobile && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                  </Button>
                )}
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowSearch(true)}
                  aria-label="Search messages"
                >
                  <Search className="w-4 h-4" />
                </Button>

                {/* 
                  Court View Toggle - FIRST-CLASS, NOT SECONDARY
                  RULE: Must be discoverable and intentional
                */}
                <CourtViewToggle
                  enabled={courtView}
                  onToggle={() => setCourtView(!courtView)}
                  compact={isMobile}
                />

                {activeThread && messages.length > 0 && (
                  <>
                    {courtView && (
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={handlePrint}
                        aria-label="Print messages"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size={isMobile ? "icon" : "sm"}
                      onClick={handleExportPDF}
                    >
                      <FileText className="w-4 h-4" />
                      {!isMobile && <span className="ml-2">Export</span>}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* Search Dialog */}
          <Dialog open={showSearch} onOpenChange={setShowSearch}>
            <DialogContent className="max-w-lg mx-4 md:mx-auto">
              <DialogHeader>
                <DialogTitle>Search Messages</DialogTitle>
              </DialogHeader>
              <MessageSearch
                threadId={activeThread?.id}
                onResultClick={(result) => {
                  setShowSearch(false);
                  toast.success(`Found message from ${resolveSenderName(result.sender_name)}`);
                }}
                onClose={() => setShowSearch(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Mobile Sidebar */}
          <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
            <SheetContent side="left" className="w-[300px] p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2 text-sm">
                  Conversations
                  {showIndicator && totalUnread > 0 && (
                    <UnreadBadge count={totalUnread} size="md" />
                  )}
                </SheetTitle>
              </SheetHeader>
              <div className="h-[calc(100%-60px)]">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>

          {/* Main Content Area */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Desktop Sidebar */}
            {!isMobile && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-72 lg:w-80 flex-shrink-0 rounded-xl border border-border bg-card overflow-hidden flex flex-col no-print"
              >
                <SidebarContent />
              </motion.div>
            )}

            {/* 
              Chat Area - Evidence + Action separation
              RULE: These two may not visually blur together
            */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col min-w-0"
            >
              {/* Thread Header - Context for attribution */}
              {activeThread && (
                <div className={cn(
                  "px-4 py-3 border-b border-border flex items-center gap-3",
                  courtView && "bg-muted/30"
                )}>
                  {activeThread.thread_type === "family_channel" ? (
                    <>
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Hash className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-sm">Family Channel</h2>
                        <p className="text-[11px] text-muted-foreground">
                          Official family communication record
                        </p>
                      </div>
                    </>
                  ) : activeThread.thread_type === "group_chat" ? (
                    <>
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <UsersRound className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-sm truncate">
                          {activeThread.name || "Group"}
                        </h2>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {activeThread.participants?.map(p => p.full_name || p.email).join(", ")}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarFallback className="text-sm">
                          {getInitials(
                            activeThread.other_participant?.full_name,
                            activeThread.other_participant?.email
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-sm truncate">
                          {activeThread.other_participant?.full_name || 
                           activeThread.other_participant?.email || 
                           "Unknown"}
                        </h2>
                        {activeThread.other_participant?.role && (
                          getRoleBadge(activeThread.other_participant.role)
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 
                Thread Summary Bar
                RULE: Summary Before Scroll - users never scroll to understand urgency
              */}
              {activeThread && (
                <ThreadSummaryBar
                  unreadCount={showIndicator ? getUnreadForThread(activeThread.id) : 0}
                  totalMessages={messages.length}
                  threadType={activeThread.thread_type as "family_channel" | "group_chat" | "direct_message"}
                  courtView={courtView}
                  className="no-print"
                />
              )}

              {/* 
                EVIDENCE SECTION - Message History
                RULE: Evidence and Action must be visually separated
              */}
              <EvidencePanel
                messages={messages}
                courtView={courtView}
                className="flex-1"
              />

              {/* 
                ACTION SECTION - Deliberate Composer
                RULE: Feel deliberate, not impulsive
                RULE: Visually separate drafting from history
              */}
              {activeThread && (
                <div className="no-print">
                  <DeliberateComposer
                    onSend={handleSend}
                    onTyping={setTyping}
                    placeholder="Compose your message..."
                  />
                </div>
              )}
            </motion.div>
          </div>

          {/* New Conversation Modal */}
          <Dialog open={showNewDM && !showGroupConfirm} onOpenChange={(open) => {
            setShowNewDM(open);
            if (!open) setSelectedMembers([]);
          }}>
            <DialogContent className="max-w-md mx-4 md:mx-auto max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>New Conversation</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Select recipients:
              </p>
              <ScrollArea className="flex-1 max-h-64">
                <div className="space-y-1 pr-2">
                  {familyMembers
                    .filter((m) => m.profile_id !== profileId)
                    .map((member) => {
                      const isSelected = selectedMembers.some(m => m.profile_id === member.profile_id);
                      return (
                        <button
                          key={member.id}
                          onClick={() => toggleMemberSelection(member)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                            isSelected 
                              ? "bg-muted border border-border" 
                              : "hover:bg-muted/50 border border-transparent"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                            isSelected ? "bg-foreground border-foreground" : "border-muted-foreground/30"
                          )}>
                            {isSelected && <Check className="w-3 h-3 text-background" />}
                          </div>
                          <Avatar className="w-9 h-9 flex-shrink-0">
                            <AvatarFallback className="text-sm">
                              {getInitials(member.full_name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {member.full_name || member.email}
                            </p>
                          </div>
                          {getRoleBadge(member.role)}
                        </button>
                      );
                    })}
                </div>
              </ScrollArea>
              
              {selectedMembers.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <span className="font-medium">{selectedMembers.length} selected</span>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowNewDM(false);
                    setSelectedMembers([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleStartConversation}
                  disabled={selectedMembers.length === 0}
                >
                  {selectedMembers.length > 1 ? "Create Group" : "Start Message"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Group Creation Modal */}
          <Dialog open={showGroupConfirm} onOpenChange={setShowGroupConfirm}>
            <DialogContent className="max-w-md mx-4 md:mx-auto">
              <DialogHeader>
                <DialogTitle>Create Group</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Group Name</label>
                  <Input
                    placeholder="e.g., Schedule Coordination"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    autoFocus
                  />
                </div>
                
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {selectedMembers.length} members selected
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMembers.map((member) => (
                      <Badge key={member.profile_id} variant="secondary" className="text-xs">
                        {member.full_name || member.email}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowGroupConfirm(false)}
                  disabled={creatingGroup}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateGroupChat}
                  disabled={!groupName.trim() || creatingGroup}
                >
                  {creatingGroup ? "Creating..." : "Create Group"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default MessagingHubPage;
