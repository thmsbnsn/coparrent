import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, Calendar, User, Tag, ArrowRight, Clock3 } from "lucide-react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PublicLayout } from "@/components/landing/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareDialog } from "@/components/blog/ShareDialog";
import { BlogContent } from "@/components/blog/BlogContent";
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

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Determine if this is a public or dashboard route
  const isPublicRoute = location.pathname.startsWith("/blog/");
  const backLink = isPublicRoute ? "/blog" : "/dashboard/blog";
  const Layout = isPublicRoute ? PublicLayout : DashboardLayout;

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;

      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();

      if (!error && data) {
        setPost(data);
      }
      setLoading(false);
    };

    fetchPost();
  }, [slug]);

  const readingTime = useMemo(() => {
    if (!post) return null;

    const wordCount = post.content.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(wordCount / 220));
  }, [post]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <h2 className="text-xl font-display font-bold">Article not found</h2>
          <Button asChild>
            <Link to={backLink}>Back to Blog</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Back Button */}
        <Button variant="ghost" className="rounded-2xl px-3" asChild>
          <Link to={backLink}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>
        </Button>

        {/* Article Header */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="overflow-hidden rounded-[2.4rem] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] shadow-[0_30px_70px_-44px_rgba(8,21,47,0.45)] dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.16),transparent_32%),linear-gradient(180deg,rgba(10,16,27,0.98),rgba(12,18,31,0.96))]">
            {post.featured_image ? (
              <div className="aspect-[16/8.4] overflow-hidden border-b border-border/70 bg-muted">
                <img
                  src={post.featured_image}
                  alt={post.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            <div className="space-y-6 px-6 py-7 sm:px-8 sm:py-8 lg:px-10">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {post.category}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {post.author_name}
                </div>
                {post.published_at ? (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(post.published_at), "MMMM d, yyyy")}
                  </div>
                ) : null}
                {readingTime ? (
                  <div className="flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4" />
                    {readingTime} min read
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-3xl font-display font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                  {post.title}
                </h1>
                {post.excerpt ? (
                  <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                    {post.excerpt}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button className="h-11 rounded-2xl px-5" onClick={() => setShareDialogOpen(true)}>
                  <Share2 className="h-4 w-4" />
                  Share article
                </Button>
                <Button variant="outline" className="h-11 rounded-2xl px-5" asChild>
                  <Link to={backLink}>More articles</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-[0_28px_60px_-46px_rgba(8,21,47,0.45)] sm:p-8 lg:p-10">
            <BlogContent content={post.content} />
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 border-t border-border/70 pt-6">
              <Tag className="w-4 h-4 text-muted-foreground" />
              {post.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="rounded-full border-border/70">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="mx-auto rounded-[1.75rem] border border-border/70 bg-muted/25 p-6 lg:max-w-3xl lg:p-8">
            <h2 className="text-2xl font-display font-bold mb-3">Need product-specific help?</h2>
            <p className="text-muted-foreground leading-relaxed mb-5 max-w-2xl">
              The blog is for guidance and perspective. If you need setup instructions,
              billing help, or answers about records and exports, the Help Center is the better path.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link to="/help" className="flex items-center gap-2">
                  Visit Help Center
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={backLink}>Back to articles</Link>
              </Button>
            </div>
          </div>
        </motion.article>
      </div>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title={post.title}
        url={window.location.href}
      />
    </Layout>
  );
};

export default BlogPostPage;
