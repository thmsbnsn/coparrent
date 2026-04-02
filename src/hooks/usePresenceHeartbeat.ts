import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { supabase } from "@/integrations/supabase/client";
import {
  FAMILY_PRESENCE_HEARTBEAT_MS,
  type FamilyPresenceHeartbeatInput,
} from "@/lib/familyPresence";

interface UsePresenceHeartbeatOptions extends FamilyPresenceHeartbeatInput {
  enabled?: boolean;
}

const isBrowserVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

export const usePresenceHeartbeat = ({
  enabled = true,
  gameDisplayName = null,
  gameSlug = null,
  locationType,
}: UsePresenceHeartbeatOptions) => {
  const { user, loading: authLoading } = useAuth();
  const { activeFamilyId } = useFamily();
  const [scopeError, setScopeError] = useState<string | null>(null);
  const payloadRef = useRef({
    gameDisplayName,
    gameSlug,
    locationType,
  });

  useEffect(() => {
    payloadRef.current = {
      gameDisplayName,
      gameSlug,
      locationType,
    };
  }, [gameDisplayName, gameSlug, locationType]);

  const sendPresence = useCallback(
    async (presenceStatus: "active" | "inactive") => {
      if (!enabled || authLoading || !user) {
        return true;
      }

      if (!activeFamilyId) {
        setScopeError("An active family is required before updating live family presence.");
        return false;
      }

      const payload = payloadRef.current;
      const includesGameMetadata =
        presenceStatus === "active" &&
        (payload.locationType === "game" || payload.locationType === "lobby");
      const { error } = await supabase.rpc("rpc_upsert_family_presence", {
        p_family_id: activeFamilyId,
        p_game_display_name: includesGameMetadata ? payload.gameDisplayName : null,
        p_game_slug: includesGameMetadata ? payload.gameSlug : null,
        p_location_type: presenceStatus === "active" ? payload.locationType : null,
        p_presence_status: presenceStatus,
      });

      if (error) {
        console.error("Error updating family presence:", error);
        setScopeError(error.message || "Unable to update live family presence.");
        return false;
      }

      setScopeError(null);
      return true;
    },
    [activeFamilyId, authLoading, enabled, user],
  );

  useEffect(() => {
    if (!enabled || authLoading || !user || !isBrowserVisible()) {
      return;
    }

    void sendPresence("active");

    const intervalId = window.setInterval(() => {
      if (!isBrowserVisible()) {
        return;
      }

      void sendPresence("active");
    }, FAMILY_PRESENCE_HEARTBEAT_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authLoading, enabled, sendPresence, user]);

  useEffect(() => {
    if (!enabled || authLoading || !user) {
      return;
    }

    const handleVisibilityChange = () => {
      void sendPresence(isBrowserVisible() ? "active" : "inactive");
    };

    const handlePageHide = () => {
      void sendPresence("inactive");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [authLoading, enabled, sendPresence, user]);

  return {
    scopeError,
    updatePresence: sendPresence,
  };
};
