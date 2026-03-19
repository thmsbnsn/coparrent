/**
 * @page-role Action
 * @summary-pattern Thread conversation with schedule change request handling
 * @ownership Sender attribution via neutral display names
 * @court-view PDF export for message history documentation
 * 
 * LAW 1: Action role - focused on message composition and sending
 * LAW 3: Uses resolvePersonName for neutral sender/recipient attribution
 * LAW 6: exportMessagesToPDF provides court-ready message history
 * LAW 7: Mobile-first conversation view preserves all functionality
 */
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Download, Info, FileText, Calendar, Check, X, Clock, ArrowRightLeft, UserPlus, Sparkles, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { cn } from "@/lib/utils";
import { useMessages } from "@/hooks/useMessages";
import { useScheduleRequests } from "@/hooks/useScheduleRequests";
import { MessageToneAssistant } from "@/components/messages/MessageToneAssistant";
import { Link } from "react-router-dom";
import { exportMessagesToPDF } from "@/lib/pdfExport";
import { toast } from "sonner";
import { getScheduleRequestLabel } from "@/lib/displayLabels";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTimestamp = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getRequestTypeLabel = (type: string) => {
  return getScheduleRequestLabel(type);
};

const MessagesPage = () => {
  const location = useLocation();
  const { messages, coParent, userProfile, loading, sendMessage } = useMessages();
  const { pendingRequests, respondToRequest } = useScheduleRequests();
  const [newMessage, setNewMessage] = useState("");
  const [viewMode, setViewMode] = useState<"chat" | "court">("chat");
  const [sending, setSending] = useState(false);
  const [useExpandedInput, setUseExpandedInput] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      exportMessagesToPDF(messages, userProfile, coParent);
      toast.success("Messages exported to PDF!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Handle new schedule request from navigation (legacy support)
  useEffect(() => {
    if (location.state?.newScheduleRequest) {
      // Clear the navigation state - request is now stored in DB
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSend = async () => {
    if (newMessage.trim() && !sending) {
      setSending(true);
      const success = await sendMessage(newMessage.trim());
      if (success) {
        setNewMessage("");
      }
      setSending(false);
    }
  };

  const handleRequestResponse = async (requestId: string, response: "accepted" | "declined") => {
    await respondToRequest(requestId, response);
  };


  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-7rem)] flex items-center justify-center">
          <LoadingSpinner size="lg" message="Loading messages..." />
        </div>
      </DashboardLayout>
    );
  }

  if (!coParent) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-7rem)] flex flex-col items-center justify-center gap-4">
          <UserPlus className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-xl font-display font-bold">No Co-Parent Connected</h2>
          <p className="text-muted-foreground text-center max-w-md">
            You need to invite and connect with your co-parent before you can start messaging.
          </p>
          <Link to="/settings">
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Co-Parent
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-7rem)] flex flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4"
        >
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold">Messages</h1>
            <p className="text-muted-foreground mt-1">Secure, documented communication</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "chat" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("chat")}
            >
              Chat View
            </Button>
            <Button
              variant={viewMode === "court" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("court")}
            >
              <FileText className="w-4 h-4 mr-2" />
              Court Log
            </Button>
          </div>
        </motion.div>

        {/* Pending Requests Banner */}
        <AnimatePresence>
          {pendingRequests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
                <Clock className="w-5 h-5 text-warning flex-shrink-0" />
                <div className="text-sm">
                  <strong>Pending Requests:</strong> You have {pendingRequests.length} schedule change request(s) awaiting response.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-accent/50 border border-accent-foreground/10 mb-4"
        >
          <Info className="w-5 h-5 text-accent-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-accent-foreground">
            <strong>Court-Friendly Communication:</strong> Messages are timestamped and cannot be edited after sending. 
            Keep communication factual, respectful, and focused on the children.
          </div>
        </motion.div>

        {viewMode === "chat" ? (
          /* Chat View */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col rounded-2xl border border-border bg-card overflow-hidden"
          >
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-semibold">
                  {coParent.full_name?.charAt(0) || coParent.email?.charAt(0) || "?"}
                </div>
                <div>
                  <p className="font-medium">{coParent.full_name || coParent.email}</p>
                  <p className="text-xs text-muted-foreground">Co-Parent</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting || messages.length === 0}>
                {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Export PDF
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.is_from_me ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3",
                        message.is_from_me
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p
                        className={cn(
                          "text-xs mt-2",
                          message.is_from_me ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}
                      >
                        {formatTimestamp(message.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Tone Assistant */}
            <MessageToneAssistant 
              message={newMessage} 
              onRephrase={setNewMessage}
              className="px-4 pt-4"
            />

            {/* Input */}
            <div className="p-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseExpandedInput(!useExpandedInput)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {useExpandedInput ? "Simple Input" : "Expand for AI Assist"}
                </Button>
              </div>
              
              {useExpandedInput ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Type your message... AI will help ensure it's professional and child-focused."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[100px] resize-none"
                    disabled={sending}
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSend} disabled={!newMessage.trim() || sending}>
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button onClick={handleSend} disabled={!newMessage.trim() || sending}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          /* Court Log View */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 rounded-2xl border border-border bg-card overflow-hidden"
          >
            <div className="p-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-display font-bold mb-2">Communication Log</h2>
                <p className="text-sm text-muted-foreground">
                  Official record of all messages between parties
                </p>
              </div>

              <div className="flex justify-end mb-6">
                <Button variant="outline" onClick={handleExportPDF} disabled={isExporting || messages.length === 0}>
                  {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Export as PDF
                </Button>
              </div>

              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="p-4 rounded-lg bg-muted/30 border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">
                        {message.is_from_me ? (userProfile?.full_name || "You") : (coParent.full_name || coParent.email)}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatTimestamp(message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MessagesPage;
