import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusPill } from "@/components/ui/StatusPill";
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
    >
      <SectionCard variant="primary" className="overflow-hidden p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
              Read and share
            </p>
            <h3 className="mt-1 font-display font-semibold">CoParrent Blog</h3>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
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
                className="block rounded-[22px] border border-border/70 bg-background/55 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background/80"
              >
                <StatusPill variant="scope" size="sm">
                  {post.category}
                </StatusPill>
                <p className="mt-2 line-clamp-2 text-sm font-semibold">{post.title}</p>
                {post.excerpt && (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{post.excerpt}</p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">No blog posts yet</p>
        )}

        <Button variant="ghost" className="mt-4 w-full rounded-2xl bg-background/45 hover:bg-background/70" asChild>
          <Link to="/dashboard/blog">
            View All Articles
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </SectionCard>
    </motion.div>
  );
};
