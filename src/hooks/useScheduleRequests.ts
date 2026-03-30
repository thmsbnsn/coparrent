import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNotificationService } from "@/hooks/useNotificationService";
import { useFamily } from "@/contexts/FamilyContext";
import { fetchFamilyParentProfiles } from "@/lib/familyScope";
import { format } from "date-fns";

const DEFAULT_MESSAGE_DESTINATION = "/dashboard/messages";

export interface ScheduleRequest {
  id: string;
  family_id: string | null;
  request_type: string;
  original_date: string;
  proposed_date: string | null;
  reason: string | null;
  status: string;
  requester_id: string;
  recipient_id: string;
  message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRequestCreationResult {
  messageDestination: string;
  messageThreadId: string | null;
  recipientId: string;
  request: ScheduleRequest;
}

const buildMessageDestination = (threadId: string | null) =>
  threadId ? `${DEFAULT_MESSAGE_DESTINATION}?thread=${threadId}` : DEFAULT_MESSAGE_DESTINATION;

export const useScheduleRequests = () => {
  const { toast } = useToast();
  const { notifyScheduleChange, notifyScheduleResponse, showLocalNotification } = useNotificationService();
  const { activeFamilyId, isParentInActiveFamily, loading: familyLoading, profileId } = useFamily();
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfileName, setUserProfileName] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    requestVersionRef.current += 1;
    setRequests([]);

