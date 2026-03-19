import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Clock, MapPin, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface ExchangeCheckinProps {
  exchangeDate: Date;
  scheduleId?: string;
  onCheckinComplete?: () => void;
}

export const ExchangeCheckin = ({ exchangeDate, scheduleId, onCheckinComplete }: ExchangeCheckinProps) => {
  const { user } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkinTime, setCheckinTime] = useState<Date | null>(null);
  const [showNotePrompt, setShowNotePrompt] = useState(false);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckin = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const now = new Date();
      
      const { error } = await supabase
        .from('exchange_checkins')
        .insert({
          user_id: user.id,
          schedule_id: scheduleId || null,
          exchange_date: format(exchangeDate, 'yyyy-MM-dd'),
          checked_in_at: now.toISOString(),
          note: null
        });

      if (error) throw error;

      setIsCheckedIn(true);
      setCheckinTime(now);
      setShowNotePrompt(true);
      toast.success("Check-in recorded!", {
        description: `Arrival confirmed at ${format(now, 'h:mm a')}`
      });
      
      onCheckinComplete?.();
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error("Failed to record check-in");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveNote = async () => {
    if (!user || !note.trim()) {
      setShowNotePrompt(false);
      return;
    }

    try {
      // Save as a private journal entry linked to this exchange
      const { error } = await supabase
        .from('journal_entries')
        .insert({
          user_id: user.id,
          content: note,
          title: `Exchange note - ${format(exchangeDate, 'MMM d, yyyy')}`,
          mood: 'neutral',
          tags: ['exchange', 'check-in']
        });

      if (error) throw error;
      
      toast.success("Note saved privately");
      setShowNotePrompt(false);
      setNote("");
    } catch (error) {
      console.error('Note save error:', error);
      toast.error("Failed to save note");
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <AnimatePresence mode="wait">
          {!isCheckedIn ? (
            <motion.div
              key="checkin-button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin className="h-4 w-4" />
                <span>Exchange on {format(exchangeDate, 'MMM d, yyyy')}</span>
              </div>
              
              <Button
                onClick={handleCheckin}
                disabled={isSubmitting}
                className="w-full bg-[#21B0FE] hover:bg-[#21B0FE]/90 text-white font-medium py-6"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {isSubmitting ? "Recording..." : "I've Arrived"}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                Tap to record your arrival time (private, no GPS)
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="checked-in"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-6 w-6" />
                <span className="font-medium">Checked In</span>
              </div>
              
              {checkinTime && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{format(checkinTime, 'h:mm a')}</span>
                </div>
              )}

              <AnimatePresence>
                {showNotePrompt && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 pt-2 border-t border-border/50"
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span>Quick note: How did the kids seem? (private)</span>
                    </div>
                    
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional: jot down any thoughts about the exchange..."
                      className="min-h-[80px] bg-background/50"
                    />
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNotePrompt(false)}
                        className="flex-1"
                      >
                        Skip
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveNote}
                        className="flex-1 bg-primary"
                        disabled={!note.trim()}
                      >
                        Save Note
                      </Button>
                    </div>
                    
                    <p className="text-xs text-muted-foreground text-center">
                      🔒 This note is completely private—only you can see it
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
