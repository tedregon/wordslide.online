// Service Worker for WordSlide PWA
const CACHE_NAME = 'wordslide-v3';
const urlsToCache = [
  './',
  './index.html',
  './completion.html',
  './game.html',
  './styles.css',
  './game.js',
  './dictionary.js',
  './sw-register.js',
  './img/wordslide-logo.png',
  './img/home-page-logo.png',
  './img/favicon.png',
  './img/confetti-fill.svg',
  './img/heart-fill.svg',
  './img/arrow-u-up-left-fill.svg'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache install failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Listen for messages from the page to skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event - network first for HTML, CSS and images, cache first for others
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isHTML = event.request.destination === 'document' || url.pathname.endsWith('.html');
  const isCSS = url.pathname.endsWith('.css');
  const isImage = /\.(png|jpg|jpeg|svg|gif|webp)$/i.test(url.pathname);
  const isJS = url.pathname.endsWith('.js');
  
  // For HTML, CSS, JS, and images, try network first, then cache (ensures updates are picked up)
  if (isHTML || isCSS || isImage || isJS) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache with fresh response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request);
        })
    );
  } else {
    // For other files, cache first, then network
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        })
    );
  }
});

