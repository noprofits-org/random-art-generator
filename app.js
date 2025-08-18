/**
 * Met Art Generator - Consolidated App
 * A simplified random art discovery app using the Metropolitan Museum API
 */

(function() {
    'use strict';
    
    // ===========================
    // Configuration
    // ===========================
    const CONFIG = {
        MET_API_BASE_URL: 'https://collectionapi.metmuseum.org/public/collection/v1',
        REQUEST_TIMEOUT: 15000,
        PROXY_CONFIG: {
            primary: {
                url: 'https://cors-proxy-xi-ten.vercel.app/api/proxy',
                format: 'query'
            },
            fallback: {
                url: 'https://corsproxy.io/?',
                format: 'path'
            }
        },
        CACHE_DURATION: 5 * 60 * 1000, // 5 minutes for API responses
        IMAGE_CACHE_DURATION: 30 * 60 * 1000, // 30 minutes for images
        DEBUG_MODE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
        RETRY_DELAYS: [1000, 2000, 4000], // Exponential backoff delays
        PRELOAD_COUNT: 3 // Number of artworks to preload
    };
    
    // ===========================
    // Logger Utility
    // ===========================
    const MetLogger = {
        log: (...args) => CONFIG.DEBUG_MODE && console.log('[Met]', ...args),
        info: (...args) => CONFIG.DEBUG_MODE && console.info('[Met]', ...args),
        warn: (...args) => CONFIG.DEBUG_MODE && console.warn('[Met]', ...args),
        error: (...args) => console.error('[Met]', ...args),
        debug: (...args) => CONFIG.DEBUG_MODE && console.debug('[Met]', ...args)
    };
    
    // ===========================
    // API Module
    // ===========================
    const MetAPI = (() => {
        const detailsCache = new Map();
        const requestCache = new Map(); // Cache for all API requests
        const preloadQueue = [];
        let isPreloading = false;
        let currentProxy = 'primary';
        const proxyHealthCache = {
            primary: { healthy: true, lastCheck: 0 },
            fallback: { healthy: true, lastCheck: 0 }
        };
        const PROXY_HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
        
        async function fetchWithTimeout(url, timeout = CONFIG.REQUEST_TIMEOUT, retryCount = 0) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const warningTimeout = setTimeout(() => {
                if (retryCount === 0) {
                    MetUI.updateStatus('Connecting to the museum...', 'info');
                }
            }, 3000);
            
            try {
                const response = await fetch(url, { 
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'Origin': window.location.origin
                    }
                });
                clearTimeout(timeoutId);
                clearTimeout(warningTimeout);
                
                if (!response.ok) {
                    const errorMessage = response.status === 503 ? "The museum's servers are busy. Try again in a moment." :
                                        response.status === 429 ? 'Too many requests. Please wait a moment.' :
                                        response.status === 404 ? 'This content is not available.' :
                                        `Unable to connect (Error ${response.status})`;
                    throw new Error(errorMessage);
                }
                
                return await response.json();
            } catch (error) {
                clearTimeout(timeoutId);
                clearTimeout(warningTimeout);
                
                if (error.name === 'AbortError') {
                    throw new Error('Connection timeout. Check your internet connection.');
                }
                
                // Retry with exponential backoff
                if (retryCount < CONFIG.RETRY_DELAYS.length) {
                    const delay = CONFIG.RETRY_DELAYS[retryCount];
                    MetLogger.log(`Retrying after ${delay}ms (attempt ${retryCount + 1})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return fetchWithTimeout(url, timeout, retryCount + 1);
                }
                
                throw error;
            }
        }
        
        function getProxyUrl(targetUrl, useProxy = currentProxy) {
            const proxy = CONFIG.PROXY_CONFIG[useProxy];
            
            if (proxy.format === 'path') {
                return `${proxy.url}${encodeURIComponent(targetUrl)}`;
            } else {
                return `${proxy.url}?url=${encodeURIComponent(targetUrl)}`;
            }
        }
        
        function rotateProxy() {
            const previousProxy = currentProxy;
            currentProxy = currentProxy === 'primary' ? 'fallback' : 'primary';
            MetLogger.log(`Switched proxy from ${previousProxy} to ${currentProxy}`);
            
            if (CONFIG.DEBUG_MODE) {
                MetUI.updateStatus(`Using ${currentProxy} proxy`, 'info');
            }
            
            return currentProxy;
        }
        
        async function fetchWithProxy(endpoint, useProxy = null) {
            // Check cache first
            const cacheKey = `${endpoint}_${Date.now()}`;
            const cached = getCachedRequest(endpoint);
            if (cached) {
                MetLogger.log(`Using cached response for ${endpoint}`);
                return cached;
            }
            
            const fullUrl = `${CONFIG.MET_API_BASE_URL}${endpoint}`;
            const proxyToUse = useProxy || currentProxy;
            const proxiedUrl = getProxyUrl(fullUrl, proxyToUse);
            
            try {
                MetLogger.log(`Fetching: ${endpoint} via ${proxyToUse} proxy`);
                const result = await fetchWithTimeout(proxiedUrl);
                
                proxyHealthCache[proxyToUse].healthy = true;
                proxyHealthCache[proxyToUse].lastCheck = Date.now();
                
                // Cache the successful response
                setCachedRequest(endpoint, result);
                
                return result;
            } catch (error) {
                MetLogger.error(`${proxyToUse} proxy failed:`, error);
                
                proxyHealthCache[proxyToUse].healthy = false;
                proxyHealthCache[proxyToUse].lastCheck = Date.now();
                
                if (proxyToUse === 'primary' && proxyHealthCache.fallback.healthy) {
                    MetLogger.log('Trying backup server...');
                    rotateProxy();
                    return fetchWithProxy(endpoint, 'fallback');
                }
                
                // If we have a stale cache, use it as fallback
                const staleCache = requestCache.get(endpoint);
                if (staleCache) {
                    MetLogger.log('Using stale cache as fallback');
                    MetUI.updateStatus('Using cached data', 'warning');
                    return staleCache.data;
                }
                
                throw error;
            }
        }
        
        function getCachedRequest(endpoint) {
            const cached = requestCache.get(endpoint);
            if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
                return cached.data;
            }
            return null;
        }
        
        function setCachedRequest(endpoint, data) {
            requestCache.set(endpoint, {
                data: data,
                timestamp: Date.now()
            });
            
            // Clean up old cache entries
            if (requestCache.size > 100) {
                const entries = Array.from(requestCache.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                for (let i = 0; i < 20; i++) {
                    requestCache.delete(entries[i][0]);
                }
            }
        }
        
        async function getRandomObjectIds(count = 50) {
            try {
                MetLogger.log('Fetching random object IDs...');
                const data = await fetchWithProxy('/objects');
                
                if (!data || !data.objectIDs || data.objectIDs.length === 0) {
                    throw new Error('No objects returned from API');
                }
                
                const shuffled = data.objectIDs.sort(() => 0.5 - Math.random());
                return shuffled.slice(0, count);
                
            } catch (error) {
                MetLogger.error('Error getting object IDs:', error);
                return [435809, 11737, 436944, 436964, 436965, 438144, 438821, 437386, 435888, 437394];
            }
        }
        
        async function getObjectDetails(objectId) {
            const cached = detailsCache.get(objectId);
            if (cached && Date.now() - cached.timestamp < CONFIG.IMAGE_CACHE_DURATION) {
                MetLogger.log(`Using cached details for object ${objectId}`);
                return cached.data;
            }
            
            try {
                MetLogger.log(`Fetching details for object ${objectId}`);
                const data = await fetchWithProxy(`/objects/${objectId}`);
                
                if (data && (data.primaryImage || data.primaryImageSmall)) {
                    detailsCache.set(objectId, {
                        data: data,
                        timestamp: Date.now()
                    });
                    
                    if (detailsCache.size > 200) {
                        const entries = Array.from(detailsCache.entries());
                        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                        for (let i = 0; i < 50; i++) {
                            detailsCache.delete(entries[i][0]);
                        }
                    }
                    
                    // Preload image for better performance
                    preloadImage(data);
                    
                    return data;
                }
                
                MetLogger.log(`Object ${objectId} has no image`);
                return null;
            } catch (error) {
                MetLogger.error(`Error fetching object ${objectId}:`, error);
                return null;
            }
        }
        
        function preloadImage(artwork) {
            if (artwork.primaryImageSmall) {
                const img = new Image();
                img.src = loadArtworkImage(artwork.primaryImageSmall);
            }
        }
        
        async function getRandomArtwork() {
            try {
                MetUI.showLoading();
                MetUI.updateLoadingMessage('Finding artwork...');
                
                if (!navigator.onLine) {
                    MetLogger.log('Offline - attempting to load cached artwork');
                    MetUI.updateLoadingMessage('Loading from your saved collection...');
                    const cachedArtwork = await getRandomCachedArtwork();
                    if (cachedArtwork) {
                        MetUI.hideLoading();
                        return cachedArtwork;
                    }
                }
                
                const objectIds = await getRandomObjectIds(50);
                
                if (!objectIds || objectIds.length === 0) {
                    throw new Error('No object IDs available');
                }
                
                let artwork = null;
                const maxAttempts = Math.min(5, objectIds.length);
                
                for (let i = 0; i < maxAttempts; i++) {
                    const randomIndex = Math.floor(Math.random() * objectIds.length);
                    const objectId = objectIds[randomIndex];
                    
                    MetLogger.log(`Attempt ${i + 1}: Trying object ${objectId}`);
                    const details = await getObjectDetails(objectId);
                    
                    if (details) {
                        artwork = details;
                        break;
                    }
                    
                    objectIds.splice(randomIndex, 1);
                }
                
                MetUI.hideLoading();
                
                if (!artwork) {
                    throw new Error('Could not find any artwork with images');
                }
                
                return artwork;
                
            } catch (error) {
                MetLogger.error('Error getting random artwork:', error);
                MetUI.hideLoading();
                
                // Try to load from cache if available
                const cachedArtwork = await getRandomCachedArtwork();
                if (cachedArtwork) {
                    MetUI.updateStatus('Loaded from your collection', 'info');
                    return cachedArtwork;
                }
                
                const errorMessage = !navigator.onLine ? 
                    'Check your internet connection' : 
                    "The museum's servers are busy. Try again in a moment.";
                MetUI.showError(errorMessage);
                return null;
            }
        }
        
        async function testConnection() {
            try {
                const data = await fetchWithProxy('/departments');
                MetLogger.log('API connection successful');
                return true;
            } catch (error) {
                MetLogger.error('API connection failed:', error);
                return false;
            }
        }
        
        function loadArtworkImage(imageUrl) {
            if (!imageUrl) return '';
            
            if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
                return imageUrl;
            }
            
            const secureUrl = imageUrl.replace(/^http:/, 'https:');
            return getProxyUrl(secureUrl, currentProxy);
        }
        
        async function testProxyHealth() {
            const testImageUrl = 'https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg';
            
            MetLogger.log('Testing proxy health...');
            
            const tests = ['primary', 'fallback'].map(async (proxyType) => {
                const cache = proxyHealthCache[proxyType];
                if (Date.now() - cache.lastCheck < PROXY_HEALTH_CHECK_INTERVAL) {
                    return { proxy: proxyType, healthy: cache.healthy, cached: true };
                }
                
                try {
                    const proxiedUrl = getProxyUrl(testImageUrl, proxyType);
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);
                    
                    const startTime = Date.now();
                    const response = await fetch(proxiedUrl, {
                        method: 'HEAD',
                        signal: controller.signal
                    });
                    const responseTime = Date.now() - startTime;
                    
                    clearTimeout(timeoutId);
                    
                    const healthy = response.ok;
                    proxyHealthCache[proxyType] = {
                        healthy,
                        lastCheck: Date.now(),
                        responseTime: healthy ? responseTime : null
                    };
                    
                    return { proxy: proxyType, healthy, responseTime };
                } catch (error) {
                    proxyHealthCache[proxyType] = {
                        healthy: false,
                        lastCheck: Date.now(),
                        responseTime: null
                    };
                    return { proxy: proxyType, healthy: false, error: error.message };
                }
            });
            
            const results = await Promise.all(tests);
            
            const healthyProxies = results.filter(r => r.healthy);
            if (healthyProxies.length === 0) {
                MetLogger.error('No healthy proxies found');
                return false;
            }
            
            if (healthyProxies.find(r => r.proxy === 'primary')) {
                currentProxy = 'primary';
            } else {
                currentProxy = healthyProxies[0].proxy;
            }
            
            MetLogger.log(`Selected ${currentProxy} proxy (${healthyProxies.length} healthy proxies)`);
            
            if (CONFIG.DEBUG_MODE) {
                MetUI.updateStatus(`Proxy: ${currentProxy} ✓`, 'info');
            }
            
            return true;
        }
        
        async function getRandomCachedArtwork() {
            try {
                const cached = Array.from(detailsCache.values())
                    .filter(item => item.data && (item.data.primaryImage || item.data.primaryImageSmall));
                
                if (cached.length > 0) {
                    const randomIndex = Math.floor(Math.random() * cached.length);
                    return cached[randomIndex].data;
                }
                
                return null;
            } catch (error) {
                MetLogger.error('Error getting cached artwork:', error);
                return null;
            }
        }
        
        async function preloadNextArtworks() {
            if (isPreloading || preloadQueue.length >= CONFIG.PRELOAD_COUNT) return;
            
            isPreloading = true;
            try {
                const objectIds = await getRandomObjectIds(CONFIG.PRELOAD_COUNT * 2);
                
                for (const objectId of objectIds) {
                    if (preloadQueue.length >= CONFIG.PRELOAD_COUNT) break;
                    
                    // Check if already cached
                    if (detailsCache.has(objectId)) continue;
                    
                    const details = await getObjectDetails(objectId);
                    if (details) {
                        preloadQueue.push(objectId);
                        MetLogger.log(`Preloaded artwork ${objectId}`);
                    }
                }
            } catch (error) {
                MetLogger.error('Error preloading artworks:', error);
            } finally {
                isPreloading = false;
            }
        }
        
        async function getPreloadedArtwork() {
            while (preloadQueue.length > 0) {
                const objectId = preloadQueue.shift();
                const cached = detailsCache.get(objectId);
                if (cached && cached.data) {
                    // Start preloading more in background
                    setTimeout(preloadNextArtworks, 1000);
                    return cached.data;
                }
            }
            return null;
        }
        
        function getCacheInfo() {
            return {
                cachedArtworks: detailsCache.size,
                cachedRequests: requestCache.size,
                preloadedArtworks: preloadQueue.length
            };
        }
        
        return {
            getRandomArtwork,
            getObjectDetails,
            testConnection,
            loadArtworkImage,
            testProxyHealth,
            rotateProxy,
            preloadNextArtworks,
            getPreloadedArtwork,
            getCacheInfo,
            getRandomCachedArtwork
        };
    })();
    
    // ===========================
    // Favorites Module
    // ===========================
    const MetFavorites = (() => {
        const FAVORITES_DB_NAME = 'MetArtFavorites';
        const FAVORITES_DB_VERSION = 1;
        const FAVORITES_STORE_NAME = 'favorites';
        const MAX_FAVORITES = 100;
        const THUMBNAIL_MAX_SIZE = 300;
        
        const thumbnailCache = new Map();
        const THUMBNAIL_CACHE_NAME = 'met-thumbnails';
        
        let db = null;
        
        async function initFavoritesDB() {
            if (db && db.objectStoreNames.contains(FAVORITES_STORE_NAME)) {
                return db;
            }
            
            return new Promise((resolve, reject) => {
                if (!window.indexedDB) {
                    const error = new Error('IndexedDB is not supported in this browser');
                    console.error(error.message);
                    reject(error);
                    return;
                }
                
                const request = indexedDB.open(FAVORITES_DB_NAME, FAVORITES_DB_VERSION);
                
                request.onerror = () => {
                    const error = request.error || new Error('Failed to open favorites database');
                    MetLogger.error('IndexedDB error:', error);
                    reject(error);
                };
                
                request.onsuccess = (event) => {
                    db = event.target.result;
                    
                    db.onerror = (event) => {
                        MetLogger.error('Database error:', event.target.error);
                    };
                    
                    db.onversionchange = () => {
                        db.close();
                        db = null;
                        MetLogger.log('Database version changed, connection closed');
                    };
                    
                    MetLogger.log('Favorites database opened successfully');
                    resolve(db);
                };
                
                request.onupgradeneeded = (event) => {
                    db = event.target.result;
                    
                    if (!db.objectStoreNames.contains(FAVORITES_STORE_NAME)) {
                        const objectStore = db.createObjectStore(FAVORITES_STORE_NAME, { 
                            keyPath: 'objectID' 
                        });
                        
                        objectStore.createIndex('dateAdded', 'dateAdded', { unique: false });
                        objectStore.createIndex('department', 'department', { unique: false });
                        objectStore.createIndex('isHighlight', 'isHighlight', { unique: false });
                        
                        MetLogger.log('Favorites object store created');
                    }
                };
                
                request.onblocked = () => {
                    MetLogger.warn('Database blocked by another connection');
                };
            });
        }
        
        async function initThumbnailCache() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(THUMBNAIL_CACHE_NAME, 1);
                
                request.onerror = () => {
                    MetLogger.error('Failed to open thumbnail cache');
                    reject(request.error);
                };
                
                request.onsuccess = (event) => {
                    resolve(event.target.result);
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('thumbnails')) {
                        const store = db.createObjectStore('thumbnails', { keyPath: 'objectID' });
                        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                    }
                };
            });
        }
        
        async function getCachedThumbnail(objectID) {
            if (thumbnailCache.has(objectID)) {
                return thumbnailCache.get(objectID);
            }
            
            try {
                const db = await initThumbnailCache();
                const transaction = db.transaction(['thumbnails'], 'readonly');
                const store = transaction.objectStore('thumbnails');
                const request = store.get(objectID);
                
                return new Promise((resolve) => {
                    request.onsuccess = () => {
                        const result = request.result;
                        if (result && result.thumbnail) {
                            thumbnailCache.set(objectID, result.thumbnail);
                            resolve(result.thumbnail);
                        } else {
                            resolve(null);
                        }
                    };
                    request.onerror = () => resolve(null);
                });
            } catch (error) {
                MetLogger.error('Error getting cached thumbnail:', error);
                return null;
            }
        }
        
        async function saveThumbnailToCache(objectID, thumbnail) {
            thumbnailCache.set(objectID, thumbnail);
            
            if (thumbnailCache.size > 50) {
                const firstKey = thumbnailCache.keys().next().value;
                thumbnailCache.delete(firstKey);
            }
            
            try {
                const db = await initThumbnailCache();
                const transaction = db.transaction(['thumbnails'], 'readwrite');
                const store = transaction.objectStore('thumbnails');
                
                store.put({
                    objectID: objectID,
                    thumbnail: thumbnail,
                    lastAccessed: Date.now()
                });
            } catch (error) {
                MetLogger.error('Error saving thumbnail to cache:', error);
            }
        }
        
        async function createThumbnail(imageUrl, objectID) {
            if (objectID) {
                const cached = await getCachedThumbnail(objectID);
                if (cached) {
                    MetLogger.log(`Using cached thumbnail for ${objectID}`);
                    return cached;
                }
            }
            
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                const timeout = setTimeout(() => {
                    MetLogger.warn('Thumbnail creation timed out');
                    img.src = '';
                    resolve(null);
                }, 5000);
                
                img.onload = () => {
                    clearTimeout(timeout);
                    
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        if (!ctx) {
                            MetLogger.error('Canvas context not available');
                            resolve(null);
                            return;
                        }
                        
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > height) {
                            if (width > THUMBNAIL_MAX_SIZE) {
                                height = Math.floor((height * THUMBNAIL_MAX_SIZE) / width);
                                width = THUMBNAIL_MAX_SIZE;
                            }
                        } else {
                            if (height > THUMBNAIL_MAX_SIZE) {
                                width = Math.floor((width * THUMBNAIL_MAX_SIZE) / height);
                                height = THUMBNAIL_MAX_SIZE;
                            }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        const dataUrl = canvas.toDataURL('image/webp', 0.85);
                        const thumbnail = dataUrl.includes('data:image/webp') ? dataUrl : canvas.toDataURL('image/jpeg', 0.85);
                        
                        if (objectID) {
                            saveThumbnailToCache(objectID, thumbnail);
                        }
                        
                        resolve(thumbnail);
                    } catch (error) {
                        MetLogger.error('Error creating thumbnail:', error);
                        resolve(null);
                    }
                };
                
                img.onerror = () => {
                    clearTimeout(timeout);
                    MetLogger.error('Failed to load image for thumbnail');
                    resolve(null);
                };
                
                img.src = imageUrl;
            });
        }
        
        async function addToFavorites(artwork) {
            try {
                if (!db) {
                    await initFavoritesDB();
                }
                
                if (!artwork || !artwork.objectID) {
                    throw new Error('Invalid artwork object');
                }
                
                const count = await getFavoritesCount();
                if (count >= MAX_FAVORITES) {
                    await removeOldestFavorite();
                }
                
                let thumbnail = null;
                if (artwork.primaryImageSmall) {
                    const imageUrl = MetAPI.loadArtworkImage(artwork.primaryImageSmall);
                    thumbnail = await createThumbnail(imageUrl, artwork.objectID);
                }
                
                const favorite = {
                    objectID: artwork.objectID,
                    title: artwork.title || 'Untitled',
                    artistDisplayName: artwork.artistDisplayName || 'Unknown Artist',
                    objectDate: artwork.objectDate || '',
                    department: artwork.department || '',
                    medium: artwork.medium || '',
                    primaryImage: artwork.primaryImage,
                    primaryImageSmall: artwork.primaryImageSmall,
                    thumbnail: thumbnail,
                    objectURL: artwork.objectURL,
                    dateAdded: new Date().toISOString(),
                    artistNationality: artwork.artistNationality || '',
                    artistBeginDate: artwork.artistBeginDate || '',
                    artistEndDate: artwork.artistEndDate || '',
                    objectBeginDate: artwork.objectBeginDate || 0,
                    objectEndDate: artwork.objectEndDate || 0,
                    dimensions: artwork.dimensions || '',
                    creditLine: artwork.creditLine || '',
                    repository: artwork.repository || '',
                    isHighlight: artwork.isHighlight || false,
                    isPublicDomain: artwork.isPublicDomain || false
                };
                
                const transaction = db.transaction([FAVORITES_STORE_NAME], 'readwrite');
                const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
                
                const request = objectStore.put(favorite);
                
                return new Promise((resolve, reject) => {
                    transaction.oncomplete = () => {
                        MetLogger.log(`Added artwork ${artwork.objectID} to favorites`);
                        
                        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                            try {
                                navigator.serviceWorker.controller.postMessage({
                                    type: 'CACHE_FAVORITE',
                                    objectID: artwork.objectID,
                                    imageUrl: artwork.primaryImage
                                });
                            } catch (error) {
                                MetLogger.warn('Failed to notify service worker:', error);
                            }
                        }
                        
                        resolve(true);
                    };
                    
                    request.onerror = () => {
                        const error = request.error || new Error('Failed to add favorite');
                        MetLogger.error('Failed to add favorite:', error);
                        reject(error);
                    };
                });
            } catch (error) {
                MetLogger.error('Error adding to favorites:', error);
                throw error;
            }
        }
        
        async function removeFromFavorites(objectID) {
            if (!db) await initFavoritesDB();
            
            const transaction = db.transaction([FAVORITES_STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
            const request = objectStore.delete(objectID);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    MetLogger.log(`Removed artwork ${objectID} from favorites`);
                    resolve(true);
                };
                
                request.onerror = () => {
                    MetLogger.error('Failed to remove favorite');
                    reject(request.error);
                };
            });
        }
        
        async function isFavorited(objectID) {
            if (!db) await initFavoritesDB();
            
            const transaction = db.transaction([FAVORITES_STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
            const request = objectStore.get(objectID);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result !== undefined);
                };
                
                request.onerror = () => {
                    MetLogger.error('Failed to check favorite status');
                    reject(request.error);
                };
            });
        }
        
        async function getAllFavorites() {
            if (!db) await initFavoritesDB();
            
            const transaction = db.transaction([FAVORITES_STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
            const index = objectStore.index('dateAdded');
            const request = index.openCursor(null, 'prev');
            
            const favorites = [];
            
            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        favorites.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(favorites);
                    }
                };
                
                request.onerror = () => {
                    MetLogger.error('Failed to get favorites');
                    reject(request.error);
                };
            });
        }
        
        async function getFavorite(objectID) {
            if (!db) await initFavoritesDB();
            
            const transaction = db.transaction([FAVORITES_STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
            const request = objectStore.get(objectID);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };
                
                request.onerror = () => {
                    MetLogger.error('Failed to get favorite');
                    reject(request.error);
                };
            });
        }
        
        async function getFavoritesCount() {
            if (!db) await initFavoritesDB();
            
            const transaction = db.transaction([FAVORITES_STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
            const request = objectStore.count();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };
                
                request.onerror = () => {
                    MetLogger.error('Failed to get favorites count');
                    reject(request.error);
                };
            });
        }
        
        async function removeOldestFavorite() {
            if (!db) await initFavoritesDB();
            
            const transaction = db.transaction([FAVORITES_STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
            const index = objectStore.index('dateAdded');
            const request = index.openCursor();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        objectStore.delete(cursor.value.objectID);
                        MetLogger.log(`Removed oldest favorite: ${cursor.value.objectID}`);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                };
                
                request.onerror = () => {
                    MetLogger.error('Failed to remove oldest favorite');
                    reject(request.error);
                };
            });
        }
        
        async function clearAllFavorites() {
            if (!db) await initFavoritesDB();
            
            const transaction = db.transaction([FAVORITES_STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
            const request = objectStore.clear();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    MetLogger.log('Cleared all favorites');
                    resolve(true);
                };
                
                request.onerror = () => {
                    MetLogger.error('Failed to clear favorites');
                    reject(request.error);
                };
            });
        }
        
        async function toggleFavorite(artwork) {
            const favorited = await isFavorited(artwork.objectID);
            
            if (favorited) {
                await removeFromFavorites(artwork.objectID);
                return false;
            } else {
                await addToFavorites(artwork);
                return true;
            }
        }
        
        return {
            initFavoritesDB,
            addToFavorites,
            removeFromFavorites,
            isFavorited,
            getAllFavorites,
            getFavorite,
            getFavoritesCount,
            clearAllFavorites,
            toggleFavorite
        };
    })();
    
    // ===========================
    // Artwork Display Module
    // ===========================
    const MetArtwork = (() => {
        async function displayArtwork(artwork) {
            if (!artwork) {
                MetLogger.error('No artwork data provided');
                return;
            }
            
            const artworkContainer = document.getElementById('artworkContainer');
            const artworkInfo = document.getElementById('artworkInfo');
            
            artworkContainer.innerHTML = '';
            artworkInfo.innerHTML = '';
            
            if (artwork.primaryImage) {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'artwork-image-container';
                
                const loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'loading-indicator';
                loadingIndicator.innerHTML = `
                    <div class="loading-spinner"></div>
                    <div class="loading-progress" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-text">0%</div>
                    </div>
                `;
                imgContainer.appendChild(loadingIndicator);
                
                const placeholderCanvas = document.createElement('canvas');
                placeholderCanvas.className = 'image-placeholder';
                imgContainer.appendChild(placeholderCanvas);
                
                const img = document.createElement('img');
                img.className = 'artwork-image hidden';
                img.alt = artwork.title || 'Artwork from The Metropolitan Museum of Art';
                
                const lowResImg = artwork.primaryImageSmall || artwork.primaryImage;
                const highResImg = artwork.primaryImage;
                
                const createBlurPlaceholder = async (imageUrl) => {
                    return new Promise((resolve) => {
                        const tempImg = new Image();
                        tempImg.crossOrigin = 'anonymous';
                        tempImg.onload = () => {
                            const ctx = placeholderCanvas.getContext('2d');
                            placeholderCanvas.width = 32;
                            placeholderCanvas.height = 32;
                            ctx.filter = 'blur(3px)';
                            ctx.drawImage(tempImg, 0, 0, 32, 32);
                            placeholderCanvas.style.filter = 'blur(20px) brightness(1.1)';
                            placeholderCanvas.classList.add('visible');
                            resolve();
                        };
                        tempImg.onerror = () => resolve();
                        tempImg.src = imageUrl;
                    });
                };
                
                if (lowResImg !== highResImg && artwork.primaryImageSmall) {
                    const lowResUrl = MetAPI.loadArtworkImage(lowResImg);
                    await createBlurPlaceholder(lowResUrl);
                    
                    const placeholder = new Image();
                    placeholder.src = lowResUrl;
                    placeholder.onload = () => {
                        img.style.filter = 'blur(8px) brightness(1.05)';
                        img.style.transition = 'filter 0.6s ease-out';
                        img.src = placeholder.src;
                        img.classList.remove('hidden');
                        placeholderCanvas.style.opacity = '0';
                    };
                }
                
                const loadImageWithProgress = (url) => {
                    return new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', url, true);
                        xhr.responseType = 'blob';
                        
                        xhr.onprogress = (event) => {
                            if (event.lengthComputable) {
                                const percentComplete = Math.round((event.loaded / event.total) * 100);
                                const progressEl = loadingIndicator.querySelector('.loading-progress');
                                const progressFill = loadingIndicator.querySelector('.progress-fill');
                                const progressText = loadingIndicator.querySelector('.progress-text');
                                
                                if (progressEl && event.total > 1048576) {
                                    progressEl.style.display = 'block';
                                    loadingIndicator.querySelector('.loading-spinner').style.display = 'none';
                                    progressFill.style.width = percentComplete + '%';
                                    progressText.textContent = percentComplete + '%';
                                }
                            }
                        };
                        
                        xhr.onload = () => {
                            if (xhr.status === 200) {
                                const blob = xhr.response;
                                const blobUrl = URL.createObjectURL(blob);
                                resolve(blobUrl);
                            } else {
                                reject(new Error('Failed to load image'));
                            }
                        };
                        
                        xhr.onerror = () => reject(new Error('Network error'));
                        xhr.ontimeout = () => reject(new Error('Request timeout'));
                        xhr.timeout = 30000;
                        
                        xhr.send();
                    });
                };
                
                img.onload = function() {
                    loadingIndicator.remove();
                    placeholderCanvas.remove();
                    img.classList.remove('hidden');
                    if (img.style.filter) {
                        requestAnimationFrame(() => {
                            img.style.filter = 'none';
                        });
                    }
                    if (img.src.startsWith('blob:')) {
                        setTimeout(() => URL.revokeObjectURL(img.src), 1000);
                    }
                };
                
                img.onerror = function() {
                    loadingIndicator.remove();
                    placeholderCanvas.remove();
                    
                    const errorType = img.dataset.errorType || 'unknown';
                    let errorMessage = "This artwork's image isn't available. Here's another!";
                    let errorDetails = '';
                    
                    if (errorType === 'timeout') {
                        errorMessage = 'Image is taking longer to load';
                        errorDetails = 'Your connection might be slow. Try again?';
                    } else if (errorType === 'proxy') {
                        errorDetails = 'Having trouble reaching the museum. Try again in a moment.';
                    } else if (!navigator.onLine) {
                        errorMessage = 'You\'re offline';
                        errorDetails = 'Check your internet connection.';
                    } else {
                        errorDetails = 'The museum might be updating this image.';
                    }
                    
                    if (artwork.primaryImageSmall && artwork.primaryImageSmall !== highResImg && !img.dataset.smallImageTried) {
                        MetLogger.log('High-res proxy failed, trying small image through proxy');
                        img.dataset.smallImageTried = 'true';
                        const smallProxyUrl = MetAPI.loadArtworkImage(artwork.primaryImageSmall);
                        img.src = smallProxyUrl;
                        return;
                    }
                    
                    imgContainer.innerHTML = `
                        <div class="artwork-placeholder artwork-placeholder-error">
                            <div class="placeholder-icon">
                                <i class="fas fa-image"></i>
                                <i class="fas fa-exclamation-circle error-badge"></i>
                            </div>
                            <h3>${errorMessage}</h3>
                            <p class="error-details">${errorDetails}</p>
                            <div class="placeholder-actions">
                                <button class="retry-button primary" id="retryImageBtn">
                                    <i class="fas fa-redo"></i> Try Again
                                </button>
                                <button class="retry-button secondary" id="loadNewArtworkBtn">
                                    <i class="fas fa-dice"></i> Show Another Artwork
                                </button>
                                <a href="${artwork.objectURL}" target="_blank" class="view-met-link">
                                    <i class="fas fa-external-link-alt"></i> View on Met Website
                                </a>
                            </div>
                        </div>
                    `;
                    
                    const retryBtn = imgContainer.querySelector('#retryImageBtn');
                    const loadNewBtn = imgContainer.querySelector('#loadNewArtworkBtn');
                    
                    if (retryBtn) {
                        let retryCount = 0;
                        retryBtn.addEventListener('click', async function() {
                            retryCount++;
                            retryBtn.disabled = true;
                            if (loadNewBtn) loadNewBtn.disabled = true;
                            retryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retrying...';
                            
                            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            
                            displayArtwork(artwork);
                        });
                    }
                    
                    if (loadNewBtn) {
                        loadNewBtn.addEventListener('click', async function() {
                            if (retryBtn) retryBtn.disabled = true;
                            loadNewBtn.disabled = true;
                            loadNewBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                            
                            // Load a new artwork instead
                            const newArtwork = await MetAPI.getRandomArtwork();
                            if (newArtwork) {
                                displayArtwork(newArtwork);
                            }
                        });
                    }
                    
                    MetLogger.error(`Failed to load image through proxy: ${artwork.primaryImage}`);
                };
                
                // Main artwork image should load immediately (not lazy)
                img.decoding = 'async';
                
                const loadImageWithProxy = async () => {
                    try {
                        const proxyUrl = MetAPI.loadArtworkImage(highResImg);
                        MetLogger.log(`Loading image via proxy: ${proxyUrl}`);
                        
                        if (artwork.primaryImage && !artwork.primaryImageSmall) {
                            try {
                                const blobUrl = await loadImageWithProgress(proxyUrl);
                                img.src = blobUrl;
                                return;
                            } catch (xhrError) {
                                MetLogger.warn('Progress loading failed, falling back to regular load:', xhrError);
                            }
                        }
                        
                        img.src = proxyUrl;
                        
                        const loadTimeout = setTimeout(() => {
                            if (!img.complete || img.naturalWidth === 0) {
                                MetLogger.log('Image loading timeout, trying fallback...');
                                img.dataset.errorType = 'timeout';
                                tryFallbackProxy();
                            }
                        }, 15000);
                        
                        img.addEventListener('load', () => clearTimeout(loadTimeout), { once: true });
                        img.addEventListener('error', () => {
                            clearTimeout(loadTimeout);
                            img.dataset.errorType = 'proxy';
                        }, { once: true });
                    } catch (error) {
                        MetLogger.error('Error setting up image load:', error);
                        img.dataset.errorType = 'proxy';
                        tryFallbackProxy();
                    }
                };
                
                const tryFallbackProxy = async () => {
                    // Fallback handling if needed
                };
                
                if ('IntersectionObserver' in window) {
                    const imageObserver = new IntersectionObserver((entries, observer) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                loadImageWithProxy();
                                observer.unobserve(entry.target);
                            }
                        });
                    }, {
                        rootMargin: '50px'
                    });
                    
                    imgContainer.appendChild(img);
                    artworkContainer.appendChild(imgContainer);
                    imageObserver.observe(img);
                } else {
                    imgContainer.appendChild(img);
                    artworkContainer.appendChild(imgContainer);
                    loadImageWithProxy();
                }
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'artwork-placeholder';
                placeholder.innerHTML = `
                    <i class="fas fa-paint-brush"></i>
                    <p>No image available for this artwork</p>
                `;
                artworkContainer.appendChild(placeholder);
            }
            
            let isFavorited = false;
            try {
                isFavorited = await MetFavorites.isFavorited(artwork.objectID);
            } catch (error) {
                MetLogger.error('Error checking favorite status:', error);
            }
            
            const infoHTML = `
                <div class="artwork-info-header">
                    <h2 class="artwork-title">${artwork.title || 'Untitled'}</h2>
                    <button class="favorite-button ${isFavorited ? 'favorited' : ''}" 
                            id="favoriteBtn" 
                            data-object-id="${artwork.objectID}"
                            title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}"
                            aria-label="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
                        <i class="fas fa-heart"></i>
                        <span class="favorite-button-text visually-hidden">${isFavorited ? 'Favorited' : 'Favorite'}</span>
                    </button>
                </div>
                ${artwork.artistDisplayName ? `<p class="artwork-artist">${artwork.artistDisplayName}</p>` : ''}
                ${artwork.objectDate ? `<p class="artwork-date">${artwork.objectDate}</p>` : ''}
                ${artwork.medium ? `<p class="artwork-medium">${artwork.medium}</p>` : ''}
                ${artwork.dimensions ? `<p class="artwork-dimensions">${artwork.dimensions}</p>` : ''}
                ${artwork.department ? `<p class="artwork-department">${artwork.department}</p>` : ''}
                ${artwork.creditLine ? `<p class="artwork-credit">${artwork.creditLine}</p>` : ''}
                <p class="artwork-link"><a href="${artwork.objectURL}" target="_blank">View on The Met website</a></p>
            `;
            
            artworkInfo.innerHTML = infoHTML;
            
            const favoriteBtn = document.getElementById('favoriteBtn');
            if (favoriteBtn) {
                favoriteBtn.addEventListener('click', async () => {
                    try {
                        favoriteBtn.disabled = true;
                        
                        const newStatus = await MetFavorites.toggleFavorite(artwork);
                        
                        if (newStatus) {
                            favoriteBtn.classList.add('favorited');
                            favoriteBtn.title = 'Remove from favorites';
                            const btnText = favoriteBtn.querySelector('.favorite-button-text');
                            if (btnText) btnText.textContent = 'Favorited';
                            
                            favoriteBtn.classList.add('favorite-animation');
                            setTimeout(() => {
                                favoriteBtn.classList.remove('favorite-animation');
                            }, 600);
                            
                            MetUI.updateStatus('Added to favorites', 'success');
                        } else {
                            favoriteBtn.classList.remove('favorited');
                            favoriteBtn.title = 'Add to favorites';
                            const btnText = favoriteBtn.querySelector('.favorite-button-text');
                            if (btnText) btnText.textContent = 'Favorite';
                            
                            MetUI.updateStatus('Removed from favorites', 'info');
                        }
                        
                        favoriteBtn.disabled = false;
                    } catch (error) {
                        MetLogger.error('Error toggling favorite:', error);
                        favoriteBtn.disabled = false;
                        MetUI.updateStatus('Error updating favorites', 'error');
                    }
                });
            }
            
            MetLogger.log('Displayed artwork:', artwork);
            
            // Update mobile info panel if available
            if (window.MetUI && window.MetUI.updateMobileInfoPanel) {
                window.MetUI.updateMobileInfoPanel(artwork);
            }
        }
        
        function displayFavoriteArtwork(favorite) {
            const artwork = {
                objectID: favorite.objectID,
                title: favorite.title,
                artistDisplayName: favorite.artistDisplayName,
                objectDate: favorite.objectDate,
                department: favorite.department,
                medium: favorite.medium,
                primaryImage: favorite.primaryImage,
                primaryImageSmall: favorite.primaryImageSmall,
                objectURL: favorite.objectURL,
                dimensions: favorite.dimensions,
                creditLine: favorite.creditLine,
                artistNationality: favorite.artistNationality,
                artistBeginDate: favorite.artistBeginDate,
                artistEndDate: favorite.artistEndDate,
                objectBeginDate: favorite.objectBeginDate,
                objectEndDate: favorite.objectEndDate,
                repository: favorite.repository,
                isHighlight: favorite.isHighlight,
                isPublicDomain: favorite.isPublicDomain
            };
            
            displayArtwork(artwork);
        }
        
        return {
            displayArtwork,
            displayFavoriteArtwork
        };
    })();
    
    // ===========================
    // UI Module
    // ===========================
    const MetUI = (() => {
        let favoritesModalOpen = false;
        let infoPanelExpanded = false;
        let currentArtwork = null;
        
        function initUI() {
            initButtons();
            initFavoritesModal();
            initMobileUI();
            initKeyboardShortcuts();
            initPullToRefresh();
            initOfflineDetection();
            addStatusIndicator();
            MetLogger.log('UI initialized');
        }
        
        function initButtons() {
            // Random artwork button (both mobile and desktop)
            const randomButtons = document.querySelectorAll('#randomArtButton');
            randomButtons.forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.preventDefault();
                    // Haptic feedback on mobile
                    if ('vibrate' in navigator && window.innerWidth < 768) {
                        navigator.vibrate(10);
                    }
                    // Try to get preloaded artwork first for better performance
                    let artwork = null;
                    if (MetAPI.getPreloadedArtwork) {
                        artwork = await MetAPI.getPreloadedArtwork();
                    }
                    
                    if (!artwork) {
                        artwork = await MetAPI.getRandomArtwork();
                    }
                    
                    if (artwork) {
                        currentArtwork = artwork;
                        MetArtwork.displayArtwork(artwork);
                        // Update mobile info panel
                        updateMobileInfoPanel(artwork);
                        
                        // Preload more in background
                        setTimeout(() => {
                            if (navigator.onLine && MetAPI.preloadNextArtworks) {
                                MetAPI.preloadNextArtworks();
                            }
                        }, 1000);
                    }
                });
            });
            
            // Favorites button
            const favoritesButtons = document.querySelectorAll('#favoritesButton, #viewFavoritesButton');
            favoritesButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    if ('vibrate' in navigator && window.innerWidth < 768) {
                        navigator.vibrate(10);
                    }
                    showFavoritesModal();
                });
            });
            
            // Mobile info button
            const infoButton = document.getElementById('infoButton');
            if (infoButton) {
                infoButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    if ('vibrate' in navigator) {
                        navigator.vibrate(10);
                    }
                    toggleInfoPanel();
                });
            }
        }
        
        function initFavoritesModal() {
            const modal = document.getElementById('favoritesModal');
            const closeBtn = document.getElementById('closeFavoritesModal');
            const clearBtn = document.getElementById('clearFavoritesButton');
            
            if (!modal) return;
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    hideFavoritesModal();
                });
            }
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    hideFavoritesModal();
                }
            });
            
            if (clearBtn) {
                clearBtn.addEventListener('click', async () => {
                    if (confirm('Are you sure you want to clear all favorites? This cannot be undone.')) {
                        await clearAllFavorites();
                    }
                });
            }
            
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && favoritesModalOpen) {
                    hideFavoritesModal();
                }
            });
        }
        
        async function showFavoritesModal() {
            if (favoritesModalOpen) return;
            
            const modal = document.getElementById('favoritesModal');
            const grid = document.getElementById('favoritesGrid');
            const count = document.getElementById('favoritesCount');
            
            if (!modal || !grid) return;
            
            favoritesModalOpen = true;
            modal.classList.add('show');
            
            grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
            
            try {
                const favorites = await MetFavorites.getAllFavorites();
                
                if (count) {
                    count.textContent = favorites.length === 0 ? 'No favorites' :
                                       favorites.length === 1 ? '1 favorite' :
                                       `${favorites.length} favorites`;
                }
                
                if (favorites.length === 0) {
                    grid.innerHTML = `
                        <div class="favorites-empty">
                            <i class="fas fa-heart-broken"></i>
                            <p>You haven't added any favorites yet!</p>
                            <p>Click the heart icon on any artwork to save it here.</p>
                        </div>
                    `;
                } else {
                    grid.innerHTML = favorites.map(() => `
                        <div class="favorite-item skeleton-loader">
                            <div class="skeleton-image"></div>
                            <div class="favorite-item-info">
                                <div class="skeleton-text skeleton-title"></div>
                                <div class="skeleton-text skeleton-artist"></div>
                            </div>
                        </div>
                    `).join('');
                    
                    const imageObserver = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const item = entry.target;
                                const index = parseInt(item.dataset.index);
                                const fav = favorites[index];
                                
                                item.classList.remove('skeleton-loader');
                                item.innerHTML = `
                                    ${fav.thumbnail ? 
                                        `<img src="${fav.thumbnail}" alt="${fav.title}" class="favorite-item-image lazy-load" data-loaded="false">` :
                                        `<div class="favorite-item-placeholder"><i class="fas fa-image"></i></div>`
                                    }
                                    <div class="favorite-item-info">
                                        <div class="favorite-item-title">${fav.title || 'Untitled'}</div>
                                        <div class="favorite-item-artist">${fav.artistDisplayName || 'Unknown Artist'}</div>
                                    </div>
                                `;
                                
                                const img = item.querySelector('.favorite-item-image');
                                if (img) {
                                    img.onload = () => {
                                        img.classList.add('loaded');
                                        img.dataset.loaded = 'true';
                                    };
                                    
                                    img.onerror = () => {
                                        const placeholder = document.createElement('div');
                                        placeholder.className = 'favorite-item-placeholder';
                                        placeholder.innerHTML = '<i class="fas fa-image"></i>';
                                        img.replaceWith(placeholder);
                                    };
                                }
                                
                                item.addEventListener('click', async () => {
                                    await displayFavoriteFromModal(fav.objectID);
                                });
                                
                                imageObserver.unobserve(item);
                            }
                        });
                    }, {
                        rootMargin: '50px',
                        threshold: 0.01
                    });
                    
                    grid.querySelectorAll('.favorite-item').forEach((item, index) => {
                        item.dataset.index = index;
                        item.dataset.objectId = favorites[index].objectID;
                        imageObserver.observe(item);
                    });
                }
            } catch (error) {
                MetLogger.error('Error loading favorites:', error);
                grid.innerHTML = `
                    <div class="error-message">
                        <p>Error loading favorites</p>
                        <p class="error-details">${error.message || 'Please try again'}</p>
                    </div>
                `;
            }
        }
        
        async function displayFavoriteFromModal(objectId) {
            try {
                const favorite = await MetFavorites.getFavorite(objectId);
                if (favorite) {
                    hideFavoritesModal();
                    MetArtwork.displayArtwork(favorite);
                    updateStatus('Loaded from favorites', 'success');
                }
            } catch (error) {
                MetLogger.error('Error displaying favorite:', error);
                updateStatus('Error loading favorite', 'error');
            }
        }
        
        function hideFavoritesModal() {
            const modal = document.getElementById('favoritesModal');
            if (modal) {
                modal.classList.remove('show');
                favoritesModalOpen = false;
            }
        }
        
        async function clearAllFavorites() {
            const clearBtn = document.getElementById('clearFavoritesButton');
            if (clearBtn) {
                clearBtn.disabled = true;
                clearBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';
            }
            
            try {
                await MetFavorites.clearAllFavorites();
                updateStatus('All favorites cleared', 'success');
                showFavoritesModal();
            } catch (error) {
                MetLogger.error('Error clearing favorites:', error);
                updateStatus('Error clearing favorites', 'error');
            } finally {
                if (clearBtn) {
                    clearBtn.disabled = false;
                    clearBtn.innerHTML = '<i class="fas fa-trash"></i> Clear All';
                }
            }
        }
        
        function showLoading() {
            const container = document.getElementById('artworkContainer');
            if (container) {
                container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div class="loading-text">Loading...</div></div>';
            }
        }
        
        function hideLoading() {
            const loading = document.querySelector('.loading');
            if (loading) {
                loading.remove();
            }
        }
        
        function updateLoadingMessage(message) {
            const loadingText = document.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
        }
        
        function showError(message) {
            const container = document.getElementById('artworkContainer');
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>${message}</p>
                        <button class="retry-button primary" onclick="document.getElementById('randomArtButton').click()">
                            <i class="fas fa-dice"></i> Try Another Artwork
                        </button>
                    </div>
                `;
            }
        }
        
        function updateStatus(message, type = 'info') {
            const statusIndicator = document.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${type} show`;
                statusIndicator.textContent = message;
                
                setTimeout(() => {
                    statusIndicator.classList.remove('show');
                }, 3000);
            }
        }
        
        function addStatusIndicator() {
            if (!document.querySelector('.status-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'status-indicator';
                document.body.appendChild(indicator);
            }
        }
        
        function initOfflineDetection() {
            updateOnlineStatus(navigator.onLine);
            
            window.addEventListener('online', async () => {
                updateOnlineStatus(true);
                updateStatus('Back online!', 'success');
                
                // Preload artworks in background when back online
                setTimeout(() => {
                    if (window.MetAPI && window.MetAPI.preloadNextArtworks) {
                        window.MetAPI.preloadNextArtworks();
                    }
                }, 2000);
            });
            
            window.addEventListener('offline', () => {
                updateOnlineStatus(false);
            });
        }
        
        async function updateOnlineStatus(isOnline) {
            if (!isOnline) {
                const cacheInfo = window.MetAPI ? window.MetAPI.getCacheInfo() : { cachedArtworks: 0 };
                if (cacheInfo.cachedArtworks > 0) {
                    updateStatus(`Offline - ${cacheInfo.cachedArtworks} artworks available`, 'warning');
                } else {
                    updateStatus('Offline - no cached artworks', 'warning');
                }
            }
        }
        
        function initMobileUI() {
            // Initialize info panel
            const infoPanel = document.getElementById('mobileInfoPanel');
            const handle = infoPanel?.querySelector('.info-panel-handle');
            
            if (handle) {
                let startY = 0;
                let currentY = 0;
                let isDragging = false;
                
                handle.addEventListener('touchstart', (e) => {
                    startY = e.touches[0].clientY;
                    isDragging = true;
                    infoPanel.style.transition = 'none';
                });
                
                handle.addEventListener('touchmove', (e) => {
                    if (!isDragging) return;
                    currentY = e.touches[0].clientY;
                    const deltaY = currentY - startY;
                    
                    if (deltaY > 0) {
                        infoPanel.style.transform = `translateY(${deltaY}px)`;
                    }
                });
                
                handle.addEventListener('touchend', () => {
                    isDragging = false;
                    infoPanel.style.transition = '';
                    
                    const deltaY = currentY - startY;
                    if (deltaY > 100) {
                        collapseInfoPanel();
                    } else {
                        infoPanel.style.transform = '';
                    }
                });
                
                handle.addEventListener('click', toggleInfoPanel);
            }
            
            // Update active nav button
            updateActiveNavButton();
        }
        
        function toggleInfoPanel() {
            const infoPanel = document.getElementById('mobileInfoPanel');
            const infoButton = document.getElementById('infoButton');
            
            if (!infoPanel) return;
            
            if (infoPanelExpanded) {
                collapseInfoPanel();
            } else {
                expandInfoPanel();
            }
        }
        
        function expandInfoPanel() {
            const infoPanel = document.getElementById('mobileInfoPanel');
            const infoButton = document.getElementById('infoButton');
            
            if (infoPanel) {
                infoPanel.classList.add('expanded');
                infoPanelExpanded = true;
                infoButton?.classList.add('active');
            }
        }
        
        function collapseInfoPanel() {
            const infoPanel = document.getElementById('mobileInfoPanel');
            const infoButton = document.getElementById('infoButton');
            
            if (infoPanel) {
                infoPanel.classList.remove('expanded');
                infoPanel.style.transform = '';
                infoPanelExpanded = false;
                infoButton?.classList.remove('active');
            }
        }
        
        function updateMobileInfoPanel(artwork) {
            const mobileInfo = document.getElementById('artworkInfoMobile');
            if (!mobileInfo) return;
            
            // Copy desktop info to mobile panel
            const desktopInfo = document.getElementById('artworkInfo');
            if (desktopInfo && desktopInfo.innerHTML) {
                mobileInfo.innerHTML = desktopInfo.innerHTML;
                
                // Re-attach favorite button event listener
                const mobileFavBtn = mobileInfo.querySelector('#favoriteBtn');
                const desktopFavBtn = desktopInfo.querySelector('#favoriteBtn');
                if (mobileFavBtn && desktopFavBtn) {
                    mobileFavBtn.addEventListener('click', () => {
                        desktopFavBtn.click();
                    });
                }
            }
        }
        
        function updateActiveNavButton() {
            // Update active state based on current view
            const randomButton = document.querySelector('.mobile-nav #randomArtButton');
            randomButton?.classList.add('active');
        }
        
        function initKeyboardShortcuts() {
            if (window.innerWidth >= 768) {
                document.addEventListener('keydown', (e) => {
                    // Don't trigger shortcuts when typing in inputs
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                    
                    switch(e.key.toLowerCase()) {
                        case ' ': // Spacebar for random artwork
                            e.preventDefault();
                            document.getElementById('randomArtButton')?.click();
                            break;
                        case 'f': // F for favorite
                            e.preventDefault();
                            if (currentArtwork) {
                                document.getElementById('favoriteBtn')?.click();
                            }
                            break;
                        case 'escape':
                            if (favoritesModalOpen) {
                                hideFavoritesModal();
                            }
                            break;
                    }
                });
                
                // Add keyboard shortcuts info to desktop sidebar
                addKeyboardShortcutsInfo();
            }
        }
        
        function addKeyboardShortcutsInfo() {
            const sidebar = document.getElementById('desktopSidebar');
            if (!sidebar) return;
            
            const shortcutsDiv = document.createElement('div');
            shortcutsDiv.className = 'keyboard-shortcuts';
            shortcutsDiv.innerHTML = `
                <h3>Keyboard Shortcuts</h3>
                <div class="shortcut">
                    <span>Random Artwork</span>
                    <kbd>Space</kbd>
                </div>
                <div class="shortcut">
                    <span>Toggle Favorite</span>
                    <kbd>F</kbd>
                </div>
                <div class="shortcut">
                    <span>Close Modal</span>
                    <kbd>Esc</kbd>
                </div>
            `;
            
            sidebar.appendChild(shortcutsDiv);
        }
        
        function initPullToRefresh() {
            if (window.innerWidth >= 768) return;
            
            const container = document.getElementById('artworkContainer');
            if (!container) return;
            
            let startY = 0;
            let pullDistance = 0;
            let isPulling = false;
            
            // Check for reduced motion preference
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (prefersReducedMotion) return;
            
            // Create pull to refresh indicator
            const pullIndicator = document.createElement('div');
            pullIndicator.className = 'pull-to-refresh';
            pullIndicator.innerHTML = '<i class="fas fa-sync-alt"></i>';
            container.appendChild(pullIndicator);
            
            container.addEventListener('touchstart', (e) => {
                if (container.scrollTop === 0) {
                    startY = e.touches[0].clientY;
                    isPulling = true;
                }
            });
            
            container.addEventListener('touchmove', (e) => {
                if (!isPulling) return;
                
                const currentY = e.touches[0].clientY;
                pullDistance = currentY - startY;
                
                if (pullDistance > 0 && pullDistance < 150) {
                    e.preventDefault();
                    pullIndicator.style.top = `${pullDistance - 60}px`;
                    pullIndicator.style.opacity = Math.min(pullDistance / 100, 1);
                    
                    if (pullDistance > 80) {
                        pullIndicator.classList.add('visible');
                    } else {
                        pullIndicator.classList.remove('visible');
                    }
                }
            });
            
            container.addEventListener('touchend', async () => {
                if (pullDistance > 80 && isPulling) {
                    pullIndicator.classList.add('refreshing');
                    
                    // Haptic feedback
                    if ('vibrate' in navigator) {
                        navigator.vibrate(20);
                    }
                    
                    // Try to get preloaded artwork first
                    let artwork = null;
                    if (MetAPI.getPreloadedArtwork) {
                        artwork = await MetAPI.getPreloadedArtwork();
                    }
                    
                    if (!artwork) {
                        artwork = await MetAPI.getRandomArtwork();
                    }
                    
                    if (artwork) {
                        currentArtwork = artwork;
                        MetArtwork.displayArtwork(artwork);
                        updateMobileInfoPanel(artwork);
                    }
                    
                    pullIndicator.classList.remove('refreshing');
                }
                
                // Reset
                pullIndicator.style.top = '';
                pullIndicator.style.opacity = '';
                pullIndicator.classList.remove('visible');
                pullDistance = 0;
                isPulling = false;
            });
        }
        
        return {
            initUI,
            showLoading,
            hideLoading,
            updateLoadingMessage,
            showError,
            updateStatus,
            showFavoritesModal,
            hideFavoritesModal,
            updateMobileInfoPanel
        };
    })();
    
    // ===========================
    // Initialization
    // ===========================
    async function initialize() {
        try {
            MetLogger.log('Starting app initialization...');
            
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            await MetFavorites.initFavoritesDB();
            MetLogger.log('Favorites database initialized');
            
            MetUI.initUI();
            MetLogger.log('UI initialized');
            
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.register('./service-worker.js');
                    MetLogger.log('Service Worker registered:', registration.scope);
                    
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                MetUI.updateStatus('App update available - refresh to update', 'info');
                            }
                        });
                    });
                } catch (error) {
                    console.error('Service Worker registration failed:', error);
                }
            }
            
            try {
                MetUI.showLoading();
                MetUI.updateLoadingMessage('Connecting to Met Museum API...');
                
                const connected = await MetAPI.testConnection();
                
                if (connected) {
                    MetLogger.log('Connected to Met API successfully');
                    MetUI.updateStatus('Connected to Met API', 'success');
                } else {
                    throw new Error('Failed to connect to Met API');
                }
                
                MetUI.hideLoading();
            } catch (error) {
                MetLogger.error('API connection failed:', error);
                MetUI.hideLoading();
                MetUI.showError('Unable to connect to the Met Museum API. Please check your connection.');
            }
            
            MetAPI.testProxyHealth().catch(err => {
                MetLogger.warn('Proxy health check failed:', err);
            });
            
            // Start preloading artworks in background
            setTimeout(() => {
                if (navigator.onLine) {
                    MetAPI.preloadNextArtworks().catch(err => {
                        MetLogger.warn('Failed to preload artworks:', err);
                    });
                }
            }, 3000);
            
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('action') === 'random') {
                MetLogger.log('Auto-loading random artwork from PWA');
                setTimeout(() => {
                    document.getElementById('randomArtButton')?.click();
                }, 1000);
            }
            
            MetLogger.log('App initialization complete');
            
        } catch (error) {
            console.error('App initialization failed:', error);
            MetUI.showError('Application failed to initialize. Please refresh the page.');
        }
    }
    
    // Start the app
    initialize();
    
})();