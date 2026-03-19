import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, Calendar, User, Tag } from "lucide-react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PublicLayout } from "@/components/landing/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareDialog } from "@/components/blog/ShareDialog";
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
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" asChild>
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
          {/* Featured Image */}
          {post.featured_image && (
            <div className="rounded-2xl overflow-hidden aspect-video bg-muted">
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <Badge variant="secondary">{post.category}</Badge>
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {post.author_name}
            </div>
            {post.published_at && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(post.published_at), "MMMM d, yyyy")}
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl lg:text-4xl font-display font-bold">{post.title}</h1>

          {/* Share Button */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShareDialogOpen(true)}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>

          {/* Content */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            {post.content.split("\n\n").map((paragraph, index) => {
              // Handle markdown-style bold and headers
              if (paragraph.startsWith("**") && paragraph.endsWith("**")) {
                return (
                  <h3 key={index} className="text-lg font-semibold mt-6 mb-3">
                    {paragraph.replace(/\*\*/g, "")}
                  </h3>
                );
              }
              if (paragraph.startsWith("- ")) {
                return (
                  <p key={index} className="ml-4">
                    • {paragraph.substring(2).replace(/\*\*/g, "")}
                  </p>
                );
              }
              if (paragraph.match(/^\d+\. \*\*/)) {
                return (
                  <p key={index} className="ml-4 font-medium">
                    {paragraph.replace(/\*\*/g, "")}
                  </p>
                );
              }
              return (
                <p key={index} className="mb-4">
                  {paragraph.replace(/\*\*/g, "")}
                </p>
              );
            })}
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-6 border-t border-border">
              <Tag className="w-4 h-4 text-muted-foreground" />
              {post.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
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
