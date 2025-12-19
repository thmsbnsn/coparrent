import { useState } from "react";
import { motion } from "framer-motion";
import { X, Calendar, Clock, ArrowRightLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ScheduleChangeRequestData {
  id: string;
  type: "swap" | "transfer" | "modification";
  originalDate: string;
  proposedDate?: string;
  reason: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  fromParent: "A" | "B";
}

interface ScheduleChangeRequestProps {
  selectedDate?: Date;
  onSubmit: (request: Omit<ScheduleChangeRequestData, "id" | "status" | "createdAt" | "fromParent">) => void;
  onCancel: () => void;
}

export const ScheduleChangeRequest = ({
  selectedDate,
  onSubmit,
  onCancel,
}: ScheduleChangeRequestProps) => {
  const [type, setType] = useState<"swap" | "transfer" | "modification">("swap");
  const [originalDate, setOriginalDate] = useState(
    selectedDate ? selectedDate.toISOString().split("T")[0] : ""
  );
  const [proposedDate, setProposedDate] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!originalDate || !reason.trim()) return;

    onSubmit({
      type,
      originalDate,
      proposedDate: type !== "transfer" ? proposedDate : undefined,
      reason: reason.trim(),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold">Request Schedule Change</h2>
              <p className="text-sm text-muted-foreground">Send a request to your co-parent</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Request Type */}
          <div className="space-y-2">
            <Label>Request Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="swap">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Day Swap</span>
                  </div>
                </SelectItem>
                <SelectItem value="transfer">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Give Day to Co-Parent</span>
                  </div>
                </SelectItem>
                <SelectItem value="modification">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Time Modification</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {type === "swap" && "Exchange one of your days for a different day"}
              {type === "transfer" && "Give one of your days to your co-parent"}
              {type === "modification" && "Request a change to exchange time or location"}
            </p>
          </div>

          {/* Original Date */}
          <div className="space-y-2">
            <Label htmlFor="originalDate">
              {type === "modification" ? "Date to Modify" : "Date to Change"}
            </Label>
            <Input
              id="originalDate"
              type="date"
              value={originalDate}
              onChange={(e) => setOriginalDate(e.target.value)}
            />
          </div>

          {/* Proposed Date (for swap and modification) */}
          {type === "swap" && (
            <div className="space-y-2">
              <Label htmlFor="proposedDate">Proposed Swap Date</Label>
              <Input
                id="proposedDate"
                type="date"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Select the day you'd like to take in exchange
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Request</Label>
            <Textarea
              id="reason"
              placeholder="Please provide a brief explanation for this request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Keep it brief and factual. This will be sent to your co-parent.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-border">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!originalDate || !reason.trim()}
          >
            <Send className="w-4 h-4 mr-2" />
            Send Request
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};
