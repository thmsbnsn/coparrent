import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import webpush from "https://esm.sh/web-push@3.6.7";

interface PushSubscriptionRow {
  auth_key: string;
  endpoint: string;
  id: string;
  p256dh_key: string;
  platform: string | null;
}

export interface PushDispatchParams {
  body: string;
  platformFilter?: string | null;
  profileId: string;
  silent?: boolean;
  subscriptionIds?: string[];
  tag?: string;
  title: string;
  url?: string;
}

export interface PushDispatchResult {
  configured: boolean;
  expired: number;
  failed: number;
  sent: number;
  targeted: number;
}

const getSupportEmail = () => Deno.env.get("SUPPORT_EMAIL") ?? "support@coparrent.com";

export function sanitizeNotificationText(text: string): string {
  let safeText = text;
  if (safeText.length > 200) {
    safeText = `${safeText.substring(0, 197)}...`;
  }

  safeText = safeText.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
  safeText = safeText.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[phone]");

  return safeText;
}

export async function dispatchPushNotifications(
  supabase: SupabaseClient,
  params: PushDispatchParams,
): Promise<PushDispatchResult> {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("Push dispatch skipped: VAPID keys not configured");
    return {
      configured: false,
      expired: 0,
      failed: 0,
      sent: 0,
      targeted: 0,
    };
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key, platform")
    .eq("profile_id", params.profileId)
    .is("revoked_at", null);

  if (subscriptionsError) {
    throw subscriptionsError;
  }

  const normalizedPlatformFilter = params.platformFilter?.trim().toLowerCase() ?? null;
  const normalizedSubscriptionIds = (params.subscriptionIds ?? []).filter((id) => typeof id === "string");

  const targetedSubscriptions = ((subscriptions as PushSubscriptionRow[] | null) ?? []).filter((subscription) => {
    if (normalizedSubscriptionIds.length > 0 && !normalizedSubscriptionIds.includes(subscription.id)) {
      return false;
    }

    if (normalizedPlatformFilter && (subscription.platform ?? "").toLowerCase() !== normalizedPlatformFilter) {
      return false;
    }

    return true;
  });

  if (targetedSubscriptions.length === 0) {
    return {
      configured: true,
      expired: 0,
      failed: 0,
      sent: 0,
      targeted: 0,
    };
  }

  webpush.setVapidDetails(`mailto:${getSupportEmail()}`, vapidPublicKey, vapidPrivateKey);

  const notificationPayload = JSON.stringify({
    id: crypto.randomUUID(),
    message: sanitizeNotificationText(params.body),
    sentAt: new Date().toISOString(),
    silent: Boolean(params.silent),
    tag: params.tag ?? "coparrent-notification",
    title: sanitizeNotificationText(params.title),
    url: params.url ?? "/dashboard",
  });

  let sent = 0;
  let failed = 0;
  const expiredSubscriptionIds: string[] = [];

  for (const subscription of targetedSubscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth_key,
            p256dh: subscription.p256dh_key,
          },
        },
        notificationPayload,
        {
          TTL: 86400,
          urgency: "high",
        },
      );

      sent += 1;
    } catch (error) {
      const statusCode = Number(
        (error as { statusCode?: number })?.statusCode ??
        (error as { status?: number })?.status ??
        0,
      );

      if (statusCode === 404 || statusCode === 410) {
        expiredSubscriptionIds.push(subscription.id);
      }

      failed += 1;
      console.warn("Push send failed", {
        error: error instanceof Error ? error.message : String(error),
        subscriptionId: subscription.id,
      });
    }
  }

  if (expiredSubscriptionIds.length > 0) {
    const { error: revokeError } = await supabase
      .from("push_subscriptions")
      .update({ revoked_at: new Date().toISOString() })
      .in("id", expiredSubscriptionIds);

    if (revokeError) {
      console.warn("Failed to revoke expired subscriptions", revokeError);
    }
  }

  return {
    configured: true,
    expired: expiredSubscriptionIds.length,
    failed,
    sent,
    targeted: targetedSubscriptions.length,
  };
}
