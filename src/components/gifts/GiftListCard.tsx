import { motion } from "framer-motion";
import { Gift, Calendar, Users, MoreVertical, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GiftList, OCCASION_TYPES } from "@/hooks/useGiftLists";
import { cn } from "@/lib/utils";

interface GiftListCardProps {
  list: GiftList;
  isParent: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const getOccasionIcon = (type: string) => {
  switch (type) {
    case "birthday":
      return "🎂";
    case "christmas":
      return "🎄";
    case "holiday":
      return "🎉";
    default:
      return "🎁";
  }
};

export const GiftListCard = ({
  list,
  isParent,
  onClick,
  onEdit,
  onDelete,
}: GiftListCardProps) => {
  const occasionLabel = list.occasion_type === "custom"
    ? list.custom_occasion_name
    : OCCASION_TYPES.find(o => o.value === list.occasion_type)?.label;
  
  const progress = list.items_count 
    ? Math.round((list.claimed_count || 0) / list.items_count * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          "border-border/50 hover:border-primary/30"
        )}
        onClick={onClick}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{getOccasionIcon(list.occasion_type)}</div>
              <div>
                <CardTitle className="text-lg">
                  {list.child_name} – {occasionLabel}
                </CardTitle>
                {list.event_date && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(list.event_date), "MMMM d, yyyy")}
                  </p>
                )}
              </div>
            </div>
            {isParent && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                  }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gift className="w-4 h-4" />
                <span>{list.items_count || 0} gifts</span>
              </div>
              <Badge variant={progress === 100 ? "default" : "secondary"}>
                {list.claimed_count || 0} / {list.items_count || 0} claimed
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
            {list.allow_multiple_claims && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                Multiple claims allowed
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
