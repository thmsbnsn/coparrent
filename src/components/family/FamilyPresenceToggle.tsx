import { useState } from "react";
import { Users } from "lucide-react";
import { FamilyPresencePanel } from "@/components/family/FamilyPresencePanel";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";
import { cn } from "@/lib/utils";

interface FamilyPresenceToggleProps {
  className?: string;
  tone?: "default" | "kids";
}

export const FamilyPresenceToggle = ({
  className,
  tone = "default",
}: FamilyPresenceToggleProps) => {
  const [open, setOpen] = useState(false);
  const { activeCount, loading, members, scopeError } = useFamilyPresence();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-11 rounded-full border-border/70 px-4 shadow-sm",
            tone === "kids"
              ? "bg-white/85 hover:bg-white"
              : "bg-background/90 hover:bg-background",
            className,
          )}
        >
          <Users className="mr-2 h-4 w-4" />
          <span className="mr-2 font-semibold">Family</span>
          <span
            className={cn(
              "inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
              activeCount > 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500",
            )}
          >
            {activeCount}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="rounded-[1.75rem] border border-border/70 bg-white/97 p-4 shadow-xl">
        <FamilyPresencePanel
          activeCount={activeCount}
          loading={loading}
          members={members}
          scopeError={scopeError}
        />
      </PopoverContent>
    </Popover>
  );
};
