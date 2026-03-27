import { APP_VERSION } from "@/lib/version";

export type ProblemReportCategory = "Bug" | "Confusing / unclear" | "Feature request" | "Other";
export type ProblemReportSource = "manual" | "shake";

interface NavigatorLike {
  language?: string;
  onLine?: boolean;
  platform?: string;
  userAgent?: string;
  userAgentData?: {
    platform?: string;
  };
}

interface WindowLike {
  innerHeight?: number;
  innerWidth?: number;
  location?: {
    href?: string;
    pathname?: string;
    search?: string;
    hash?: string;
  };
  matchMedia?: (query: string) => MediaQueryList | { matches: boolean };
  navigator?: NavigatorLike & {
    standalone?: boolean;
  };
  screen?: {
    height?: number;
    width?: number;
  };
}

export interface ProblemReportPayload {
  app_version: string | null;
  category: ProblemReportCategory;
  client_timestamp: string;
  current_url: string;
  details: string;
  email: string | null;
  extra_context: Record<string, unknown>;
  is_pwa_standalone: boolean;
  motion_triggered: boolean;
  page_title: string | null;
  platform_info: string | null;
  route_path: string;
  screenshot_file_name: string | null;
  summary: string;
  trigger_source: ProblemReportSource;
  user_agent: string | null;
  viewport_height: number | null;
  viewport_width: number | null;
}

export interface BuildProblemReportPayloadInput {
  category: ProblemReportCategory;
  details: string;
  email?: string | null;
  extraContext?: Record<string, unknown>;
  motionTriggered: boolean;
  routePath: string;
  screenshotFileName?: string | null;
  source: ProblemReportSource;
  summary: string;
  timestamp?: string;
  windowRef?: WindowLike;
}

export const getBrowserProblemReportMetadata = (
  windowRef: WindowLike | undefined = globalThis.window,
  navigatorRef: NavigatorLike | undefined = globalThis.navigator,
) => {
  const pathname = windowRef?.location?.pathname ?? "";
  const search = windowRef?.location?.search ?? "";
  const hash = windowRef?.location?.hash ?? "";
  const currentUrl = windowRef?.location?.href ?? "";
  const routePath = `${pathname}${search}${hash}`;
  const viewportWidth = typeof windowRef?.innerWidth === "number" ? windowRef.innerWidth : null;
  const viewportHeight = typeof windowRef?.innerHeight === "number" ? windowRef.innerHeight : null;
  const platform =
    navigatorRef?.userAgentData?.platform ??
    windowRef?.navigator?.userAgentData?.platform ??
    navigatorRef?.platform ??
    windowRef?.navigator?.platform ??
    null;
  const standalone =
    Boolean(windowRef?.matchMedia?.("(display-mode: standalone)").matches) ||
    Boolean(windowRef?.navigator?.standalone);
  const pageTitle = typeof document !== "undefined" ? document.title || null : null;

  return {
    currentUrl,
    extraContext: {
      language: navigatorRef?.language ?? null,
      online: typeof navigatorRef?.onLine === "boolean" ? navigatorRef.onLine : null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      screen_height: windowRef?.screen?.height ?? null,
      screen_width: windowRef?.screen?.width ?? null,
    },
    pageTitle,
    platform,
    routePath,
    standalone,
    userAgent: navigatorRef?.userAgent ?? null,
    viewportHeight,
    viewportWidth,
  };
};

export const buildProblemReportPayload = ({
  category,
  details,
  email,
  extraContext,
  motionTriggered,
  routePath,
  screenshotFileName,
  source,
  summary,
  timestamp,
  windowRef,
}: BuildProblemReportPayloadInput): ProblemReportPayload => {
  const browserMetadata = getBrowserProblemReportMetadata(windowRef);
  const resolvedTimestamp = timestamp ?? new Date().toISOString();

  return {
    app_version: APP_VERSION ?? null,
    category,
    client_timestamp: resolvedTimestamp,
    current_url: browserMetadata.currentUrl,
    details: details.trim(),
    email: email?.trim() || null,
    extra_context: {
      ...browserMetadata.extraContext,
      client_timestamp: resolvedTimestamp,
      motion_triggered: motionTriggered,
      screenshot_file_name: screenshotFileName?.trim() || null,
      trigger_source: source,
      ...(extraContext ?? {}),
    },
    is_pwa_standalone: browserMetadata.standalone,
    motion_triggered: motionTriggered,
    page_title: browserMetadata.pageTitle,
    platform_info: browserMetadata.platform,
    route_path: routePath || browserMetadata.routePath,
    screenshot_file_name: screenshotFileName?.trim() || null,
    summary: summary.trim(),
    trigger_source: source,
    user_agent: browserMetadata.userAgent,
    viewport_height: browserMetadata.viewportHeight,
    viewport_width: browserMetadata.viewportWidth,
  };
};
