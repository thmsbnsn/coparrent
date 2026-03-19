import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Send, 
  Plus, 
  Trash2, 
  MessageCircle, 
  Stethoscope,
  AlertTriangle,
  Clock,
  Search,
  Pencil,
  Share2,
  MoreVertical,
  Download,
  Printer,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { RoleGate } from "@/components/gates/RoleGate";
import { ShareToFamilyDialog } from "@/components/nurse-nancy/ShareToFamilyDialog";
import { RenameThreadDialog } from "@/components/nurse-nancy/RenameThreadDialog";
import { MessageSearchDialog } from "@/components/nurse-nancy/MessageSearchDialog";
import { useNurseNancy, type NurseNancyMessage, type NurseNancyThread } from "@/hooks/useNurseNancy";
import { generateNurseNancyPdf, openNurseNancyPrintView } from "@/lib/nurseNancyExport";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Simple markdown-like rendering for messages
const renderMessageContent = (content: string) => {
  // Split by double newlines for paragraphs
  const paragraphs = content.split(/\n\n+/);
  
  return paragraphs.map((paragraph, pIdx) => {
    // Check for bullet points
    if (paragraph.includes("•") || paragraph.includes("- ")) {
      const lines = paragraph.split("\n");
      return (
        <ul key={pIdx} className="list-disc list-inside space-y-1 my-2">
          {lines.map((line, lIdx) => {
            const cleanLine = line.replace(/^[•-]\s*/, "").trim();
            if (!cleanLine) return null;
            return <li key={lIdx}>{renderInlineFormatting(cleanLine)}</li>;
          })}
        </ul>
      );
    }
    
    // Regular paragraph
    return (
      <p key={pIdx} className="my-2">
        {renderInlineFormatting(paragraph)}
      </p>
    );
  });
};

