import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ERROR_MESSAGES } from "@/lib/errorMessages";

export interface MessageSearchResult {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_role: string;
  content: string;
  created_at: string;
  snippet: string;
}

interface UseMessageSearchOptions {
  threadId?: string | null;
  debounceMs?: number;
}

export const useMessageSearch = (options: UseMessageSearchOptions = {}) => {
  const { toast } = useToast();
  const { threadId = null, debounceMs = 300 } = options;

  const [results, setResults] = useState<MessageSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: searchError } = await supabase.rpc(
          "search_messages",
          {
            p_query: searchQuery.trim(),
            p_thread_id: threadId,
            p_limit: 30,
          }
        );

        if (searchError) {
          console.error("Search error:", searchError);
          setError("Search failed. Please try again.");
          toast({
            title: "Search Error",
            description: "Failed to search messages",
            variant: "destructive",
          });
          return;
        }

        // No longer using DOMPurify - we now use React-based highlighting
        // which is inherently safe from XSS attacks
        setResults(data as MessageSearchResult[] || []);
      } catch (err) {
        console.error("Unexpected search error:", err);
        setError(ERROR_MESSAGES.GENERIC);
      } finally {
        setLoading(false);
      }
    },
    [threadId, toast]
  );

  const debouncedSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!searchQuery.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      debounceTimerRef.current = setTimeout(() => {
        search(searchQuery);
      }, debounceMs);
    },
    [search, debounceMs]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    query,
    results,
    loading,
    error,
    search: debouncedSearch,
    clearSearch,
  };
};

// Group results by thread for display
export const groupResultsByThread = (
  results: MessageSearchResult[]
): Map<string, MessageSearchResult[]> => {
  const grouped = new Map<string, MessageSearchResult[]>();

  for (const result of results) {
    const existing = grouped.get(result.thread_id) || [];
    existing.push(result);
    grouped.set(result.thread_id, existing);
  }

  return grouped;
};
