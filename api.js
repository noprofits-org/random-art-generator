// api.js - Simplified Met Museum API module
// Core functions: getRandomArtwork, getObjectDetails, testConnection, loadArtworkImage

(function() {
    'use strict';
    
    // Configuration
    const MET_API_BASE_URL = window.MetConfig?.MET_API_BASE_URL || 'https://collectionapi.metmuseum.org/public/collection/v1';
    const REQUEST_TIMEOUT = window.MetConfig?.REQUEST_TIMEOUT || 15000;
    
    // Simplified proxy configuration - one primary, one fallback
    const PROXY_CONFIG = {
        primary: {
            url: window.MetConfig?.CORS_PROXY_URL || 'https://cors-proxy-xi-ten.vercel.app/api/proxy',
            format: 'query' // 'query' means ?url=, 'path' means direct append
        },
        fallback: {
            url: 'https://corsproxy.io/?',
            format: 'path'
        }
    };
    
    // Simple cache for object details
    const detailsCache = new Map();
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    
    // Proxy state
    let currentProxy = 'primary';
    let proxyHealthCache = {
        primary: { healthy: true, lastCheck: 0 },
        fallback: { healthy: true, lastCheck: 0 }
    };
    const PROXY_HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
    
    // Helper: Make API request with timeout
    async function fetchWithTimeout(url, timeout = REQUEST_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // Show timeout warning after 10 seconds
        const warningTimeout = setTimeout(() => {
            if (window.MetUI && window.MetUI.updateStatus) {
                window.MetUI.updateStatus('Taking longer than usual...', 'warning');
            }
        }, 10000);
        
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
                const errorMessage = response.status === 503 ? 'Service temporarily unavailable' :
                                    response.status === 429 ? 'Too many requests - please wait a moment' :
                                    response.status === 404 ? 'Content not found' :
                                    `Server error (${response.status})`;
                throw new Error(errorMessage);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            clearTimeout(warningTimeout);
            
            if (error.name === 'AbortError') {
                const timeoutMessage = timeout > 20000 ? 'Request took too long - the server might be busy' :
                                      'Request timed out - please check your connection';
                throw new Error(timeoutMessage);
            }
            throw error;
        }
    }
    
    // Helper: Get proxy URL
    function getProxyUrl(targetUrl, useProxy = currentProxy) {
        const proxy = PROXY_CONFIG[useProxy];
        
        if (proxy.format === 'path') {
            return `${proxy.url}${encodeURIComponent(targetUrl)}`;
        } else {
            return `${proxy.url}?url=${encodeURIComponent(targetUrl)}`;
        }
    }
    
    // Rotate to next proxy
    function rotateProxy() {
        const previousProxy = currentProxy;
        currentProxy = currentProxy === 'primary' ? 'fallback' : 'primary';
        window.MetLogger?.log(`Switched proxy from ${previousProxy} to ${currentProxy}`);
        
        // Show proxy info in dev mode
        if (window.MetConfig?.devMode || window.location.hostname === 'localhost') {
            showProxyStatus(`Using ${currentProxy} proxy`);
        }
        
        return currentProxy;
    }
    
    // Show proxy status (dev mode only)
    function showProxyStatus(message) {
        if (window.MetUI && window.MetUI.updateStatus) {
            window.MetUI.updateStatus(message, 'info');
        }
    }
    
    // Helper: Fetch through CORS proxy with fallback
    async function fetchWithProxy(endpoint, useProxy = null) {
        const fullUrl = `${MET_API_BASE_URL}${endpoint}`;
        const proxyToUse = useProxy || currentProxy;
        const proxiedUrl = getProxyUrl(fullUrl, proxyToUse);
        
        try {
            window.MetLogger?.log(`Fetching: ${endpoint} via ${proxyToUse} proxy`);
            const result = await fetchWithTimeout(proxiedUrl);
            
            // Mark proxy as healthy
            proxyHealthCache[proxyToUse].healthy = true;
            proxyHealthCache[proxyToUse].lastCheck = Date.now();
            
            return result;
        } catch (error) {
            window.MetLogger?.error(`${proxyToUse} proxy failed:`, error);
            
            // Mark proxy as unhealthy
            proxyHealthCache[proxyToUse].healthy = false;
            proxyHealthCache[proxyToUse].lastCheck = Date.now();
            
            // Try fallback if using primary
            if (proxyToUse === 'primary' && proxyHealthCache.fallback.healthy) {
                window.MetLogger?.log('Trying fallback proxy...');
                rotateProxy();
                return fetchWithProxy(endpoint, 'fallback');
            }
            
            throw error;
        }
    }
    
    // Get a list of random object IDs
    async function getRandomObjectIds(count = 50) {
        try {
            window.MetLogger?.log('Fetching random object IDs...');
            const data = await fetchWithProxy('/objects');
            
            if (!data || !data.objectIDs || data.objectIDs.length === 0) {
                throw new Error('No objects returned from API');
            }
            
            // Shuffle and return requested count
            const shuffled = data.objectIDs.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count);
            
        } catch (error) {
            window.MetLogger?.error('Error getting object IDs:', error);
            // Return fallback IDs (known working artwork IDs)
            return [435809, 11737, 436944, 436964, 436965, 438144, 438821, 437386, 435888, 437394];
        }
    }
    
    // Get details for a specific object
    async function getObjectDetails(objectId) {
        // Check cache first
        const cached = detailsCache.get(objectId);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            window.MetLogger?.log(`Using cached details for object ${objectId}`);
            return cached.data;
        }
        
        try {
            window.MetLogger?.log(`Fetching details for object ${objectId}`);
            const data = await fetchWithProxy(`/objects/${objectId}`);
            
            // Only return if it has an image
            if (data && (data.primaryImage || data.primaryImageSmall)) {
                // Cache the result
                detailsCache.set(objectId, {
                    data: data,
                    timestamp: Date.now()
                });
                
                // Limit cache size to prevent memory issues
                if (detailsCache.size > 200) {
                    // Remove oldest entries
                    const entries = Array.from(detailsCache.entries());
                    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                    for (let i = 0; i < 50; i++) {
                        detailsCache.delete(entries[i][0]);
                    }
                }
                
                return data;
            }
            
            window.MetLogger?.log(`Object ${objectId} has no image`);
            return null;
        } catch (error) {
            window.MetLogger?.error(`Error fetching object ${objectId}:`, error);
            return null;
        }
    }
    
    // Main function: Get a random artwork
    async function getRandomArtwork() {
        try {
            // Show loading state
            if (window.MetUI?.showLoading) {
                window.MetUI.showLoading();
                window.MetUI.updateLoadingMessage?.('Finding artwork...');
            }
            
            // Check if offline and try cached artwork first
            if (!navigator.onLine) {
                window.MetLogger?.log('Offline - attempting to load cached artwork');
                window.MetUI?.updateLoadingMessage?.('Loading from offline collection...');
                
                const cachedArtwork = await getRandomCachedArtwork();
                if (cachedArtwork) {
                    window.MetUI?.hideLoading?.();
                    return cachedArtwork;
                }
            }
            
            // Get random object IDs
            const objectIds = await getRandomObjectIds(50);
            
            if (!objectIds || objectIds.length === 0) {
                throw new Error('No object IDs available');
            }
            
            // Try to find an artwork with an image
            let artwork = null;
            const maxAttempts = Math.min(5, objectIds.length);
            
            for (let i = 0; i < maxAttempts; i++) {
                const randomIndex = Math.floor(Math.random() * objectIds.length);
                const objectId = objectIds[randomIndex];
                
                window.MetLogger?.log(`Attempt ${i + 1}: Trying object ${objectId}`);
                const details = await getObjectDetails(objectId);
                
                if (details) {
                    artwork = details;
                    break;
                }
                
                // Remove tried ID from array
                objectIds.splice(randomIndex, 1);
            }
            
            // Hide loading
            window.MetUI?.hideLoading?.();
            
            if (!artwork) {
                throw new Error('Could not find any artwork with images');
            }
            
            return artwork;
            
        } catch (error) {
            window.MetLogger?.error('Error getting random artwork:', error);
            window.MetUI?.hideLoading?.();
            
            if (window.MetUI?.showError) {
                window.MetUI.showError('Unable to load artwork. Please try again.');
            }
            
            return null;
        }
    }
    
    // Test API connection
    async function testConnection() {
        try {
            const data = await fetchWithProxy('/departments');
            window.MetLogger?.log('API connection successful');
            return true;
        } catch (error) {
            window.MetLogger?.error('API connection failed:', error);
            return false;
        }
    }
    
    // Load artwork image through proxy
    function loadArtworkImage(imageUrl) {
        if (!imageUrl) return '';
        
        // If it's already a data URL or blob URL, return as is
        if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
            return imageUrl;
        }
        
        // Convert http to https for better compatibility
        const secureUrl = imageUrl.replace(/^http:/, 'https:');
        
        // Use current proxy
        return getProxyUrl(secureUrl, currentProxy);
    }
    
    // Load image with explicit fallback attempt
    async function loadArtworkImageWithFallback(imageUrl) {
        if (!imageUrl) return '';
        
        // Try fallback proxy if primary is unhealthy
        if (currentProxy === 'primary' && !proxyHealthCache.primary.healthy && proxyHealthCache.fallback.healthy) {
            const previousProxy = currentProxy;
            rotateProxy();
            window.MetLogger?.log(`Primary proxy unhealthy, using ${currentProxy} for image`);
            
            // Restore previous proxy after this request
            setTimeout(() => {
                if (currentProxy !== previousProxy && proxyHealthCache.primary.healthy) {
                    currentProxy = previousProxy;
                }
            }, 100);
        }
        
        return loadArtworkImage(imageUrl);
    }
    
    // Get cached artworks from service worker
    async function getCachedArtworks() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            return new Promise((resolve) => {
                const messageChannel = new MessageChannel();
                
                navigator.serviceWorker.controller.postMessage(
                    { type: 'GET_CACHED_ARTWORKS' }, 
                    [messageChannel.port2]
                );
                
                messageChannel.port1.onmessage = (event) => {
                    resolve(event.data || []);
                };
                
                // Timeout fallback
                setTimeout(() => resolve([]), 2000);
            });
        }
        return [];
    }
    
    // Get random cached artwork when offline
    async function getRandomCachedArtwork() {
        try {
            const cachedArtworks = await getCachedArtworks();
            
            if (cachedArtworks.length === 0) {
                window.MetLogger?.log('No cached artworks available');
                return null;
            }
            
            // Select a random artwork from the cache
            const randomIndex = Math.floor(Math.random() * cachedArtworks.length);
            const artwork = cachedArtworks[randomIndex];
            
            window.MetLogger?.log(`Selected cached artwork: ${artwork.title}`);
            return artwork;
        } catch (error) {
            window.MetLogger?.error('Error getting cached artwork:', error);
            return null;
        }
    }
    
    // Test proxy health on startup
    async function testProxyHealth() {
        const testImageUrl = 'https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg';
        
        window.MetLogger?.log('Testing proxy health...');
        
        // Test both proxies in parallel
        const tests = ['primary', 'fallback'].map(async (proxyType) => {
            // Skip if recently checked
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
        
        // Select best proxy
        const healthyProxies = results.filter(r => r.healthy);
        if (healthyProxies.length === 0) {
            window.MetLogger?.error('No healthy proxies found');
            return false;
        }
        
        // Prefer primary if both are healthy
        if (healthyProxies.find(r => r.proxy === 'primary')) {
            currentProxy = 'primary';
        } else {
            currentProxy = healthyProxies[0].proxy;
        }
        
        window.MetLogger?.log(`Selected ${currentProxy} proxy (${healthyProxies.length} healthy proxies)`);
        
        // Show status in dev mode
        if (window.MetConfig?.devMode || window.location.hostname === 'localhost') {
            showProxyStatus(`Proxy: ${currentProxy} ✓`);
        }
        
        return true;
    }
    
    // Clear cache
    function clearCache() {
        detailsCache.clear();
        window.MetLogger?.log('API cache cleared');
    }
    
    // Initialize proxy on startup
    async function initializeAPI() {
        // Test proxy health on startup
        await testProxyHealth();
        
        // Periodically recheck proxy health
        setInterval(() => {
            testProxyHealth();
        }, PROXY_HEALTH_CHECK_INTERVAL);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAPI);
    } else {
        initializeAPI();
    }
    
    // Public API
    window.MetAPI = {
        getRandomArtwork,
        getObjectDetails,
        testConnection,
        loadArtworkImage,
        loadArtworkImageWithFallback,
        getCachedArtworks,
        testProxyHealth,
        rotateProxy,
        clearCache,
        getCurrentProxy: () => currentProxy,
        getProxyHealth: () => proxyHealthCache
    };
    
})();