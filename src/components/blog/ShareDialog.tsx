import { useState } from "react";
import { MessageSquare, Copy, Check, ExternalLink, Send } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string;
}

export const ShareDialog = ({ open, onOpenChange, title, url }: ShareDialogProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);

  const shareLinks = [
    {
      name: "Facebook",
      iconLabel: "f",
      helper: "Post to your feed",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: "Reddit",
      iconLabel: "r",
      helper: "Share to a subreddit",
      url: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      name: "LinkedIn",
      iconLabel: "in",
      helper: "Share professionally",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: "X",
      iconLabel: "x",
      helper: "Share a quick post",
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "The article link has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/97 p-0 shadow-[0_32px_64px_-32px_rgba(8,21,47,0.55)] backdrop-blur-xl sm:max-w-[640px]">
        <DialogHeader>
          <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] px-6 pb-5 pt-6 dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.16),transparent_36%),linear-gradient(180deg,rgba(10,16,27,0.98),rgba(12,18,31,0.96))]">
            <DialogTitle className="font-display text-2xl">Share this article</DialogTitle>
            <DialogDescription className="mt-2 max-w-2xl text-sm leading-6">
              Share "{title}" to Facebook, Reddit, professional channels, or copy the link for a text message.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              Social sharing
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shareLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-[1.35rem] border border-border/70 bg-card/80 p-4 shadow-[0_18px_36px_-34px_rgba(8,21,47,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-accent/35"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-sm font-semibold uppercase text-primary">
                    {link.iconLabel}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{link.name}</p>
                    <p className="text-xs text-muted-foreground">{link.helper}</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </a>
            ))}
          </div>
          </div>

          <div className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                Quick send
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Use CoParrent messaging or copy the link to drop it into a text thread or email.
              </p>
            </div>

            <Button variant="outline" className="h-11 justify-start rounded-2xl" asChild>
              <Link
                to={`/dashboard/messages?share=${encodedUrl}`}
                onClick={() => onOpenChange(false)}
              >
                <MessageSquare className="h-4 w-4" />
                Share via Message
              </Link>
            </Button>

            <div className="flex gap-2">
              <Input value={url} readOnly className="h-11 rounded-2xl bg-background/80" />
              <Button variant="outline" className="h-11 rounded-2xl px-4" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
              </Button>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-accent/35 px-3 py-1 text-xs text-muted-foreground">
              <Send className="h-3.5 w-3.5 text-primary" />
              Best for text messages, email, or private sharing
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
