import type { ProblemReportPayload } from "@/lib/problem-report/payload";
import { supabase } from "@/integrations/supabase/client";
import logger from "@/lib/logger";

export interface SubmitProblemReportInput {
  payload: ProblemReportPayload;
  screenshotFile?: File | null;
}

export interface SubmitProblemReportResult {
  reportId: string;
  success: true;
}

const appendNullable = (formData: FormData, key: string, value: string | number | boolean | null) => {
  if (value === null || value === undefined) {
    return;
  }

  formData.append(key, String(value));
};

export const submitProblemReport = async ({
  payload,
  screenshotFile,
}: SubmitProblemReportInput): Promise<SubmitProblemReportResult> => {
  const formData = new FormData();

  appendNullable(formData, "summary", payload.summary);
  appendNullable(formData, "category", payload.category);
  appendNullable(formData, "details", payload.details);
  appendNullable(formData, "email", payload.email);
  appendNullable(formData, "route_path", payload.route_path);
  appendNullable(formData, "current_url", payload.current_url);
  appendNullable(formData, "page_title", payload.page_title);
  appendNullable(formData, "client_timestamp", payload.client_timestamp);
  appendNullable(formData, "app_version", payload.app_version);
  appendNullable(formData, "user_agent", payload.user_agent);
  appendNullable(formData, "viewport_width", payload.viewport_width);
  appendNullable(formData, "viewport_height", payload.viewport_height);
  appendNullable(formData, "platform_info", payload.platform_info);
  appendNullable(formData, "is_pwa_standalone", payload.is_pwa_standalone);
  appendNullable(formData, "motion_triggered", payload.motion_triggered);
  appendNullable(formData, "trigger_source", payload.trigger_source);
  formData.append("extra_context", JSON.stringify(payload.extra_context ?? {}));

  if (screenshotFile) {
    formData.append("screenshot", screenshotFile);
  }

  const { data, error } = await supabase.functions.invoke("submit-problem-report", {
    body: formData,
  });

  const result = data as
    | { error?: string; report_id?: string; success?: boolean }
    | null;

  if (error || !result?.success || !result.report_id) {
    logger.warn("Problem report submission failed", {
      error,
      result,
    });
    throw new Error(result?.error ?? error?.message ?? "Unable to submit the problem report right now.");
  }

  return {
    reportId: result.report_id,
    success: true,
  };
};
