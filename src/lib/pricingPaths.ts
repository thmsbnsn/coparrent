export type PricingEntrySource = "dashboard-subscription-banner";

export type PricingEntryIntent =
  | "trial-ending"
  | "trial-expired"
  | "upgrade-power";

interface BuildPricingPathOptions {
  intent?: PricingEntryIntent;
  source?: PricingEntrySource;
}

export const buildPricingPath = ({
  intent,
  source,
}: BuildPricingPathOptions = {}) => {
  const params = new URLSearchParams();

  if (source) {
    params.set("source", source);
  }

  if (intent) {
    params.set("intent", intent);
  }

  const query = params.toString();
  return query ? `/pricing?${query}` : "/pricing";
};

export const getPricingIntentCopy = (
  source: string | null,
  intent: string | null,
) => {
  if (source !== "dashboard-subscription-banner") {
    return null;
  }

  switch (intent) {
    case "trial-ending":
      return {
        description:
          "Your dashboard free trial is nearing its end. Power keeps Expenses, Court Exports, Sports Hub, and the advanced family workflow tools active without interrupting the rest of your workspace.",
        title: "Your dashboard trial is ending soon",
      };
    case "trial-expired":
      return {
        description:
          "Your dashboard trial has ended. Upgrade to restore the Power tools that were available during the trial.",
        title: "Your dashboard trial has ended",
      };
    case "upgrade-power":
      return {
        description:
          "You came here from the dashboard upgrade prompt. Power adds the paid family tools while keeping the rest of the workspace in the same flow.",
        title: "Upgrade the dashboard to Power",
      };
    default:
      return null;
  }
};