    if (!familyLoading) {
      setLoading(Boolean(activeFamilyId && profileId));
    }
  }, [activeFamilyId, familyLoading, profileId]);

  useEffect(() => {
    const fetchProfileName = async () => {
      if (!profileId) {
        setUserProfileName(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", profileId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching requester profile:", error);
        return;
      }

      setUserProfileName(data?.full_name ?? null);
    };

    void fetchProfileName();
  }, [profileId]);

  const fetchRequests = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;

    if (familyLoading) {
      return;
    }

    if (!activeFamilyId || !profileId) {
      if (requestVersion === requestVersionRef.current) {
        setRequests([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("schedule_requests")
        .select("*")
        .eq("family_id", activeFamilyId)
        .order("created_at", { ascending: false });

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (error) {
        throw error;
      }

      setRequests((data ?? []) as ScheduleRequest[]);
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      console.error("Error fetching schedule requests:", error);
      setRequests([]);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [activeFamilyId, familyLoading, profileId]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!activeFamilyId || !profileId || familyLoading) return;

    const channel = supabase
      .channel(`schedule-requests-changes-${activeFamilyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_requests",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        async (payload) => {
          const record = (payload.new ?? payload.old) as ScheduleRequest;
          const oldRecord = payload.old as { id?: string };

          if (payload.eventType === "INSERT") {
            if (record.requester_id === profileId || record.recipient_id === profileId) {
              setRequests((prev) => [record, ...prev.filter((request) => request.id !== record.id)]);

              if (record.recipient_id === profileId) {
                await showLocalNotification(
                  "Schedule Change Request",
                  `You have a new schedule change request for ${format(new Date(record.original_date), "MMM d, yyyy")}`,
                );
              }
            }
            return;
          }

          if (payload.eventType === "UPDATE") {
            setRequests((prev) => prev.map((request) => (request.id === record.id ? record : request)));

            if (record.requester_id === profileId && record.status !== "pending") {
              await showLocalNotification(
                `Schedule Request ${record.status === "accepted" ? "Accepted" : "Declined"}`,
                `Your schedule change request for ${format(new Date(record.original_date), "MMM d, yyyy")} was ${record.status}.`,
              );
            }
            return;
          }

          if (payload.eventType === "DELETE") {
            setRequests((prev) => prev.filter((request) => request.id !== oldRecord.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeFamilyId, familyLoading, profileId, showLocalNotification]);

  const resolveRecipientProfileId = useCallback(async () => {
    if (!activeFamilyId || !profileId) {
      return null;
    }

    const familyParentProfiles = await fetchFamilyParentProfiles(activeFamilyId);
    return familyParentProfiles.find((familyParent) => familyParent.profileId !== profileId)?.profileId ?? null;
  }, [activeFamilyId, profileId]);

  const resolveMessageDestination = useCallback(
    async (recipientProfileId: string) => {
      if (!activeFamilyId) {
        return {
          messageDestination: DEFAULT_MESSAGE_DESTINATION,
          messageThreadId: null,
        };
      }

      try {
        const { data, error } = await supabase.functions.invoke("create-message-thread", {
          body: {
            family_id: activeFamilyId,
            thread_type: "direct_message",
            other_profile_id: recipientProfileId,
          },
        });

        if (error || !data?.success) {
          return {
            messageDestination: DEFAULT_MESSAGE_DESTINATION,
            messageThreadId: null,
          };
        }

        const threadId = typeof data.thread?.id === "string" ? data.thread.id : null;
        return {
          messageDestination: buildMessageDestination(threadId),
          messageThreadId: threadId,
        };
      } catch (error) {
        console.error("Error preparing schedule request conversation:", error);
        return {
          messageDestination: DEFAULT_MESSAGE_DESTINATION,
          messageThreadId: null,
        };
      }
    },
    [activeFamilyId],
  );

  const createRequest = async (data: {
    request_type: string;
    original_date: string;
    proposed_date?: string;
    reason?: string;
  }): Promise<ScheduleRequestCreationResult | null> => {
    if (!profileId || !activeFamilyId || !isParentInActiveFamily) {
      toast({
        title: "Error",
        description: "You must be an active parent or guardian in this family to create a schedule request.",
        variant: "destructive",
      });
      return null;
    }

    const recipientProfileId = await resolveRecipientProfileId();

    if (!recipientProfileId) {
      toast({
        title: "Error",
        description: "An active parent or guardian recipient could not be resolved for this family.",
        variant: "destructive",
      });
      return null;
    }

    const { data: newRequest, error } = await supabase
      .from("schedule_requests")
      .insert({
        family_id: activeFamilyId,
        request_type: data.request_type,
        original_date: data.original_date,
        proposed_date: data.proposed_date || null,
        reason: data.reason || null,
        requester_id: profileId,
        recipient_id: recipientProfileId,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating schedule request:", error);
      toast({
        title: "Error",
        description: "Failed to create schedule request",
        variant: "destructive",
      });
      return null;
    }

    const senderName = userProfileName || "A parent";
    await notifyScheduleChange(
      recipientProfileId,
      senderName,
      data.request_type,
      format(new Date(data.original_date), "MMM d, yyyy"),
      data.proposed_date ? format(new Date(data.proposed_date), "MMM d, yyyy") : undefined,
    );

    const { messageDestination, messageThreadId } = await resolveMessageDestination(recipientProfileId);

    toast({
      title: "Request Sent",
      description: "Your schedule change request has been sent to the other parent or guardian in this family.",
    });

    return {
      messageDestination,
      messageThreadId,
      recipientId: recipientProfileId,
      request: newRequest as ScheduleRequest,
    };
  };

  const respondToRequest = async (requestId: string, response: "accepted" | "declined") => {
    const request = requests.find((existingRequest) => existingRequest.id === requestId);

    if (!profileId || !activeFamilyId) {
      return false;
    }

    const { error } = await supabase
      .from("schedule_requests")
      .update({ status: response, updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("recipient_id", profileId)
      .eq("family_id", activeFamilyId);

    if (error) {
      console.error("Error updating schedule request:", error);
      toast({
        title: "Error",
        description: "Failed to respond to request",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: response === "accepted" ? "Request Accepted" : "Request Declined",
      description:
        response === "accepted"
          ? "The schedule change has been approved."
          : "The schedule change has been declined.",
    });

    if (request) {
      const responderName = userProfileName || "A parent";
      await notifyScheduleResponse(
        request.requester_id,
        responderName,
        response,
        format(new Date(request.original_date), "MMM d, yyyy"),
      );
    }

    return true;
  };

  const pendingRequests = requests.filter(
    (request) => request.status === "pending" && request.recipient_id === profileId,
  );

  const myRequests = requests.filter((request) => request.requester_id === profileId);

  return {
    requests,
    pendingRequests,
    myRequests,
    loading,
    createRequest,
    respondToRequest,
    refetch: fetchRequests,
  };
};
