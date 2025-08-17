// Service Worker for Met Art Generator
// Version: 1.1.0

const CACHE_NAME = 'met-art-generator-v1';
const API_CACHE_NAME = 'met-art-api-v1';
const IMAGE_CACHE_NAME = 'met-art-images-v1';
const MAX_CACHED_IMAGES = 50;

// Static assets to cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './offline.html',
    './styles.css',
    './app.js',
    './api.js',
    './artwork.js',
    './filters.js',
    './ui.js',
    './config.js',
    './utils.js',
    './favorites.js',
    './search-results.js',
    './manifest.json',
    './icons/icon-48x48.png',
    './icons/icon-72x72.png',
    './icons/icon-96x96.png',
    './icons/icon-144x144.png',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                // Delete old caches that don't match current version
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== API_CACHE_NAME && 
                            cacheName !== IMAGE_CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                // Take control of all clients immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - handle requests with appropriate strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-HTTP(S) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Check request types
    const isApiRequest = url.hostname.includes('collectionapi.metmuseum.org') || 
                        url.pathname.includes('/api/');
    const isImageRequest = request.destination === 'image' || 
                          url.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (isApiRequest) {
        // Network-first strategy for API calls
        event.respondWith(networkFirstStrategy(request));
    } else if (isImageRequest && url.hostname.includes('metmuseum.org')) {
        // Special handling for Met Museum images
        event.respondWith(imageStrategy(request));
    } else {
        // Cache-first strategy for static assets
        event.respondWith(cacheFirstStrategy(request));
    }
});

// Cache-first strategy - serve from cache, fallback to network
async function cacheFirstStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            console.log('[Service Worker] Serving from cache:', request.url);
            return cachedResponse;
        }
        
        console.log('[Service Worker] Fetching from network:', request.url);
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            const offlineResponse = await caches.match('./offline.html');
            if (offlineResponse) {
                return offlineResponse;
            }
        }
        
        // Return a basic error response
        return new Response('Network error occurred', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Network-first strategy - try network, fallback to cache
async function networkFirstStrategy(request) {
    try {
        console.log('[Service Worker] Fetching API from network:', request.url);
        const networkResponse = await fetch(request);
        
        // Cache successful API responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(API_CACHE_NAME);
            cache.put(request, networkResponse.clone());
            
            // If this is a departments request, cache it longer
            if (request.url.includes('/departments')) {
                console.log('[Service Worker] Caching departments data');
            }
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Network request failed, checking cache:', error);
        
        // Try to get from cache
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            console.log('[Service Worker] Serving API from cache:', request.url);
            return cachedResponse;
        }
        
        // Return error response if no cached version
        return new Response(JSON.stringify({ error: 'Offline - no cached data available' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Image caching strategy with size management
async function imageStrategy(request) {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        console.log('[Service Worker] Serving image from cache:', request.url);
        return cachedResponse;
    }
    
    try {
        // Fetch from network
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            // Clone the response to check size
            const responseClone = networkResponse.clone();
            const blob = await responseClone.blob();
            
            // Only cache images under 5MB
            if (blob.size < 5 * 1024 * 1024) {
                // Manage cache size
                await manageCacheSize(cache);
                
                // Cache the image
                await cache.put(request, networkResponse.clone());
                console.log('[Service Worker] Cached image:', request.url);
            } else {
                console.log('[Service Worker] Image too large to cache:', blob.size);
            }
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Failed to fetch image:', error);
        
        // Return a placeholder or error response
        return new Response('Image unavailable offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Manage cache size by removing oldest entries
async function manageCacheSize(cache) {
    const requests = await cache.keys();
    
    if (requests.length >= MAX_CACHED_IMAGES) {
        // Remove oldest entries (FIFO)
        const toDelete = requests.length - MAX_CACHED_IMAGES + 1;
        for (let i = 0; i < toDelete; i++) {
            await cache.delete(requests[i]);
            console.log('[Service Worker] Removed old cached image');
        }
    }
}

// Message handler for manual cache operations
self.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // Handle cache info requests
    if (event.data && event.data.type === 'GET_CACHE_INFO') {
        const cacheInfo = await getCacheInfo();
        event.ports[0].postMessage(cacheInfo);
    }
    
    // Handle request for cached artworks
    if (event.data && event.data.type === 'GET_CACHED_ARTWORKS') {
        const cachedArtworks = await getCachedArtworks();
        event.ports[0].postMessage(cachedArtworks);
    }
    
    // Handle favorite caching request
    if (event.data && event.data.type === 'CACHE_FAVORITE') {
        const { objectID, imageUrl } = event.data;
        if (imageUrl) {
            await cacheFavoriteImage(imageUrl, objectID);
        }
    }
});

// Get information about cached content
async function getCacheInfo() {
    try {
        const imageCache = await caches.open(IMAGE_CACHE_NAME);
        const apiCache = await caches.open(API_CACHE_NAME);
        
        const imageRequests = await imageCache.keys();
        const apiRequests = await apiCache.keys();
        
        // Count cached artworks (API responses with /objects/ in URL)
        const cachedArtworks = apiRequests.filter(req => 
            req.url.includes('/objects/') && !req.url.includes('/search')
        ).length;
        
        return {
            cachedImages: imageRequests.length,
            cachedArtworks: cachedArtworks,
            maxImages: MAX_CACHED_IMAGES
        };
    } catch (error) {
        console.error('[Service Worker] Error getting cache info:', error);
        return {
            cachedImages: 0,
            cachedArtworks: 0,
            maxImages: MAX_CACHED_IMAGES
        };
    }
}

// Get list of cached artwork data
async function getCachedArtworks() {
    try {
        const apiCache = await caches.open(API_CACHE_NAME);
        const requests = await apiCache.keys();
        
        const artworkPromises = requests
            .filter(req => req.url.includes('/objects/') && !req.url.includes('/search'))
            .map(async (req) => {
                const response = await apiCache.match(req);
                if (response) {
                    try {
                        return await response.json();
                    } catch (e) {
                        return null;
                    }
                }
                return null;
            });
        
        const artworks = await Promise.all(artworkPromises);
        return artworks.filter(artwork => artwork !== null);
    } catch (error) {
        console.error('[Service Worker] Error getting cached artworks:', error);
        return [];
    }
}

// Cache favorite artwork image
async function cacheFavoriteImage(imageUrl, objectID) {
    try {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        
        // Check if already cached
        const cachedResponse = await cache.match(imageUrl);
        if (cachedResponse) {
            console.log(`[Service Worker] Favorite image already cached: ${objectID}`);
            return;
        }
        
        // Fetch and cache the image
        const response = await fetch(imageUrl);
        if (response && response.status === 200) {
            // Clone response to check size
            const blob = await response.clone().blob();
            
            // Only cache if under size limit
            if (blob.size < 5 * 1024 * 1024) {
                await cache.put(imageUrl, response);
                console.log(`[Service Worker] Cached favorite image: ${objectID}`);
                
                // Manage cache size
                await manageCacheSize(cache);
            } else {
                console.log(`[Service Worker] Favorite image too large to cache: ${objectID}`);
            }
        }
    } catch (error) {
        console.error(`[Service Worker] Error caching favorite image:`, error);
    }
}