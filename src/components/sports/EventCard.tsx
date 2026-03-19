import { useState } from "react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Navigation, 
  MapPin,
  Clock,
  User,
  Ban,
  Clipboard,
  ChevronDown,
  ChevronUp
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
import { DirectionsDialog } from "./DirectionsDialog";
import { ActivityEvent, EVENT_TYPES } from "@/hooks/useSportsActivities";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: ActivityEvent;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export const EventCard = ({ 
  event, 
  onEdit, 
  onCancel, 
  onDelete,
}: EventCardProps) => {
  const [showDirections, setShowDirections] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const eventTypeLabel = EVENT_TYPES.find(t => t.value === event.event_type)?.label || event.event_type;
  const eventDate = parseISO(event.event_date);
  const isEventToday = isToday(eventDate);
  const isEventTomorrow = isTomorrow(eventDate);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, "h:mm a");
  };

  const getDateLabel = () => {
    if (isEventToday) return "Today";
    if (isEventTomorrow) return "Tomorrow";
    return format(eventDate, "EEE, MMM d");
  };

  const hasDetails = event.venue_notes || event.notes || event.equipment_needed.length > 0;

  return (
    <>
      <Card className={cn(
        "overflow-hidden transition-all",
        event.is_cancelled && "opacity-50"
      )}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xs font-semibold shrink-0",
                  isEventToday ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <span className="text-[10px] uppercase opacity-80">
                    {format(eventDate, "MMM")}
                  </span>
                  <span className="text-lg leading-none">{format(eventDate, "d")}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{event.title}</h3>
                    {event.is_cancelled && (
                      <Badge variant="destructive" className="text-xs">Cancelled</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {event.child_name} • {event.activity_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="shrink-0 capitalize">
                  {eventTypeLabel}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit Event
                    </DropdownMenuItem>
                    {!event.is_cancelled && (
                      <DropdownMenuItem onClick={onCancel}>
                        <Ban className="w-4 h-4 mr-2" />
                        Cancel Event
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Event
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Time and Location */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>
                  {formatTime(event.start_time)}
                  {event.end_time && ` - ${formatTime(event.end_time)}`}
                </span>
              </div>
              
              {event.location_name && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{event.location_name}</span>
                </div>
              )}
            </div>

            {/* Parent Responsibilities */}
            {(event.dropoff_parent_name || event.pickup_parent_name) && (
              <div className="flex flex-wrap gap-3 text-sm">
                {event.dropoff_parent_name && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Drop-off:</span>
                    <span className="text-xs font-medium">{event.dropoff_parent_name}</span>
                  </div>
                )}
                {event.pickup_parent_name && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Pick-up:</span>
                    <span className="text-xs font-medium">{event.pickup_parent_name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Expandable Details */}
            {hasDetails && expanded && (
              <div className="space-y-2 pt-2 border-t">
                {event.venue_notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Venue notes: </span>
                    {event.venue_notes}
                  </div>
                )}
                
                {event.equipment_needed.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Clipboard className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {event.equipment_needed.map((item) => (
                        <Badge key={item.id} variant="secondary" className="text-xs">
                          {item.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {event.notes && (
                  <div className="text-sm text-muted-foreground">
                    {event.notes}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              {event.location_address && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowDirections(true)}
                  className="gap-1.5"
                >
                  <Navigation className="w-4 h-4" />
                  Get Directions
                </Button>
              )}
              
              {hasDetails && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="gap-1 ml-auto"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      More
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <DirectionsDialog
        open={showDirections}
        onOpenChange={setShowDirections}
        address={event.location_address || ""}
        locationName={event.location_name || undefined}
      />
    </>
  );
};
