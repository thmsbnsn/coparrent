import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Filter, BookOpen, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/landing/PublicLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlogCard } from "@/components/blog/BlogCard";
import { supabase } from "@/integrations/supabase/client";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  author_name: string;
  category: string;
  tags: string[];
  published_at: string | null;
  created_at: string;
}

const BlogPage = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false });

      if (!error && data) {
        setPosts(data);
      }
      setLoading(false);
    };

    fetchPosts();
  }, []);

  const categories = [...new Set(posts.map((p) => p.category))];

  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      searchQuery === "" ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.excerpt && post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = filterCategory === "all" || post.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  const hasActiveFilters = searchQuery.trim() !== "" || filterCategory !== "all";
  const featuredPost = !hasActiveFilters ? filteredPosts[0] : null;
  const gridPosts = featuredPost ? filteredPosts.slice(1) : filteredPosts;

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="space-y-10 lg:space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto text-center"
        >
          <Badge variant="secondary" className="mb-5">
            CoParrent Blog
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-display font-bold mb-5">
            Ideas, guidance, and practical co-parenting notes
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Short articles for families trying to communicate better, stay organized,
            and handle shared custody with less friction.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Published</p>
            <p className="text-2xl font-display font-bold">{posts.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Articles currently live</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Topics</p>
            <p className="text-2xl font-display font-bold">{categories.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Communication, schedules, parenting, and more</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Need a specific answer?</p>
            <p className="text-sm text-muted-foreground mb-4">
              The Help Center is better for product questions and step-by-step support.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/help">Visit Help Center</Link>
            </Button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-3 max-w-3xl mx-auto"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search communication, schedules, transitions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {featuredPost && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-[2rem] border border-border bg-card overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="p-8 lg:p-10 flex flex-col justify-center">
                <Badge variant="secondary" className="w-fit mb-4">
                  Featured article
                </Badge>
                <h2 className="text-3xl lg:text-4xl font-display font-bold mb-4">
                  {featuredPost.title}
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  {featuredPost.excerpt}
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-8">
                  <span>{featuredPost.author_name}</span>
                  <span>•</span>
                  <span>{featuredPost.category}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild>
                    <Link to={`/blog/${featuredPost.slug}`} className="flex items-center gap-2">
                      Read article
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/help">Browse product help</Link>
                  </Button>
                </div>
              </div>
              <div className="min-h-[280px] lg:min-h-full bg-gradient-to-br from-primary/10 via-muted to-primary/5">
                {featuredPost.featured_image ? (
                  <img
                    src={featuredPost.featured_image}
                    alt={featuredPost.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full p-8 flex flex-col justify-end">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground mb-3">
                      Featured
                    </p>
                    <p className="text-2xl font-display font-semibold max-w-sm">
                      A practical read for families trying to coordinate with less friction.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {/* Blog Posts Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {gridPosts.length === 0 && !featuredPost ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <BookOpen className="w-16 h-16 text-muted-foreground" />
              <h2 className="text-xl font-display font-bold">No articles found</h2>
              <p className="text-muted-foreground text-center max-w-md">
                {searchQuery || filterCategory !== "all"
                  ? "No articles match your search criteria"
                  : "Check back soon for new content!"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {gridPosts.length > 0 && (
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-display font-bold">
                      {hasActiveFilters ? "Search results" : "Latest articles"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {gridPosts.length} article{gridPosts.length === 1 ? "" : "s"} shown
                    </p>
                  </div>
                </div>
              )}

              {gridPosts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gridPosts.map((post, index) => (
                    <BlogCard key={post.id} post={post} index={index} isPublic />
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </PublicLayout>
  );
};

export default BlogPage;
