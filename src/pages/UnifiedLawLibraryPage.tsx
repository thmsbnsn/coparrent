import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Scale,
  BookOpen,
  FileText,
  Download,
  Eye,
  ChevronDown,
  ChevronRight,
  Filter,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LawLibraryDisclaimer } from '@/components/law-library/LawLibraryDisclaimer';
import { BackToTop } from '@/components/ui/BackToTop';
import { useLawLibrary, US_STATES, RESOURCE_CATEGORIES } from '@/hooks/useLawLibrary';
import { useLawArticles, LawArticle } from '@/hooks/useLawArticles';

// Combined resource type for unified display
interface UnifiedResource {
  id: string;
  title: string;
  description: string | null;
  state: string;
  type: 'article' | 'pdf';
  href?: string;
  article?: LawArticle;
  pdf?: {
    file_name: string;
    file_path: string;
    file_size: number;
    category: string;
    last_verified_at: string;
  };
}

const UnifiedLawLibraryPageContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'articles' | 'resources'>('all');
  const [expandedStates, setExpandedStates] = useState<string[]>([]);

  // Redirect from old /resources URL
  useEffect(() => {
    if (location.pathname === '/dashboard/law-library/resources') {
      navigate('/dashboard/law-library', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Fetch data from both sources
  const { resources: pdfResources, loading: pdfLoading, viewResource, downloadResource } = useLawLibrary();
  const { data: articles, isLoading: articlesLoading } = useLawArticles();

  const loading = pdfLoading || articlesLoading;

  // Build unified resource list grouped by state
  const resourcesByState = useMemo(() => {
    const grouped: Record<string, UnifiedResource[]> = {};

    // Add Indiana articles under "IN"
    if (articles && articles.length > 0) {
      if (!grouped['IN']) grouped['IN'] = [];
      articles.forEach(article => {
        grouped['IN'].push({
          id: `article-${article.id}`,
          title: `Article ${article.article_number}: ${article.title}`,
          description: article.summary,
          state: 'IN',
          type: 'article',
          href: `/dashboard/law-library/${article.slug}`,
          article,
        });
      });
    }

    // Add PDF resources
    pdfResources.forEach(resource => {
      if (!grouped[resource.state]) grouped[resource.state] = [];
      grouped[resource.state].push({
        id: `pdf-${resource.id}`,
        title: resource.title,
        description: resource.description,
        state: resource.state,
        type: 'pdf',
        pdf: {
          file_name: resource.file_name,
          file_path: resource.file_path,
          file_size: resource.file_size,
          category: resource.category,
          last_verified_at: resource.last_verified_at,
        },
      });
    });

    return grouped;
  }, [articles, pdfResources]);

  // Filter resources based on search and tab
  const filteredByState = useMemo(() => {
    const filtered: Record<string, UnifiedResource[]> = {};
    const search = searchQuery.toLowerCase().trim();

    Object.entries(resourcesByState).forEach(([state, resources]) => {
      let stateResources = resources;

      // Filter by type tab
      if (activeTab === 'articles') {
        stateResources = stateResources.filter(r => r.type === 'article');
      } else if (activeTab === 'resources') {
        stateResources = stateResources.filter(r => r.type === 'pdf');
      }

      // Filter by search
      if (search) {
        stateResources = stateResources.filter(
          r =>
            r.title.toLowerCase().includes(search) ||
            r.description?.toLowerCase().includes(search)
        );
      }

      if (stateResources.length > 0) {
        filtered[state] = stateResources;
      }
    });

    return filtered;
  }, [resourcesByState, searchQuery, activeTab]);

  // States that have content (sorted alphabetically by label)
  const statesWithContent = useMemo(() => {
    return Object.keys(filteredByState)
      .map(code => {
        const stateInfo = US_STATES.find(s => s.value === code);
        return {
          code,
          label: stateInfo?.label || code,
          count: filteredByState[code].length,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredByState]);

  // Total counts
  const totalArticles = useMemo(() => articles?.length || 0, [articles]);
  const totalPdfs = useMemo(() => pdfResources.length, [pdfResources]);
  const totalFiltered = useMemo(
    () => Object.values(filteredByState).reduce((sum, arr) => sum + arr.length, 0),
    [filteredByState]
  );

  const handleViewPdf = useCallback(
    (resource: UnifiedResource) => {
      if (resource.type === 'pdf' && resource.pdf) {
        viewResource({
          id: resource.id.replace('pdf-', ''),
          title: resource.title,
          description: resource.description,
          state: resource.state,
          file_name: resource.pdf.file_name,
          file_path: resource.pdf.file_path,
          file_size: resource.pdf.file_size,
          file_type: 'application/pdf',
          category: resource.pdf.category,
          source_url: null,
          last_verified_at: resource.pdf.last_verified_at,
          created_at: '',
          updated_at: '',
        });
      }
    },
    [viewResource]
  );

  const handleDownloadPdf = useCallback(
    (resource: UnifiedResource) => {
      if (resource.type === 'pdf' && resource.pdf) {
        downloadResource({
          id: resource.id.replace('pdf-', ''),
          title: resource.title,
          description: resource.description,
          state: resource.state,
          file_name: resource.pdf.file_name,
          file_path: resource.pdf.file_path,
          file_size: resource.pdf.file_size,
          file_type: 'application/pdf',
          category: resource.pdf.category,
          source_url: null,
          last_verified_at: resource.pdf.last_verified_at,
          created_at: '',
          updated_at: '',
        });
      }
    },
    [downloadResource]
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryLabel = (code: string) => {
    return RESOURCE_CATEGORIES.find(c => c.value === code)?.label || code;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Scale className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Law Library</h1>
            <p className="text-muted-foreground">
              State-specific family law references
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer Banner */}
      <Alert
        variant="default"
        className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800"
      >
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Disclaimer:</strong> This is for informational purposes only — not legal advice.
          Consult an attorney for your specific situation.
        </AlertDescription>
      </Alert>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or description..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="articles">Articles</TabsTrigger>
                <TabsTrigger value="resources">PDFs</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Active filter chips */}
          {(searchQuery || activeTab !== 'all') && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filters:</span>
              {activeTab !== 'all' && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setActiveTab('all')}>
                  {activeTab === 'articles' ? 'Articles' : 'PDFs'} ×
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery('')}>
                  "{searchQuery}" ×
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {!loading && (
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{totalFiltered}</strong> showing
          </span>
          <span>
            <strong className="text-foreground">{statesWithContent.length}</strong> state
            {statesWithContent.length !== 1 ? 's' : ''}
          </span>
          <span>
            <strong className="text-foreground">{totalArticles}</strong> articles
          </span>
          <span>
            <strong className="text-foreground">{totalPdfs}</strong> PDFs
          </span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && statesWithContent.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Resources Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {searchQuery || activeTab !== 'all'
                ? 'Try adjusting your search or filter settings.'
                : 'No law library resources are currently available.'}
            </p>
            {(searchQuery || activeTab !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* State Sections */}
      {!loading && statesWithContent.length > 0 && (
        <Accordion
          type="multiple"
          value={expandedStates}
          onValueChange={setExpandedStates}
          className="space-y-4"
        >
          {statesWithContent.map(({ code, label, count }) => (
            <AccordionItem key={code} value={code} className="border rounded-xl bg-card overflow-hidden">
              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/50 [&[data-state=open]>div>svg.chevron]:rotate-90">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground">{label}</span>
                  <Badge variant="secondary" className="ml-2">
                    {count} {count === 1 ? 'resource' : 'resources'}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="grid gap-3">
                  {filteredByState[code].map(resource => (
                    <div
                      key={resource.id}
                      className="flex items-start gap-4 p-4 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          resource.type === 'article'
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : 'bg-orange-100 dark:bg-orange-900/30'
                        }`}
                      >
                        {resource.type === 'article' ? (
                          <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {resource.type === 'article' ? (
                          <Link
                            to={resource.href!}
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {resource.title}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">{resource.title}</span>
                        )}
                        {resource.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {resource.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {resource.type === 'article' && resource.article && (
                            <>
                              <Badge
                                variant={resource.article.is_repealed ? 'destructive' : 'outline'}
                                className="text-xs"
                              >
                                {resource.article.is_repealed ? 'Repealed' : 'Active'}
                              </Badge>
                              {resource.article.access_level === 'auth' && (
                                <Badge variant="secondary" className="text-xs">
                                  Login Required
                                </Badge>
                              )}
                            </>
                          )}
                          {resource.type === 'pdf' && resource.pdf && (
                            <>
                              <span>{getCategoryLabel(resource.pdf.category)}</span>
                              <span>•</span>
                              <span>{formatFileSize(resource.pdf.file_size)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {resource.type === 'article' ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={resource.href!}>
                              <Eye className="w-4 h-4 mr-1" />
                              Read
                            </Link>
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewPdf(resource)}
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadPdf(resource)}
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <BackToTop />
    </div>
  );
};

const UnifiedLawLibraryPage = () => {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  return (
    <DashboardLayout>
      <LawLibraryDisclaimer onAccept={() => setDisclaimerAccepted(true)} />
      <FeatureErrorBoundary featureName="Law Library">
        <UnifiedLawLibraryPageContent />
      </FeatureErrorBoundary>
    </DashboardLayout>
  );
};

export default UnifiedLawLibraryPage;
