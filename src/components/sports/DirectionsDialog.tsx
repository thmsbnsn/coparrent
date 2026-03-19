import { useState } from "react";
import { Navigation, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMapNavigation, MAP_PROVIDERS, MapProvider } from "@/hooks/useMapNavigation";

interface DirectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  locationName?: string;
}

export const DirectionsDialog = ({
  open,
  onOpenChange,
  address,
  locationName,
}: DirectionsDialogProps) => {
  const { preferences, savePreferences, openDirections } = useMapNavigation();
  const [rememberChoice, setRememberChoice] = useState(preferences.remember_choice);

  const handleSelectProvider = async (provider: MapProvider) => {
    if (rememberChoice) {
      await savePreferences(provider, true);
    }
    openDirections(address, provider);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" />
            Get Directions
          </DialogTitle>
          <DialogDescription>
            Choose your preferred navigation app
          </DialogDescription>
        </DialogHeader>

        {locationName && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm">{locationName}</p>
              <p className="text-xs text-muted-foreground truncate">{address}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 py-2">
          {MAP_PROVIDERS.map((provider) => (
            <Button
              key={provider.value}
              variant="outline"
              className="h-auto py-4 flex flex-col gap-1"
              onClick={() => handleSelectProvider(provider.value)}
            >
              <span className="text-xl">{provider.icon}</span>
              <span className="text-sm">{provider.label}</span>
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <Label htmlFor="remember" className="text-sm text-muted-foreground">
            Remember my choice
          </Label>
          <Switch
            id="remember"
            checked={rememberChoice}
            onCheckedChange={setRememberChoice}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
