import { Gamepad2, MessageSquareMore, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CHILD_GAME_OPTIONS } from "@/lib/childAccess";

interface ChildRestrictionsCardProps {
  allowedGameSlugs: string[];
  communicationEnabled: boolean;
  gamesEnabled: boolean;
  multiplayerEnabled: boolean;
  onAllowedGameToggle: (gameSlug: string) => void;
  onCommunicationEnabledChange: (value: boolean) => void;
  onGamesEnabledChange: (value: boolean) => void;
  onMultiplayerEnabledChange: (value: boolean) => void;
  onSave: () => void;
  onScreenTimeDailyMinutesChange: (value: string) => void;
  onScreenTimeEnabledChange: (value: boolean) => void;
  screenTimeDailyMinutes: string;
  screenTimeEnabled: boolean;
}

const RestrictionToggle = ({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onCheckedChange: (value: boolean) => void;
}) => (
  <div className="rounded-2xl border bg-background p-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  </div>
);

export const ChildRestrictionsCard = ({
  allowedGameSlugs,
  communicationEnabled,
  gamesEnabled,
  multiplayerEnabled,
  onAllowedGameToggle,
  onCommunicationEnabledChange,
  onGamesEnabledChange,
  onMultiplayerEnabledChange,
  onSave,
  onScreenTimeDailyMinutesChange,
  onScreenTimeEnabledChange,
  screenTimeDailyMinutes,
  screenTimeEnabled,
}: ChildRestrictionsCardProps) => (
  <section className="space-y-4 rounded-[1.75rem] border bg-muted/20 p-5">
    <div className="flex items-center gap-2">
      <TimerReset className="h-4 w-4 text-muted-foreground" />
      <h4 className="text-sm font-medium text-muted-foreground">Restrictions</h4>
    </div>

    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-1">
        <RestrictionToggle
          checked={screenTimeEnabled}
          description="Prepare timed child-device limits now. This lays down the family-scoped setting even before a full scheduler ships."
          label="Screen time"
          onCheckedChange={onScreenTimeEnabledChange}
        />

        <div className="rounded-2xl border bg-background p-4">
          <Label htmlFor="screen-time-minutes">Daily minutes foundation</Label>
          <Input
            id="screen-time-minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            value={screenTimeDailyMinutes}
            onChange={(event) => onScreenTimeDailyMinutesChange(event.target.value)}
            disabled={!screenTimeEnabled}
            className="mt-3"
            placeholder="60"
          />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Leave blank to keep the schedule flexible for now. The value is stored so stronger
            enforcement can be added later.
          </p>
        </div>
      </div>

      <div className="space-y-4 xl:col-span-1">
        <RestrictionToggle
          checked={communicationEnabled}
          description="This is the family-scoped communication master switch for child-safe messaging and calling surfaces."
          label="Communication"
          onCheckedChange={onCommunicationEnabledChange}
        />

        <div className="rounded-2xl border bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <MessageSquareMore className="h-4 w-4" />
            What this covers
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Messaging and calling still use their own detailed permissions, but this master setting
            lets a parent shut those child-side entry points off cleanly.
          </p>
        </div>
      </div>

      <div className="space-y-4 xl:col-span-1">
        <RestrictionToggle
          checked={gamesEnabled}
          description="Controls whether child-safe game entry points are available at all."
          label="Games"
          onCheckedChange={onGamesEnabledChange}
        />

        <RestrictionToggle
          checked={multiplayerEnabled}
          description="Allows or blocks family lobby participation for shared games like Toy Plane Dash."
          label="Multiplayer"
          onCheckedChange={onMultiplayerEnabledChange}
        />
      </div>
    </div>

    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-center gap-2">
        <Gamepad2 className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">Allowed games</p>
          <p className="text-sm text-muted-foreground">
            Game availability is explicit per child. Only enabled games should appear in child-safe
            launch surfaces.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CHILD_GAME_OPTIONS.map((game) => {
          const checked = allowedGameSlugs.includes(game.slug);

          return (
            <button
              key={game.slug}
              type="button"
              onClick={() => onAllowedGameToggle(game.slug)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                checked
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/20 hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{game.displayName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{game.slug}</p>
                </div>
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {checked ? "✓" : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" className="rounded-full" onClick={onSave}>
        Save restrictions
      </Button>
      <p className="text-sm text-muted-foreground">
        Missing family scope still blocks the save server-side. Nothing falls back across families.
      </p>
    </div>
  </section>
);
