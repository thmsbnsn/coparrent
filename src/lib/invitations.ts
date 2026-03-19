export interface InvitationStatusInput {
  status: string | null | undefined;
  expiresAt: string | null | undefined;
}

export type InvitationViewStatus = "valid" | "accepted" | "expired" | "invalid";

export const getInvitationViewStatus = (
  invitation: InvitationStatusInput | null | undefined,
  now: Date = new Date(),
): InvitationViewStatus => {
  if (!invitation) {
    return "invalid";
  }

  if (invitation.status === "accepted") {
    return "accepted";
  }

  if (invitation.status === "expired") {
    return "expired";
  }

  if (!invitation.expiresAt) {
    return "invalid";
  }

  return new Date(invitation.expiresAt) < now ? "expired" : "valid";
};

export const hasInviteEmailMismatch = (
  inviteeEmail: string | null | undefined,
  currentUserEmail: string | null | undefined,
): boolean =>
  Boolean(
    inviteeEmail &&
      currentUserEmail &&
      inviteeEmail.toLowerCase() !== currentUserEmail.toLowerCase(),
  );
