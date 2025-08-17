// Service Worker for Met Art Generator
// FIXED: Enhanced cache management with automatic cleanup

// Import configuration if available
const CONFIG = {
    CACHE_VERSION: '1.3.0',
    MAX_CACHED_IMAGES: 100,
    MAX_CACHE_AGE: 7 * 24 * 60 * 60 * 1000,
    CACHE_CLEANUP_INTERVAL: 60 * 60 * 1000,
    DEBUG_MODE: false // Set to true to enable debug logging
};

const CACHE_NAME = `met-art-generator-v${CONFIG.CACHE_VERSION}`;
const API_CACHE_NAME = `met-art-api-v${CONFIG.CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `met-art-images-v${CONFIG.CACHE_VERSION}`;
const MAX_CACHED_IMAGES = CONFIG.MAX_CACHED_IMAGES;
const MAX_API_CACHE_AGE = 30 * 60 * 1000; // 30 minutes
const MAX_IMAGE_CACHE_AGE = CONFIG.MAX_CACHE_AGE;

// Static assets to cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './offline.html',
    './styles.css',
    './config.js',
    './event-manager.js',
    './utils.js',
    './api-simple.js',
    './artwork-simple.js',
    './favorites.js',
    './ui-simple.js',
    './init-simple.js',
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
    if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Caching static assets');
                // Use addAll with error handling for individual files
                return Promise.all(
                    STATIC_ASSETS.map(url => {
                        return cache.add(url).catch(err => {
                            if (self.CONFIG?.DEBUG_MODE) console.warn(`[Service Worker] Failed to cache ${url}:`, err);
                        });
                    })
                );
            })
            .then(() => {
                if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Installation complete');
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
    if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                // Delete old caches that don't match current version
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== API_CACHE_NAME && 
                            cacheName !== IMAGE_CACHE_NAME) {
                            if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Activation complete');
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
            // Check if cache is stale
            const cachedDate = new Date(cachedResponse.headers.get('date'));
            const now = new Date();
            const age = now - cachedDate;
            
            // For HTML files, always try to fetch fresh version in background
            if (request.mode === 'navigate' || request.url.endsWith('.html')) {
                if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Serving from cache and updating:', request.url);
                // Return cached version immediately but update in background
                fetchAndCache(request, CACHE_NAME);
                return cachedResponse;
            }
            
            if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Serving from cache:', request.url);
            return cachedResponse;
        }
        
        if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Fetching from network:', request.url);
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
        if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Fetching API from network:', request.url);
        const networkResponse = await fetch(request);
        
        // Cache successful API responses with timestamp
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(API_CACHE_NAME);
            // Add custom headers with cache timestamp
            const responseToCache = networkResponse.clone();
            const headers = new Headers(responseToCache.headers);
            headers.append('sw-cached-at', new Date().toISOString());
            
            const cachedResponse = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
            });
            
            cache.put(request, cachedResponse);
            
            // Clean up old API cache entries
            cleanupAPICache();
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Network request failed, checking cache:', error);
        
        // Try to get from cache
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            // Check cache age
            const cachedAt = cachedResponse.headers.get('sw-cached-at');
            if (cachedAt) {
                const age = Date.now() - new Date(cachedAt).getTime();
                if (age > MAX_API_CACHE_AGE) {
                    if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] API cache expired, returning stale with warning');
                    // Return stale data but with a warning header
                    const headers = new Headers(cachedResponse.headers);
                    headers.set('x-cache-status', 'stale');
                    return new Response(cachedResponse.body, {
                        status: cachedResponse.status,
                        statusText: cachedResponse.statusText,
                        headers: headers
                    });
                }
            }
            if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Serving API from cache:', request.url);
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
        if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Serving image from cache:', request.url);
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
                if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Cached image:', request.url);
            } else {
                if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Image too large to cache:', blob.size);
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
        // Get cache entries with their timestamps
        const cacheEntries = await Promise.all(
            requests.map(async (request) => {
                const response = await cache.match(request);
                const dateHeader = response.headers.get('date') || response.headers.get('sw-cached-at');
                return {
                    request,
                    timestamp: dateHeader ? new Date(dateHeader).getTime() : 0
                };
            })
        );
        
        // Sort by timestamp (oldest first)
        cacheEntries.sort((a, b) => a.timestamp - b.timestamp);
        
        // Remove oldest entries
        const toDelete = requests.length - MAX_CACHED_IMAGES + 5; // Remove 5 extra for buffer
        for (let i = 0; i < toDelete && i < cacheEntries.length; i++) {
            await cache.delete(cacheEntries[i].request);
            if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Removed old cached image');
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
            if (self.CONFIG?.DEBUG_MODE) console.log(`[Service Worker] Favorite image already cached: ${objectID}`);
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
                if (self.CONFIG?.DEBUG_MODE) console.log(`[Service Worker] Cached favorite image: ${objectID}`);
                
                // Manage cache size
                await manageCacheSize(cache);
            } else {
                if (self.CONFIG?.DEBUG_MODE) console.log(`[Service Worker] Favorite image too large to cache: ${objectID}`);
            }
        }
    } catch (error) {
        console.error(`[Service Worker] Error caching favorite image:`, error);
    }
}

// Helper function to fetch and cache in background
async function fetchAndCache(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, response);
        }
    } catch (error) {
        // Silently fail - this is a background update
        if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Background update failed:', error);
    }
}

// Clean up old API cache entries
async function cleanupAPICache() {
    try {
        const cache = await caches.open(API_CACHE_NAME);
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            const cachedAt = response.headers.get('sw-cached-at');
            
            if (cachedAt) {
                const age = Date.now() - new Date(cachedAt).getTime();
                if (age > MAX_API_CACHE_AGE * 2) { // Remove if twice the max age
                    await cache.delete(request);
                    if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Removed expired API cache entry');
                }
            }
        }
    } catch (error) {
        console.error('[Service Worker] Error cleaning API cache:', error);
    }
}

// FIXED: Enhanced cache management with size limits and automatic cleanup
async function manageCacheSize(cache) {
    try {
        const keys = await cache.keys();
        const cacheEntries = [];
        
        // Get all cache entries with their metadata
        for (const request of keys) {
            const response = await cache.match(request);
            const headers = response.headers;
            
            cacheEntries.push({
                request,
                size: parseInt(headers.get('content-length') || '0'),
                date: new Date(headers.get('date') || Date.now()),
                url: request.url
            });
        }
        
        // Sort by date (oldest first)
        cacheEntries.sort((a, b) => a.date - b.date);
        
        // Remove oldest entries if we exceed the limit
        const entriesToRemove = cacheEntries.length - MAX_CACHED_IMAGES;
        if (entriesToRemove > 0) {
            if (self.CONFIG?.DEBUG_MODE) console.log(`[Service Worker] Removing ${entriesToRemove} old cache entries`);
            
            for (let i = 0; i < entriesToRemove; i++) {
                await cache.delete(cacheEntries[i].request);
            }
        }
        
        // Also remove expired entries
        const now = Date.now();
        for (const entry of cacheEntries) {
            const age = now - entry.date.getTime();
            if (age > MAX_IMAGE_CACHE_AGE) {
                await cache.delete(entry.request);
                if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Removed expired image:', entry.url);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Error managing cache size:', error);
    }
}

// Periodic cache cleanup
let cleanupInterval = null;

async function startPeriodicCleanup() {
    // Clear any existing interval
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }
    
    // Run cleanup immediately
    await performCacheCleanup();
    
    // Set up periodic cleanup
    cleanupInterval = setInterval(async () => {
        await performCacheCleanup();
    }, CONFIG.CACHE_CLEANUP_INTERVAL);
}

async function performCacheCleanup() {
    if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Running cache cleanup...');
    
    try {
        // Clean up each cache type
        const cacheNames = [CACHE_NAME, API_CACHE_NAME, IMAGE_CACHE_NAME];
        
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            
            if (cacheName === IMAGE_CACHE_NAME) {
                await manageCacheSize(cache);
            } else if (cacheName === API_CACHE_NAME) {
                await cleanupAPICache();
            }
        }
        
        // Also remove old cache versions
        const allCaches = await caches.keys();
        const currentCaches = new Set(cacheNames);
        
        for (const cacheName of allCaches) {
            if (!currentCaches.has(cacheName) && cacheName.startsWith('met-art-')) {
                if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Removing old cache version:', cacheName);
                await caches.delete(cacheName);
            }
        }
        
        if (self.CONFIG?.DEBUG_MODE) console.log('[Service Worker] Cache cleanup complete');
    } catch (error) {
        console.error('[Service Worker] Error during cache cleanup:', error);
    }
}

// Start cleanup when service worker activates
self.addEventListener('activate', (event) => {
    event.waitUntil(startPeriodicCleanup());
});