console.log('Service Worker: Script loaded');

self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing....');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating....');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  console.log('Service Worker: Push event received');
  // Handle push event here
});
const CACHE_NAME = "famlynook-cache-v1";
const urlsToCache = [
  "/index.html",
  "/dashboard.html",
  "/profile.html",
  "/css/styles.css",
  "/css/teststyling.css",
  "/js/main.js",
  "/js/dashboard.js",
  "/js/socialfeed.js",
  "/js/pushNotifications.js",
  "/js/profile.js",
  "/icons/512x512.png",
  "/icons/512x512.png",
];

self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Cache opened");
        return Promise.all(
          urlsToCache.map((url) =>
            fetch(url)
              .then((response) => {
                if (!response.ok) {
                  throw new Error(
                    `Failed to fetch ${url}: ${response.statusText}`
                  );
                }
                return cache.put(url, response);
              })
              .catch((error) => {
                console.error(`Service Worker: Failed to cache ${url}`, error);
              })
          )
        );
      })
      .then(() => {
        console.log("Service Worker: Installed and cached all files");
      })
      .catch((error) => {
        console.error("Service Worker: Failed to open cache", error);
      })
  );
});

self.addEventListener("fetch", (event) => {
  console.log("Service Worker: Fetching", event.request.url);
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        if (response) {
          console.log("Service Worker: Returning cached response", response);
          return response;
        }
        console.log("Service Worker: Fetching from network", event.request.url);
        return fetch(event.request);
      })
      .catch((error) => {
        console.error("Service Worker: Fetch failed", error);
      })
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Service Worker: Deleting old cache", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("Service Worker: Claiming clients");
        return self.clients.claim();
      })
      .then(() => {
        console.log("Service Worker: Activated and claiming complete");
      })
      .catch((error) => {
        console.error("Service Worker: Error during activation", error);
      })
  );
});
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        event.waitUntil(
            self.registration.showNotification(data.title, {
                body: data.body,
                icon: "/public/icons/512x512.png",
                data: { url: data.url }
            })
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === event.notification.data.url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
