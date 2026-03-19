import { useState } from "react";
import { Link as LinkIcon, MessageSquare, Copy, Check } from "lucide-react";
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
      icon: "📘",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: "X (Twitter)",
      icon: "𝕏",
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
    {
      name: "LinkedIn",
      icon: "💼",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: "Pinterest",
      icon: "📌",
      url: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this article</DialogTitle>
          <DialogDescription>Share "{title}" with your network or co-parent</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Social Media Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {shareLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <span className="text-lg">{link.icon}</span>
                <span className="text-sm font-medium">{link.name}</span>
              </a>
            ))}
          </div>

          {/* Share via CoParrent Message */}
          <div className="pt-2">
            <p className="text-sm font-medium mb-2">Share with your co-parent</p>
            <Button variant="outline" className="w-full" asChild>
              <Link
                to={`/dashboard/messages?share=${encodedUrl}`}
                onClick={() => onOpenChange(false)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Share via Message
              </Link>
            </Button>
          </div>

          {/* Copy Link */}
          <div className="pt-2">
            <p className="text-sm font-medium mb-2">Or copy link</p>
            <div className="flex gap-2">
              <Input value={url} readOnly className="bg-muted" />
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
