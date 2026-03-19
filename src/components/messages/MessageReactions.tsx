import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SmilePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface MessageReactionsProps {
  messageId: string;
  reactions?: { emoji: string; count: number; hasReacted: boolean }[];
  onReact: (messageId: string, emoji: string) => void;
  className?: string;
}

const QUICK_REACTIONS = ["👍", "❤️", "😊", "👏", "✅", "🙏"];
const ALL_EMOJIS = [
  { category: "Frequent", emojis: ["👍", "❤️", "😊", "👏", "✅", "🙏", "😂", "🎉"] },
  { category: "Emotions", emojis: ["😀", "😃", "😄", "🥰", "😍", "🤗", "😌", "😔"] },
  { category: "Gestures", emojis: ["👍", "👎", "👋", "🤝", "🙌", "👏", "💪", "🤞"] },
  { category: "Objects", emojis: ["⭐", "💡", "📅", "📝", "📞", "💼", "🏠", "🚗"] },
];

export const MessageReactions = ({
  messageId,
  reactions = [],
  onReact,
  className,
}: MessageReactionsProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);

  const handleReaction = (emoji: string) => {
    onReact(messageId, emoji);
    setIsOpen(false);
    setShowFullPicker(false);
  };

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {/* Existing reactions */}
      {reactions.map((reaction) => (
        <motion.button
          key={reaction.emoji}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleReaction(reaction.emoji)}
          className={cn(
            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs",
            "border transition-colors",
            reaction.hasReacted
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted/50 border-border hover:bg-muted"
          )}
        >
          <span>{reaction.emoji}</span>
          {reaction.count > 1 && (
            <span className="text-[10px] font-medium">{reaction.count}</span>
          )}
        </motion.button>
      ))}

      {/* Add reaction button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <SmilePlus className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side={isMobile ? "top" : "right"}
          align="start"
          className={cn(
            "p-2",
            showFullPicker ? "w-64" : "w-auto"
          )}
        >
          <AnimatePresence mode="wait">
            {!showFullPicker ? (
              <motion.div
                key="quick"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-2"
              >
                <div className="flex gap-1">
                  {QUICK_REACTIONS.map((emoji) => (
                    <motion.button
                      key={emoji}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleReaction(emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-lg"
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowFullPicker(true)}
                >
                  More...
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Choose Reaction
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setShowFullPicker(false)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                {ALL_EMOJIS.map((category) => (
                  <div key={category.category}>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                      {category.category}
                    </p>
                    <div className="grid grid-cols-8 gap-0.5">
                      {category.emojis.map((emoji) => (
                        <motion.button
                          key={emoji}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleReaction(emoji)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-base"
                        >
                          {emoji}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </PopoverContent>
      </Popover>
    </div>
  );
};
