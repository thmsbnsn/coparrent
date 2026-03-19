/**
 * @page-role Reference
 * @summary-pattern Legal resource categories with search/filter
 * @ownership Public resource library (no user-specific data)
 * @court-view N/A (informational reference only)
 * 
 * LAW 1: Reference role - read-only, low cognitive load
 * LAW 2: Category tabs provide summary before individual articles
 * LAW 7: Mobile-friendly card layout with preserved hierarchy
 */
import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Scale,
  Calendar,
  Users,
  AlertTriangle,
  BookOpen,
  Filter,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SkeletonCard } from '@/components/ui/skeleton';
import { LawLibraryCard } from '@/components/law-library/LawLibraryCard';
import { LawLibraryDisclaimer } from '@/components/law-library/LawLibraryDisclaimer';
import { BackToTop } from '@/components/ui/BackToTop';
import {
  useLawLibrary,
  US_STATES,
  RESOURCE_CATEGORIES,
} from '@/hooks/useLawLibrary';

const LawLibraryPage = () => {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('by-state');

  const { resources, loading, viewResource, downloadResource } = useLawLibrary();

  const handleDisclaimerAccept = useCallback(() => {
    setDisclaimerAccepted(true);
  }, []);

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const matchesSearch =
        searchQuery === '' ||
        resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesState =
        selectedState === 'all' || resource.state === selectedState;
      
      const matchesCategory =
        selectedCategory === 'all' || resource.category === selectedCategory;

      return matchesSearch && matchesState && matchesCategory;
    });
  }, [resources, searchQuery, selectedState, selectedCategory]);

  const resourcesByState = useMemo(() => {
    const grouped: Record<string, typeof resources> = {};
    filteredResources.forEach((resource) => {
      if (!grouped[resource.state]) {
        grouped[resource.state] = [];
      }
      grouped[resource.state].push(resource);
    });
    return grouped;
  }, [filteredResources]);

  const resourcesByCategory = useMemo(() => {
    const grouped: Record<string, typeof resources> = {};
    filteredResources.forEach((resource) => {
      if (!grouped[resource.category]) {
        grouped[resource.category] = [];
      }
      grouped[resource.category].push(resource);
    });
    return grouped;
  }, [filteredResources]);

  const statesWithResources = useMemo(() => {
    return US_STATES.filter(
      (state) => state.value === 'all' || resourcesByState[state.value]?.length > 0
    );
  }, [resourcesByState]);

  const categoriesWithResources = useMemo(() => {
    return RESOURCE_CATEGORIES.filter(
      (cat) => cat.value === 'all' || resourcesByCategory[cat.value]?.length > 0
    );
  }, [resourcesByCategory]);

  return (
    <DashboardLayout>
      <LawLibraryDisclaimer onAccept={handleDisclaimerAccept} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Scale className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Law Library</h1>
                <p className="text-muted-foreground">
                  Public-domain family law resources by state
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/calendar">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar Wizard
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/children">
                <Users className="w-4 h-4 mr-2" />
                Child Profiles
              </Link>
            </Button>
          </div>
        </div>

        {/* Disclaimer Banner */}
        <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Disclaimer:</strong> This is for informational purposes only — not legal advice. 
            Consult an attorney for your specific situation. Last verified: December 2024.
          </AlertDescription>
        </Alert>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent>
                    {statesWithResources.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesWithResources.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(selectedState !== 'all' || selectedCategory !== 'all' || searchQuery) && (
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {selectedState !== 'all' && (
                  <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedState('all')}>
                    {US_STATES.find((s) => s.value === selectedState)?.label} ×
                  </Badge>
                )}
                {selectedCategory !== 'all' && (
                  <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedCategory('all')}>
                    {RESOURCE_CATEGORIES.find((c) => c.value === selectedCategory)?.label} ×
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

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="by-state">By State</TabsTrigger>
            <TabsTrigger value="by-topic">By Topic</TabsTrigger>
          </TabsList>

          <TabsContent value="by-state" className="mt-6">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filteredResources.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Resources Found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || selectedState !== 'all' || selectedCategory !== 'all'
                      ? 'Try adjusting your search or filters.'
                      : 'No law library resources are currently available.'}
                  </p>
                  {(searchQuery || selectedState !== 'all' || selectedCategory !== 'all') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedState('all');
                        setSelectedCategory('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {Object.entries(resourcesByState).map(([stateCode, stateResources]) => {
                  const stateInfo = US_STATES.find((s) => s.value === stateCode);
                  return (
                    <div key={stateCode}>
                      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        {stateInfo?.label || stateCode}
                        <Badge variant="outline" className="ml-2">
                          {stateResources.length} resource{stateResources.length !== 1 ? 's' : ''}
                        </Badge>
                      </h2>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {stateResources.map((resource) => (
                          <LawLibraryCard
                            key={resource.id}
                            resource={resource}
                            onView={viewResource}
                            onDownload={downloadResource}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="by-topic" className="mt-6">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filteredResources.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Resources Found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || selectedState !== 'all' || selectedCategory !== 'all'
                      ? 'Try adjusting your search or filters.'
                      : 'No law library resources are currently available.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {Object.entries(resourcesByCategory).map(([categoryCode, categoryResources]) => {
                  const categoryInfo = RESOURCE_CATEGORIES.find((c) => c.value === categoryCode);
                  return (
                    <div key={categoryCode}>
                      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        {categoryInfo?.label || categoryCode}
                        <Badge variant="outline" className="ml-2">
                          {categoryResources.length} resource{categoryResources.length !== 1 ? 's' : ''}
                        </Badge>
                      </h2>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {categoryResources.map((resource) => (
                          <LawLibraryCard
                            key={resource.id}
                            resource={resource}
                            onView={viewResource}
                            onDownload={downloadResource}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Stats */}
        {!loading && filteredResources.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <span>
                  <strong className="text-foreground">{filteredResources.length}</strong> resources
                </span>
                <span>
                  <strong className="text-foreground">{Object.keys(resourcesByState).length}</strong> states
                </span>
                <span>
                  <strong className="text-foreground">{Object.keys(resourcesByCategory).length}</strong> topics
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <BackToTop />
      </div>
    </DashboardLayout>
  );
};

export default LawLibraryPage;
