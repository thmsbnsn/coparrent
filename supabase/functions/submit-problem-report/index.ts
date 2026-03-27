import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

const ALLOWED_CATEGORIES = new Set(["Bug", "Confusing / unclear", "Feature request", "Other"]);
const ALLOWED_SOURCES = new Set(["manual", "shake"]);
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_BUCKET = "problem-report-screenshots";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const jsonResponse = (
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const readOptionalString = (formData: FormData, key: string): string | null => {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readOptionalInteger = (formData: FormData, key: string): number | null => {
  const value = readOptionalString(formData, key);
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const readOptionalBoolean = (formData: FormData, key: string): boolean | null => {
  const value = readOptionalString(formData, key);
  if (value === null) {
    return null;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
};

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);

const parseJsonRecord = (value: string | null): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

Deno.serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server configuration error" }, 500, corsHeaders);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let screenshotPath: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    let authUser: { email?: string | null; id: string } | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(token);
      authUser = user ? { email: user.email, id: user.id } : null;
    }

    const formData = await req.formData();

    const summary = readOptionalString(formData, "summary");
    const category = readOptionalString(formData, "category");
    const details = readOptionalString(formData, "details");
    const email = readOptionalString(formData, "email");
    const routePath = readOptionalString(formData, "route_path");
    const currentUrl = readOptionalString(formData, "current_url");
    const triggerSource = readOptionalString(formData, "trigger_source") ?? "manual";

    if (!summary || summary.length < 3) {
      return jsonResponse({ error: "Short description is required" }, 400, corsHeaders);
    }

    if (!details || details.length < 10) {
      return jsonResponse({ error: "Details are required" }, 400, corsHeaders);
    }

    if (!category || !ALLOWED_CATEGORIES.has(category)) {
      return jsonResponse({ error: "Invalid category" }, 400, corsHeaders);
    }

    if (!routePath || !currentUrl) {
      return jsonResponse({ error: "Missing route context" }, 400, corsHeaders);
    }

    if (!ALLOWED_SOURCES.has(triggerSource)) {
      return jsonResponse({ error: "Invalid report source" }, 400, corsHeaders);
    }

    if (email && !EMAIL_PATTERN.test(email)) {
      return jsonResponse({ error: "Invalid email address" }, 400, corsHeaders);
    }

    const screenshot = formData.get("screenshot");
    const reportId = crypto.randomUUID();
    const extraContext = parseJsonRecord(readOptionalString(formData, "extra_context"));

    if (screenshot instanceof File && screenshot.size > 0) {
      if (!screenshot.type.startsWith("image/")) {
        return jsonResponse({ error: "Screenshot must be an image" }, 400, corsHeaders);
      }

      if (screenshot.size > MAX_SCREENSHOT_BYTES) {
        return jsonResponse({ error: "Screenshot must be 5MB or smaller" }, 400, corsHeaders);
      }

      const fileName = sanitizeFileName(screenshot.name || "screenshot.png");
      const pathDate = new Date().toISOString().slice(0, 10);
      screenshotPath = `${pathDate}/${authUser?.id ?? "anonymous"}/${reportId}/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(SCREENSHOT_BUCKET)
        .upload(screenshotPath, screenshot, {
          contentType: screenshot.type,
          upsert: false,
        });

      if (uploadError) {
        console.warn("submit-problem-report screenshot upload skipped", uploadError);
        screenshotPath = null;
        extraContext.screenshot_upload_error = uploadError.message;
        extraContext.screenshot_upload_failed = true;
      }
    }

    const { error: insertError } = await supabaseAdmin.from("problem_reports").insert({
      app_version: readOptionalString(formData, "app_version"),
      category,
      client_timestamp: readOptionalString(formData, "client_timestamp"),
      current_url: currentUrl,
      details,
      email,
      extra_context: extraContext,
      id: reportId,
      is_pwa_standalone: readOptionalBoolean(formData, "is_pwa_standalone"),
      motion_triggered: readOptionalBoolean(formData, "motion_triggered") ?? triggerSource === "shake",
      page_title: readOptionalString(formData, "page_title"),
      platform_info: readOptionalString(formData, "platform_info"),
      route_path: routePath,
      screenshot_path: screenshotPath,
      screenshot_url: null,
      summary,
      trigger_source: triggerSource,
      user_agent: readOptionalString(formData, "user_agent"),
      user_email: authUser?.email ?? null,
      user_id: authUser?.id ?? null,
      viewport_height: readOptionalInteger(formData, "viewport_height"),
      viewport_width: readOptionalInteger(formData, "viewport_width"),
    });

    if (insertError) {
      console.error("submit-problem-report insert failed", insertError);
      if (screenshotPath) {
        await supabaseAdmin.storage.from(SCREENSHOT_BUCKET).remove([screenshotPath]);
      }

      return jsonResponse({ error: "Unable to save the report" }, 500, corsHeaders);
    }

    return jsonResponse({ report_id: reportId, success: true }, 200, corsHeaders);
  } catch (error) {
    console.error("submit-problem-report error", error);

    if (screenshotPath) {
      await supabaseAdmin.storage.from(SCREENSHOT_BUCKET).remove([screenshotPath]);
    }

    return jsonResponse({ error: "Internal server error" }, 500, corsHeaders);
  }
});
