import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, User, Share2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow"
      >
        {/* Featured Image */}
        <Link to={postPath}>
          <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden">
            {post.featured_image ? (
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl">📝</span>
              </div>
            )}
          </div>
        </Link>

        {/* Content */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              {post.category}
            </Badge>
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
            <h3 className="font-display font-semibold text-lg leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {post.title}
            </h3>
          </Link>

          {post.excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
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
