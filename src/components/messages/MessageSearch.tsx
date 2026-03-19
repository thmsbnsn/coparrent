import { useRef, useEffect, useMemo } from "react";
import { Search, X, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { resolveSenderName } from "@/lib/displayResolver";
import {
  useMessageSearch,
  MessageSearchResult,
} from "@/hooks/useMessageSearch";

interface MessageSearchProps {
  threadId?: string | null;
  onResultClick?: (result: MessageSearchResult) => void;
  onClose?: () => void;
  className?: string;
}

/**
 * Highlights search terms in text using React elements instead of HTML strings
 * This prevents XSS vulnerabilities from dangerouslySetInnerHTML
 */
const HighlightedText = ({ text, searchQuery }: { text: string; searchQuery: string }) => {
  const parts = useMemo(() => {
    if (!searchQuery.trim()) {
      return [{ text, highlight: false }];
    }

    // Split search query into words for matching
    const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0) {
      return [{ text, highlight: false }];
    }

    // Create a regex pattern that matches any of the search terms
    const escapedTerms = searchTerms.map(term => 
      term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

    const segments: { text: string; highlight: boolean }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        segments.push({ text: text.slice(lastIndex, match.index), highlight: false });
      }
      // Add matched text
      segments.push({ text: match[0], highlight: true });
      lastIndex = pattern.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push({ text: text.slice(lastIndex), highlight: false });
    }

    return segments.length > 0 ? segments : [{ text, highlight: false }];
  }, [text, searchQuery]);

  return (
    <>
      {parts.map((part, index) => 
        part.highlight ? (
          <mark key={index} className="bg-primary/20 text-foreground rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
};

export const MessageSearch = ({
  threadId,
  onResultClick,
  onClose,
  className,
}: MessageSearchProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, results, loading, error, search, clearSearch } =
    useMessageSearch({ threadId });

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleResultClick = (result: MessageSearchResult) => {
    onResultClick?.(result);
    onClose?.();
  };

  const handleClear = () => {
    clearSearch();
    inputRef.current?.focus();
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search messages..."
          value={query}
          onChange={(e) => search(e.target.value)}
          className="pl-9 pr-9"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClear}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Results */}
      <div className="mt-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Searching...
            </span>
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-destructive text-sm">
            {error}
          </div>
        )}

        {!loading && !error && query && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No messages found for "{query}"</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {resolveSenderName(result.sender_name)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(result.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    <HighlightedText text={result.content} searchQuery={query} />
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {!loading && !query && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Type to search your message history</p>
          </div>
        )}
      </div>
    </div>
  );
};
