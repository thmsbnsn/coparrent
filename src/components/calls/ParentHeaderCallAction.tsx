import { useCallback, useMemo } from "react";
import { DashboardCallLauncher } from "@/components/calls/DashboardCallLauncher";
import { useCallSessions } from "@/hooks/useCallSessions";
import {
  useCallableFamilyMembers,
  type CallableFamilyMember,
} from "@/hooks/useCallableFamilyMembers";
import { useFamilyRole } from "@/hooks/useFamilyRole";

export const ParentHeaderCallAction = () => {
  const { activeFamilyId, isLawOffice, isParent, isThirdParty, profileId } = useFamilyRole();
  const { loading: callableLoading, members: callableMembers } = useCallableFamilyMembers();
  const {
    activeSession,
    createCall,
    incomingSession,
    sessions,
  } = useCallSessions(null);

  const dashboardOutgoingSession = useMemo(() => {
    if (!profileId) {
      return null;
    }

    return (
      sessions.find(
        (session) =>
          session.status === "ringing" &&
          session.initiator_profile_id === profileId &&
          session.source === "dashboard",
      ) ?? null
    );
  }, [profileId, sessions]);

  const handleStartDashboardCall = useCallback(
    async (contact: CallableFamilyMember, callType: "audio" | "video") => {
      await createCall({
        callType,
        calleeProfileId: contact.profileId,
        source: "dashboard",
      });
    },
    [createCall],
  );

  if (!activeFamilyId || !isParent || isThirdParty || isLawOffice) {
    return null;
  }

  return (
    <DashboardCallLauncher
      contacts={callableMembers}
      disabled={Boolean(incomingSession || dashboardOutgoingSession || activeSession)}
      loading={callableLoading}
      onStartCall={handleStartDashboardCall}
    />
  );
};
