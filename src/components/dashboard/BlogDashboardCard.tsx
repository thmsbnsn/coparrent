import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
  published_at: string | null;
}

export const BlogDashboardCard = () => {
  const [latestPosts, setLatestPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, category, published_at")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(2);

      if (!error && data) {
        setLatestPosts(data);
      }
      setLoading(false);
    };

    fetchPosts();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold">CoParrent Blog</h3>
        <BookOpen className="w-5 h-5 text-muted-foreground" />
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner size="sm" />
        </div>
      ) : latestPosts.length > 0 ? (
        <div className="space-y-3">
          {latestPosts.map((post) => (
            <Link
              key={post.id}
              to={`/dashboard/blog/${post.slug}`}
              className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <p className="text-sm font-medium line-clamp-1">{post.title}</p>
              {post.excerpt && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{post.excerpt}</p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No blog posts yet</p>
      )}

      <Button variant="ghost" className="w-full mt-3" asChild>
        <Link to="/dashboard/blog">
          View All Articles
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </Button>
    </motion.div>
  );
};
