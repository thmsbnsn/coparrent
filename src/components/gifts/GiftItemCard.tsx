import { motion } from "framer-motion";
import { 
  Gift, 
  ExternalLink, 
  Check, 
  User, 
  MoreVertical,
  Edit,
  Trash2,
  ShoppingCart,
  X
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GiftItem, GIFT_CATEGORIES } from "@/hooks/useGiftLists";
import { cn } from "@/lib/utils";

interface GiftItemCardProps {
  item: GiftItem;
  isParent: boolean;
  profileId: string | null;
  allowMultipleClaims: boolean;
  onClaim: () => void;
  onUnclaim: () => void;
  onMarkPurchased: (purchased: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "toy":
      return "🧸";
    case "clothing":
      return "👕";
    case "experience":
      return "🎟️";
    case "book":
      return "📚";
    case "electronics":
      return "🎮";
    default:
      return "🎁";
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "claimed":
      return <Badge variant="secondary">Claimed</Badge>;
    case "purchased":
      return <Badge variant="default" className="bg-green-600">Purchased</Badge>;
    default:
      return <Badge variant="outline">Available</Badge>;
  }
};

export const GiftItemCard = ({
  item,
  isParent,
  profileId,
  allowMultipleClaims,
  onClaim,
  onUnclaim,
  onMarkPurchased,
  onEdit,
  onDelete,
}: GiftItemCardProps) => {
  const categoryLabel = GIFT_CATEGORIES.find(c => c.value === item.category)?.label || "Other";
  const isClaimedByMe = item.claimed_by === profileId;
  const canClaim = item.status === "unclaimed" || (allowMultipleClaims && !isClaimedByMe);
  const canUnclaim = isClaimedByMe && item.status !== "purchased";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={cn(
        "transition-all",
        item.status === "purchased" && "opacity-75",
        item.status === "claimed" && "border-secondary",
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="text-2xl">{getCategoryIcon(item.category)}</div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-base">{item.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {categoryLabel}
                    </Badge>
                    {item.suggested_age_range && (
                      <span className="text-xs text-muted-foreground">
                        Ages {item.suggested_age_range}
                      </span>
                    )}
                  </div>
                </div>
                {getStatusBadge(item.status)}
              </div>

              {item.notes && (
                <p className="text-sm text-muted-foreground mt-2">
                  {item.notes}
                </p>
              )}

              {isParent && item.parent_only_notes && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 italic">
                  🔒 {item.parent_only_notes}
                </p>
              )}

              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                  View link
                </a>
              )}

              {(item.claimed_by_name || item.status !== "unclaimed") && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                  <User className="w-3 h-3" />
                  {item.claimed_by_name 
                    ? `Claimed by ${isClaimedByMe ? "you" : item.claimed_by_name}`
                    : "Claimed"}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Claim/Unclaim button */}
              {canClaim && (
                <Button size="sm" variant="outline" onClick={onClaim}>
                  <Gift className="w-4 h-4 mr-1" />
                  Claim
                </Button>
              )}
              
              {canUnclaim && (
                <Button size="sm" variant="ghost" onClick={onUnclaim}>
                  <X className="w-4 h-4 mr-1" />
                  Unclaim
                </Button>
              )}

              {isClaimedByMe && item.status === "claimed" && (
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => onMarkPurchased(true)}
                >
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Purchased
                </Button>
              )}

              {isParent && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    {item.purchased && (
                      <DropdownMenuItem onClick={() => onMarkPurchased(false)}>
                        <X className="w-4 h-4 mr-2" />
                        Unmark purchased
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
