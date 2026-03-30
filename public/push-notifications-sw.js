const DEFAULT_NOTIFICATION_TITLE = "CoParrent";
const DEFAULT_NOTIFICATION_BODY = "You have a new notification";
const DEFAULT_NOTIFICATION_TAG = "coparrent-notification";
const DEFAULT_NOTIFICATION_URL = "/dashboard";

const resolveNotificationTitle = (title) =>
  typeof title === "string" && title.trim().length > 0 ? title.trim() : DEFAULT_NOTIFICATION_TITLE;

const resolveNotificationBody = (payload) => {
  if (typeof payload?.message === "string" && payload.message.trim().length > 0) {
    return payload.message.trim();
  }

  if (typeof payload?.body === "string" && payload.body.trim().length > 0) {
    return payload.body.trim();
  }

  return DEFAULT_NOTIFICATION_BODY;
};

const resolveNotificationTag = (payload) =>
  typeof payload?.tag === "string" && payload.tag.trim().length > 0
    ? payload.tag.trim()
    : DEFAULT_NOTIFICATION_TAG;

const resolveNotificationUrl = (payload) =>
  typeof payload?.url === "string" && payload.url.trim().length > 0
    ? payload.url.trim()
    : DEFAULT_NOTIFICATION_URL;

const buildNotificationOptions = (payload, overrides = {}) => ({
  actions: [
    {
      action: "open",
      title: "Open",
    },
    {
      action: "close",
      title: "Dismiss",
    },
  ],
  badge: "/pwa-192x192.png",
  body: resolveNotificationBody(payload),
  data: {
    dateOfArrival: Date.now(),
    primaryKey:
      typeof payload?.id === "string" && payload.id.trim().length > 0 ? payload.id.trim() : "notification",
    url: resolveNotificationUrl(payload),
  },
  icon: "/pwa-192x192.png",
  renotify: true,
  silent: Boolean(payload?.silent),
  tag: resolveNotificationTag(payload),
  vibrate: [100, 50, 100],
  ...overrides,
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("Push event received without a payload.");
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    payload = {
      message: event.data.text(),
    };
  }

  const title = resolveNotificationTitle(payload?.title);
  const options = buildNotificationOptions(payload);

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const urlToOpen =
    typeof event.notification.data?.url === "string" && event.notification.data.url.trim().length > 0
      ? event.notification.data.url.trim()
      : DEFAULT_NOTIFICATION_URL;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }

      return undefined;
    }),
  );
});

self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event.notification.tag);
});

self.addEventListener("message", (event) => {
  if (!event.data) {
    return;
  }

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data.type !== "SHOW_NOTIFICATION") {
    return;
  }

  const payload = {
    body: event.data.options?.body,
    id: event.data.options?.data?.primaryKey,
    message: event.data.options?.body,
    silent: event.data.options?.silent,
    tag: event.data.options?.tag,
    title: event.data.title,
    url: event.data.options?.data?.url,
  };

  event.waitUntil(
    self.registration.showNotification(
      resolveNotificationTitle(event.data.title),
      buildNotificationOptions(payload, {
        ...event.data.options,
        badge: event.data.options?.badge ?? "/pwa-192x192.png",
        icon: event.data.options?.icon ?? "/pwa-192x192.png",
      }),
    ),
  );
});
