const MISSING_FUNCTION_PREFIX = "Could not find the function public.";

export const isMissingSupabaseFunctionError = (
  message: string | null | undefined,
  functions?: string[],
) => {
  if (!message?.includes(MISSING_FUNCTION_PREFIX)) {
    return false;
  }

  if (!functions || functions.length === 0) {
    return true;
  }

  return functions.some((name) => message.includes(`public.${name}`));
};

export const normalizeFeatureAvailabilityError = (
  message: string | null | undefined,
  fallbackMessage: string,
  functions?: string[],
) => {
  if (isMissingSupabaseFunctionError(message, functions)) {
    return fallbackMessage;
  }

  return message || fallbackMessage;
};
