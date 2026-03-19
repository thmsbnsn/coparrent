// Service Worker for Push Notifications & Background Sync - iOS Compatible
const CACHE_VERSION = 'v2';
const CACHE_NAME = `coparrent-push-${CACHE_VERSION}`;
const SYNC_QUEUE_NAME = 'coparrent-sync-queue';

// Push notification handler with iOS compatibility
self.addEventListener("push", function (event) {
  if (!event.data) {
    console.log("Push event but no data");
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    // Handle plain text payloads
    data = {
      title: "CoParrent",
      message: event.data.text(),
    };
  }

  const options = {
    body: data.message || data.body || "You have a new notification",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.id || "1",
      url: data.url || "/dashboard",
    },
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
    tag: data.tag || "coparrent-notification",
    renotify: true,
    // iOS Safari 16.4+ supports these
    silent: data.silent || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "CoParrent", options)
  );
});

// Handle notification click
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener("notificationclose", function (event) {
  console.log("Notification closed:", event.notification.tag);
});

// Install event - cache essential assets for notifications
self.addEventListener("install", function (event) {
  console.log("Push SW: Installing version", CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll([
        "/pwa-192x192.png",
        "/pwa-512x512.png",
      ]);
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches and claim clients
self.addEventListener("activate", function (event) {
  console.log("Push SW: Activating version", CACHE_VERSION);
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (name) {
              return name.startsWith("coparrent-push-") && name !== CACHE_NAME;
            })
            .map(function (name) {
              console.log("Push SW: Deleting old cache", name);
              return caches.delete(name);
            })
        );
      }),
      // Claim all clients immediately
      self.clients.claim(),
    ])
  );
});

// Handle messages from the main thread
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  // Handle local notification requests from main thread
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      ...options,
    });
  }
  
  // Queue action for background sync
  if (event.data && event.data.type === "QUEUE_ACTION") {
    const { action, payload } = event.data;
    queueSyncAction(action, payload);
  }
});

// Background Sync - for retrying failed actions when connectivity is restored
self.addEventListener("sync", function (event) {
  console.log("Background sync event:", event.tag);
  
  if (event.tag === "sync-messages") {
    event.waitUntil(syncQueuedMessages());
  }
  
  if (event.tag === "sync-actions") {
    event.waitUntil(syncQueuedActions());
  }
});

// Periodic background sync (where supported)
self.addEventListener("periodicsync", function (event) {
  if (event.tag === "coparrent-sync") {
    event.waitUntil(syncQueuedActions());
  }
});

// Helper: Queue action for sync
async function queueSyncAction(action, payload) {
  try {
    const db = await openSyncDB();
    const tx = db.transaction("syncQueue", "readwrite");
    const store = tx.objectStore("syncQueue");
    
    await store.add({
      action,
      payload,
      timestamp: Date.now(),
      retries: 0,
    });
    
    // Request background sync if available
    if ("sync" in self.registration) {
      await self.registration.sync.register("sync-actions");
    }
  } catch (error) {
    console.error("Failed to queue sync action:", error);
  }
}

// Helper: Open IndexedDB for sync queue
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("CoParrentSync", 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

// Helper: Process queued actions
async function syncQueuedActions() {
  try {
    const db = await openSyncDB();
    const tx = db.transaction("syncQueue", "readwrite");
    const store = tx.objectStore("syncQueue");
    const allItems = await store.getAll();
    
    for (const item of allItems) {
      try {
        // Process based on action type
        const success = await processAction(item.action, item.payload);
        
        if (success) {
          // Remove from queue
          await store.delete(item.id);
        } else if (item.retries < 3) {
          // Update retry count
          item.retries++;
          await store.put(item);
        } else {
          // Max retries reached, remove
          await store.delete(item.id);
          console.warn("Action failed after max retries:", item);
        }
      } catch (error) {
        console.error("Error processing queued action:", error);
      }
    }
  } catch (error) {
    console.error("Sync queue processing failed:", error);
  }
}

// Helper: Process a single action
async function processAction(action, payload) {
  try {
    const response = await fetch("/api/sync-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    
    return response.ok;
  } catch (error) {
    // Network error - will retry
    return false;
  }
}

// Helper: Sync queued messages
async function syncQueuedMessages() {
  // Notify main thread about sync
  const allClients = await clients.matchAll();
  allClients.forEach((client) => {
    client.postMessage({ type: "SYNC_STARTED" });
  });
  
  await syncQueuedActions();
  
  // Notify main thread sync complete
  allClients.forEach((client) => {
    client.postMessage({ type: "SYNC_COMPLETE" });
  });
}
