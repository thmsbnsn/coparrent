import { useState } from "react";
import { format, parseISO } from "date-fns";
import { 
  X, 
  Clock, 
  MapPin, 
  User, 
  Navigation, 
  Clipboard,
  Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DirectionsDialog } from "@/components/sports/DirectionsDialog";
import { CalendarSportsEvent } from "@/hooks/useSportsEvents";
import { cn } from "@/lib/utils";

interface SportsEventDetailProps {
  event: CalendarSportsEvent;
  onClose?: () => void;
}

export const SportsEventDetail = ({ event, onClose }: SportsEventDetailProps) => {
  const [showDirections, setShowDirections] = useState(false);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, "h:mm a");
  };

  const eventDate = parseISO(event.event_date);

  return (
    <>
      <div className="p-4 border-l border-border bg-card rounded-r-lg min-w-[320px] max-w-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{event.title}</h3>
              <p className="text-sm text-muted-foreground">
                {event.child_name} • {event.activity_name}
              </p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {/* Date & Time */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>
              {format(eventDate, "EEEE, MMMM d, yyyy")} at {formatTime(event.start_time)}
              {event.end_time && ` - ${formatTime(event.end_time)}`}
            </span>
          </div>

          {/* Event Type */}
          <Badge variant="outline" className="capitalize">
            {event.event_type}
          </Badge>

          {/* Location */}
          {event.location_name && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{event.location_name}</p>
                  {event.location_address && (
                    <p className="text-muted-foreground">{event.location_address}</p>
                  )}
                </div>
              </div>
              {event.location_address && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2"
                  onClick={() => setShowDirections(true)}
                >
                  <Navigation className="w-4 h-4" />
                  Get Directions
                </Button>
              )}
            </div>
          )}

          {/* Parent Responsibilities */}
          {(event.dropoff_parent_name || event.pickup_parent_name) && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50">
              <h4 className="text-xs font-medium text-muted-foreground uppercase">Responsibilities</h4>
              {event.dropoff_parent_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>Drop-off: <strong>{event.dropoff_parent_name}</strong></span>
                </div>
              )}
              {event.pickup_parent_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>Pick-up: <strong>{event.pickup_parent_name}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Equipment */}
          {event.equipment_needed.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                <Clipboard className="w-3.5 h-3.5" />
                Equipment Needed
              </div>
              <div className="flex flex-wrap gap-1">
                {event.equipment_needed.map((item) => (
                  <Badge key={item.id} variant="secondary" className="text-xs">
                    {item.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Venue Notes */}
          {event.venue_notes && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Venue Notes</p>
              <p>{event.venue_notes}</p>
            </div>
          )}
        </div>
      </div>

      <DirectionsDialog
        open={showDirections}
        onOpenChange={setShowDirections}
        address={event.location_address || ""}
        locationName={event.location_name || undefined}
      />
    </>
  );
};
