import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, User, Share2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { useState } from "react";
import { ShareDialog } from "./ShareDialog";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  author_name: string;
  category: string;
  published_at: string | null;
}

interface BlogCardProps {
  post: BlogPost;
  index?: number;
  isPublic?: boolean;
}

export const BlogCard = ({ post, index = 0, isPublic = false }: BlogCardProps) => {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const postPath = isPublic ? `/blog/${post.slug}` : `/dashboard/blog/${post.slug}`;
  const postUrl = `${window.location.origin}${postPath}`;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <SectionCard variant="standard" interactive className="group overflow-hidden p-0">
          <Link to={postPath}>
            <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
              {post.featured_image ? (
                <img
                  src={post.featured_image}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-primary/15 via-background to-primary/5 p-5">
                  <StatusPill variant="scope" className="w-fit">
                    {post.category}
                  </StatusPill>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      CoParrent Journal
                    </p>
                    <p className="line-clamp-3 text-lg font-display font-semibold leading-snug text-foreground">
                      {post.title}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Link>

          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <StatusPill variant="scope">{post.category}</StatusPill>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  setShareDialogOpen(true);
                }}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>

            <Link to={postPath}>
              <h3 className="line-clamp-2 text-lg font-display font-semibold leading-snug transition-colors group-hover:text-primary">
                {post.title}
              </h3>
            </Link>

            {post.excerpt && (
              <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
            )}

            <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {post.author_name}
              </div>
              {post.published_at && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(post.published_at), "MMM d, yyyy")}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </motion.div>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title={post.title}
        url={postUrl}
      />
    </>
  );
};
