// service-worker.js - Simple caching for Met Museum app
// Caches static assets and recent artworks for offline use

const CACHE_VERSION = '1.0.0';
const CACHE_NAME = `met-art-${CACHE_VERSION}`;
const API_CACHE_NAME = `met-api-${CACHE_VERSION}`;
const MAX_CACHED_ARTWORKS = 50;
const MAX_CACHED_IMAGES = 50;

// Static assets to cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './offline.html',
    './styles-mobile.css',
    './app.js',
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
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Background sync for refreshing cached content
self.addEventListener('sync', (event) => {
    if (event.tag === 'refresh-artworks') {
        event.waitUntil(refreshCachedArtworks());
    }
});

async function refreshCachedArtworks() {
    try {
        // Get list of cached artwork URLs
        const cache = await caches.open(API_CACHE_NAME);
        const requests = await cache.keys();
        
        // Refresh a few random cached artworks
        const artworkRequests = requests.filter(req => req.url.includes('/objects/'));
        const toRefresh = artworkRequests.slice(0, 5); // Refresh up to 5 artworks
        
        for (const request of toRefresh) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.put(request, response);
                }
            } catch (error) {
                console.log('[Service Worker] Failed to refresh:', request.url);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Background sync failed:', error);
    }
}

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-HTTP requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Check if this is an API request
    const isApiRequest = url.hostname.includes('collectionapi.metmuseum.org');
    const isImageRequest = request.destination === 'image' || 
                          url.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (isApiRequest) {
        // Network first for API calls
        event.respondWith(networkFirstStrategy(request));
    } else if (isImageRequest && url.hostname.includes('metmuseum.org')) {
        // Cache images from Met Museum
        event.respondWith(imageStrategy(request));
    } else {
        // Cache first for static assets
        event.respondWith(cacheFirstStrategy(request));
    }
});

// Cache first strategy - for static assets
async function cacheFirstStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return caches.match('./offline.html');
        }
        throw error;
    }
}

// Network first strategy - for API calls
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(API_CACHE_NAME);
            cache.put(request, networkResponse.clone());
            
            // Clean up old entries
            cleanupCache(API_CACHE_NAME, MAX_CACHED_ARTWORKS);
        }
        
        return networkResponse;
    } catch (error) {
        // Try cache as fallback
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return error response
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Image caching strategy
async function imageStrategy(request) {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(API_CACHE_NAME);
            
            // Clone to check size
            const responseClone = networkResponse.clone();
            const blob = await responseClone.blob();
            
            // Only cache images under 5MB
            if (blob.size < 5 * 1024 * 1024) {
                cache.put(request, networkResponse.clone());
                cleanupCache(API_CACHE_NAME, MAX_CACHED_IMAGES);
            }
        }
        
        return networkResponse;
    } catch (error) {
        // Return placeholder for offline images
        return new Response('Image unavailable offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Clean up cache to maintain size limits
async function cleanupCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    if (requests.length > maxItems) {
        // Remove oldest entries (simple FIFO)
        const toDelete = requests.slice(0, requests.length - maxItems);
        await Promise.all(toDelete.map(request => cache.delete(request)));
    }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GET_CACHED_ARTWORKS') {
        getCachedArtworks().then(artworks => {
            event.ports[0].postMessage(artworks);
        });
    }
});

// Get cached artworks for offline viewing
async function getCachedArtworks() {
    try {
        const cache = await caches.open(API_CACHE_NAME);
        const requests = await cache.keys();
        
        const artworks = [];
        for (const request of requests) {
            if (request.url.includes('/objects/') && !request.url.includes('search')) {
                const response = await cache.match(request);
                if (response) {
                    const data = await response.json();
                    if (data && data.objectID) {
                        artworks.push(data);
                    }
                }
            }
        }
        
        return artworks;
    } catch (error) {
        console.error('[Service Worker] Error getting cached artworks:', error);
        return [];
    }
}

// Message handler for manual caching
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_ARTWORK') {
        const { objectID, imageUrl, artworkData } = event.data;
        
        // Cache the artwork data and image
        cacheArtworkManually(objectID, imageUrl, artworkData);
    } else if (event.data && event.data.type === 'GET_CACHE_INFO') {
        // Send back cache information
        getCacheInfo().then(info => {
            event.ports[0].postMessage(info);
        });
    }
});

async function cacheArtworkManually(objectID, imageUrl, artworkData) {
    try {
        const apiCache = await caches.open(API_CACHE_NAME);
        
        // Cache the API response
        if (artworkData) {
            const apiUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectID}`;
            const apiResponse = new Response(JSON.stringify(artworkData), {
                headers: { 'Content-Type': 'application/json' }
            });
            await apiCache.put(apiUrl, apiResponse);
        }
        
        // Cache the image
        if (imageUrl) {
            const imageResponse = await fetch(imageUrl);
            if (imageResponse.ok) {
                await apiCache.put(imageUrl, imageResponse);
            }
        }
        
        console.log(`[Service Worker] Manually cached artwork ${objectID}`);
    } catch (error) {
        console.error('[Service Worker] Error caching artwork:', error);
    }
}

async function getCacheInfo() {
    try {
        const apiCache = await caches.open(API_CACHE_NAME);
        const requests = await apiCache.keys();
        
        const artworkCount = requests.filter(req => req.url.includes('/objects/')).length;
        const imageCount = requests.filter(req => req.url.includes('images.metmuseum.org')).length;
        
        return {
            cachedArtworks: artworkCount,
            cachedImages: imageCount,
            totalCached: requests.length
        };
    } catch (error) {
        console.error('[Service Worker] Error getting cache info:', error);
        return { cachedArtworks: 0, cachedImages: 0, totalCached: 0 };
    }
}