const renderInlineFormatting = (text: string) => {
  // Handle bold (**text**)
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

interface ChatMessageProps {
  message: NurseNancyMessage;
  onShare?: (content: string) => void;
}

const ChatMessage = ({ message, onShare }: ChatMessageProps) => {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-4"
      >
        <Card className="max-w-2xl border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
              <div className="text-sm">
                {renderMessageContent(message.content)}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} my-3 group`}
    >
      <div className="flex items-end gap-1">
        {/* Share button for assistant messages */}
        {!isUser && onShare && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => onShare(message.content)}
                >
                  <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share with family</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        <div
          className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          }`}
        >
          <div className="text-sm whitespace-pre-wrap">
            {isUser ? message.content : renderMessageContent(message.content)}
          </div>
          <div
            className={`text-xs mt-1 ${
              isUser ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {format(new Date(message.created_at), "h:mm a")}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ThreadSidebar = ({ 
  threads, 
  currentThreadId, 
  onSelectThread, 
  onNewChat, 
  onDeleteThread,
  onRenameThread,
  onSearch,
  searchQuery,
  onSearchQueryChange,
  loading 
}: {
  threads: NurseNancyThread[];
  currentThreadId: string | null;
  onSelectThread: (thread: NurseNancyThread) => void;
  onNewChat: () => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (thread: NurseNancyThread) => void;
  onSearch: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  loading: boolean;
}) => {
  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <Button onClick={onNewChat} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
        
        {/* Search input for filtering threads */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Filter chats..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        
        {/* Full message search button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSearch}
          className="w-full gap-2 text-xs"
        >
          <Search className="h-3.5 w-3.5" />
          Search All Messages
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchQuery ? "No matching conversations" : "No conversations yet"}
            </p>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.id}
                className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                  currentThreadId === thread.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted"
                }`}
                onClick={() => onSelectThread(thread)}
              >
                <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{thread.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(thread.updated_at), "MMM d, h:mm a")}
                  </p>
                </div>
                
                {/* Thread actions menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => onRenameThread(thread)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this conversation and all its messages.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => onDeleteThread(thread.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const NurseNancyContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [shareMessageContent, setShareMessageContent] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [threadToRename, setThreadToRename] = useState<NurseNancyThread | null>(null);
  const [exporting, setExporting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    filteredThreads,
    currentThread,
    messages,
    loading,
    sending,
    searchQuery,
    setSearchQuery,
    selectThread,
    startNewChat,
    sendMessage,
    deleteThread,
    renameThread,
  } = useNurseNancy();

  // Export handlers
  const handleExportPdf = async () => {
    if (!currentThread || messages.length === 0) return;
    setExporting(true);
    try {
      await generateNurseNancyPdf(currentThread, messages);
      toast({
        title: "PDF Downloaded",
        description: "Your conversation has been saved as a PDF.",
      });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "Export Failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (!currentThread || messages.length === 0) return;
    try {
      openNurseNancyPrintView(currentThread, messages);
    } catch (error) {
      console.error("Print error:", error);
      toast({
        title: "Print Failed",
        description: error instanceof Error ? error.message : "Could not open print view.",
        variant: "destructive",
      });
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when thread changes
  useEffect(() => {
    if (currentThread) {
      inputRef.current?.focus();
    }
  }, [currentThread]);

  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;
    const message = inputValue.trim();
    setInputValue("");
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = async () => {
    await startNewChat();
  };

  const handleShare = (content: string) => {
    setShareMessageContent(content);
    setShareDialogOpen(true);
  };

  const handleRenameClick = (thread: NurseNancyThread) => {
    setThreadToRename(thread);
    setRenameDialogOpen(true);
  };

  const handleRename = async (newTitle: string) => {
    if (!threadToRename) return false;
    return await renameThread(threadToRename.id, newTitle);
  };

  const handleSearchResult = (thread: NurseNancyThread) => {
    selectThread(thread);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Pinned Disclaimer Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs">
          <span className="text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Nurse Nancy provides general educational support only. Not medical or legal advice.</span>
          </span>
          <span className="text-amber-700 dark:text-amber-400">
            For emergencies call <strong>911</strong> (US) or your local emergency number.
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/kids-hub")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Nurse Nancy</h1>
              <p className="text-xs text-muted-foreground">AI Health Assistant</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export menu - only show when thread is active */}
          {currentThread && messages.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={exporting}>
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPdf} disabled={exporting}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-3 w-3" />
            Not Medical Advice
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 p-4 gap-4 overflow-hidden">
        {/* Sidebar - Desktop */}
        <div className="hidden md:block w-64 border rounded-lg bg-card shrink-0">
          <ThreadSidebar
            threads={filteredThreads}
            currentThreadId={currentThread?.id || null}
            onSelectThread={selectThread}
            onNewChat={handleNewChat}
            onDeleteThread={deleteThread}
            onRenameThread={handleRenameClick}
            onSearch={() => setSearchDialogOpen(true)}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            loading={loading}
          />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col border rounded-lg bg-card overflow-hidden">
          {!currentThread ? (
            // Empty state
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Stethoscope className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Welcome to Nurse Nancy</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                Get general health guidance and support for your children's wellness questions.
              </p>
              <Button onClick={handleNewChat} className="gap-2">
                <Plus className="h-4 w-4" />
                Start a New Chat
              </Button>
              
              {/* Mobile thread list */}
              {filteredThreads.length > 0 && (
                <div className="md:hidden mt-6 w-full max-w-sm">
                  <p className="text-sm font-medium mb-2">Previous Conversations</p>
                  <div className="space-y-2">
                    {filteredThreads.slice(0, 3).map((thread) => (
                      <Button
                        key={thread.id}
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={() => selectThread(thread)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span className="truncate">{thread.title}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Current thread header (mobile-friendly) */}
              <div className="md:hidden p-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{currentThread.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRenameClick(currentThread)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSearchDialogOpen(true)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <AnimatePresence>
                  {messages.map((message) => (
                    <ChatMessage 
                      key={message.id} 
                      message={message} 
                      onShare={message.role === "assistant" ? handleShare : undefined}
                    />
                  ))}
                </AnimatePresence>
                {sending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start my-3"
                  >
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-sm">Nurse Nancy is typing...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t bg-background">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your health question..."
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || sending}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {/* Privacy note + emergency reminder */}
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground text-center">
                    🔒 Avoid sharing sensitive personal information. Nurse Nancy provides general support only.
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    For emergencies, call <strong>911</strong>.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <ShareToFamilyDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        messageContent={shareMessageContent}
      />
      
      <RenameThreadDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        currentTitle={threadToRename?.title || ""}
        onRename={handleRename}
      />
      
      <MessageSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectResult={handleSearchResult}
      />
    </div>
  );
};

const NurseNancyPage = () => {
  return (
    <DashboardLayout>
      <RoleGate requireParent restrictedMessage="Nurse Nancy is only available to parents and guardians.">
        <PremiumFeatureGate featureName="Nurse Nancy">
          <NurseNancyContent />
        </PremiumFeatureGate>
      </RoleGate>
    </DashboardLayout>
  );
};

export default NurseNancyPage;
