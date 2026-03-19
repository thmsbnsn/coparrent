import { useState, useMemo, useEffect } from 'react';
import { Search, Scale, Book, Filter, ArrowUpDown, Info, FileX } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LawArticleListItem } from '@/components/law-articles/LawArticleListItem';
import { BackToTop } from '@/components/ui/BackToTop';
import { useLawArticles } from '@/hooks/useLawArticles';

type FilterType = 'all' | 'core' | 'definitions' | 'repealed' | 'auth';
type SortType = 'article' | 'title';

const CORE_ARTICLES = ['17', '34', '35'];
const DEFINITION_ARTICLES = ['9'];

const FILTER_OPTIONS: { value: FilterType; label: string; tooltip: string }[] = [
  { value: 'all', label: 'All', tooltip: 'Show all 42 Indiana Code Title 31 articles' },
  { value: 'core', label: 'Core', tooltip: 'Articles 17, 34, 35 – key family law provisions' },
  { value: 'definitions', label: 'Definitions', tooltip: 'Article 9 – legal term definitions' },
  { value: 'repealed', label: 'Repealed', tooltip: 'Articles no longer in effect' },
  { value: 'auth', label: 'Auth-only', tooltip: 'Articles requiring login to view full text' },
];

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'article', label: 'Article #' },
  { value: 'title', label: 'Title A–Z' },
];

const LawArticlesPageContent = () => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('article');
  
  const { data: articles, isLoading, error } = useLawArticles();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filteredAndSortedArticles = useMemo(() => {
    if (!articles || articles.length === 0) return [];
    
    let result = [...articles];
    
    // Step 1: Apply chip filter first
    switch (activeFilter) {
      case 'core':
        result = result.filter((a) => CORE_ARTICLES.includes(a.article_number));
        break;
      case 'definitions':
        result = result.filter((a) => DEFINITION_ARTICLES.includes(a.article_number));
        break;
      case 'repealed':
        result = result.filter((a) => a.is_repealed);
        break;
      case 'auth':
        result = result.filter((a) => a.access_level === 'auth');
        break;
      // 'all' - no filtering
    }
    
    // Step 2: Apply search filter
    const searchTerm = debouncedSearch.trim().toLowerCase();
    if (searchTerm) {
      result = result.filter(
        (article) =>
          article.title.toLowerCase().includes(searchTerm) ||
          (article.summary?.toLowerCase().includes(searchTerm) ?? false)
      );
    }
    
    // Step 3: Apply sorting
    if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      result.sort((a, b) => {
        const numA = parseInt(a.article_number, 10);
        const numB = parseInt(b.article_number, 10);
        return numA - numB;
      });
    }
    
    return result;
  }, [articles, activeFilter, debouncedSearch, sortBy]);

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-12 text-center">
          <p className="text-destructive">Failed to load law articles. Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Indiana Code Title 31</h1>
            <p className="text-sm text-muted-foreground">Family Law and Juvenile Law</p>
          </div>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search by title or summary..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
            aria-label="Search law articles"
          />
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Chips */}
        <TooltipProvider delayDuration={300}>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter articles">
            <Filter className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            {FILTER_OPTIONS.map((option) => (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setActiveFilter(option.value)}
                    aria-pressed={activeFilter === option.value}
                    className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full"
                  >
                    <Badge
                      variant={activeFilter === option.value ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors hover:bg-primary/20"
                    >
                      {option.label}
                    </Badge>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>{option.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
        
        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortType)}>
            <SelectTrigger className="w-[140px]" aria-label="Sort articles by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && articles && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Book className="w-4 h-4" />
          <span>
            {filteredAndSortedArticles.length} {filteredAndSortedArticles.length === 1 ? 'article' : 'articles'}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
            {activeFilter !== 'all' && ` (${FILTER_OPTIONS.find(f => f.value === activeFilter)?.label})`}
          </span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Articles Grid */}
      {!isLoading && filteredAndSortedArticles.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedArticles.map((article, index) => (
            <LawArticleListItem key={article.id} article={article} index={index} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredAndSortedArticles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileX className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No articles found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              {debouncedSearch && activeFilter !== 'all'
                ? `No articles match "${debouncedSearch}" with the "${FILTER_OPTIONS.find(f => f.value === activeFilter)?.label}" filter.`
                : debouncedSearch
                ? `No articles match your search for "${debouncedSearch}".`
                : `No articles match the "${FILTER_OPTIONS.find(f => f.value === activeFilter)?.label}" filter.`}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {debouncedSearch && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchInput('')}
                >
                  Clear search
                </Button>
              )}
              {activeFilter !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveFilter('all')}
                >
                  Show all articles
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <BackToTop />
    </div>
  );
};

const LawArticlesPage = () => {
  return (
    <DashboardLayout>
      <FeatureErrorBoundary featureName="Law Articles">
        <LawArticlesPageContent />
      </FeatureErrorBoundary>
    </DashboardLayout>
  );
};

export default LawArticlesPage;
