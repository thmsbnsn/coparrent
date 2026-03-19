import { useState } from "react";
import { format } from "date-fns";
import { 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Calendar, 
  User, 
  Phone,
  Mail,
  ChevronRight,
  Trophy
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChildActivity, SPORT_TYPES } from "@/hooks/useSportsActivities";
import { cn } from "@/lib/utils";

interface ActivityCardProps {
  activity: ChildActivity;
  onEdit: () => void;
  onDelete: () => void;
  onViewEvents: () => void;
}

export const ActivityCard = ({ 
  activity, 
  onEdit, 
  onDelete,
  onViewEvents,
}: ActivityCardProps) => {
  const sportLabel = SPORT_TYPES.find(s => s.value === activity.sport_type)?.label || activity.sport_type;
  
  const isInSeason = activity.season_start && activity.season_end 
    ? new Date() >= new Date(activity.season_start) && new Date() <= new Date(activity.season_end)
    : true;

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all hover:shadow-md cursor-pointer group",
        !activity.is_active && "opacity-60"
      )}
      onClick={onViewEvents}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{activity.name}</h3>
              <p className="text-sm text-muted-foreground">{activity.child_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={isInSeason ? "default" : "secondary"} className="shrink-0">
              {sportLabel}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Activity
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Activity
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        {activity.team_name && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Team:</span>
            <span className="font-medium">{activity.team_name}</span>
          </div>
        )}
        
        {(activity.season_start || activity.season_end) && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>
              {activity.season_start ? format(new Date(activity.season_start), "MMM d") : "?"} 
              {" - "}
              {activity.season_end ? format(new Date(activity.season_end), "MMM d, yyyy") : "?"}
            </span>
          </div>
        )}

        {activity.coach_name && (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>Coach: {activity.coach_name}</span>
          </div>
        )}

        <div className="pt-2 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {activity.equipment_checklist.length} equipment items
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>
      </CardContent>
    </Card>
  );
};
