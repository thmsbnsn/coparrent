export const AVERAGE_SPEED_MPH = 30;
export const PREP_TIME_MINUTES = 15;

export type ParentResponsibility = "Drop-off" | "Pick-up" | "Drop-off & Pick-up";

export interface ReminderEquipmentItem {
  name?: string | null;
  required?: boolean;
}

export const estimateDistance = (address: string | null): number => {
  if (!address) {
    return 10;
  }

  return 15;
};

export const getParentResponsibility = (
  parentId: string,
  dropoffParentId: string | null,
  pickupParentId: string | null,
): ParentResponsibility | null => {
  if (dropoffParentId === parentId && pickupParentId === parentId) {
    return "Drop-off & Pick-up";
  }

  if (dropoffParentId === parentId) {
    return "Drop-off";
  }

  if (pickupParentId === parentId) {
    return "Pick-up";
  }

  return null;
};

export const getRequiredEquipment = (
  equipmentNeeded: ReminderEquipmentItem[] | null | undefined,
): string[] =>
  (equipmentNeeded ?? [])
    .filter((item) => item.required && typeof item.name === "string" && item.name.trim().length > 0)
    .map((item) => item.name!.trim());

export const calculateLeaveByTime = (
  eventStartTime: string,
  distanceMiles: number,
): string => {
  const [hours, minutes] = eventStartTime.split(":").map(Number);
  const eventTimeMinutes = hours * 60 + minutes;
  const travelTimeMinutes = Math.ceil((distanceMiles / AVERAGE_SPEED_MPH) * 60);
  const totalPrepMinutes = travelTimeMinutes + PREP_TIME_MINUTES;
  const minutesPerDay = 24 * 60;
  const normalizedLeaveByMinutes =
    ((eventTimeMinutes - totalPrepMinutes) % minutesPerDay + minutesPerDay) % minutesPerDay;
  const leaveByHours = Math.floor(normalizedLeaveByMinutes / 60);
  const leaveByMins = normalizedLeaveByMinutes % 60;
  const period = leaveByHours >= 12 ? "PM" : "AM";
  const displayHours = leaveByHours % 12 || 12;

  return `${displayHours}:${leaveByMins.toString().padStart(2, "0")} ${period}`;
};
