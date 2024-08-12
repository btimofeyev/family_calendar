const CACHE_NAME = 'famlynook-cache-v1';
const urlsToCache = [
  '/index.html',
  '/dashboard.html',
  '/profile.html',
  '/public/css/styles.css',
  '/public/css/teststyles.css',
  '/public/js/main.js',
  '/public/js/dashboard.js',
  '/public/js/socialfeed.js',
  '/public/js/profile.js',
  '/public/icons/512x512.png',  
  '/public/icons/512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('Opened cache');
          return cache.addAll(urlsToCache);
        })
        .catch((error) => {
          console.error('Failed to open cache: ', error);
        })
    );
  });
  
  self.addEventListener('fetch', (event) => {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request);
        })
        .catch((error) => {
          console.error('Fetch failed; returning offline page instead.', error);
          // Optionally, return a custom offline page here
        })
    );
  });
  
  self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log('Deleting outdated cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  });
  
  self.addEventListener('push', (event) => {
    let data = {};
    if (event.data) {
      data = event.data.json();
    }
  
    const options = {
      body: data.body,
      icon: '/public/icons/512x512.png',  
      badge: '/public/icons/512x512.png',  
      data: {
        url: data.url  
      }
    };
  
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  });
  
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
  
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  });