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
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
