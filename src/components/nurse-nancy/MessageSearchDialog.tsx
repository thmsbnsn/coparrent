import { useState, useCallback, useEffect } from "react";
import { Search, MessageCircle, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useNurseNancy, type NurseNancyMessage, type NurseNancyThread } from "@/hooks/useNurseNancy";

interface SearchResult {
  message: NurseNancyMessage;
  thread: NurseNancyThread;
}

interface MessageSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectResult: (thread: NurseNancyThread) => void;
}

export function MessageSearchDialog({
  open,
  onOpenChange,
  onSelectResult,
}: MessageSearchDialogProps) {
  const { searchMessages } = useNurseNancy();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setHasSearched(false);
    }
  }, [open]);

  // Debounced search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    const searchResults = await searchMessages(query);
    setResults(searchResults);
    setSearching(false);
  }, [query, searchMessages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    onSelectResult(result.thread);
    onOpenChange(false);
  };

  const highlightMatch = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getSnippet = (content: string, searchTerm: string) => {
    const lowerContent = content.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    const index = lowerContent.indexOf(lowerSearch);
    
    if (index === -1) {
      return content.slice(0, 100) + (content.length > 100 ? "..." : "");
    }

    const start = Math.max(0, index - 40);
    const end = Math.min(content.length, index + searchTerm.length + 60);
    
    return (
      (start > 0 ? "..." : "") +
      content.slice(start, end) +
      (end < content.length ? "..." : "")
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Search Conversations
          </DialogTitle>
          <DialogDescription>
            Find messages across all your Nurse Nancy conversations
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search messages..."
              className="pl-9"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setHasSearched(false);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={searching || !query.trim()}>
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-[200px] max-h-[400px] pr-3">
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result, idx) => (
                <div
                  key={`${result.message.id}-${idx}`}
                  onClick={() => handleSelectResult(result)}
                  className="p-3 rounded-lg border hover:bg-muted cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">
                      {result.thread.title}
                    </span>
                    <Badge variant="outline" className="text-xs ml-auto shrink-0">
                      {result.message.role === "user" ? "You" : "Nancy"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {highlightMatch(getSnippet(result.message.content, query), query)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(result.message.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No messages found for "{query}"
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Enter a search term to find messages
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}