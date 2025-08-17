// api.js - Simplified Met Museum API module
// Core functions: getRandomArtwork, getObjectDetails, testConnection, loadArtworkImage

(function() {
    'use strict';
    
    // Configuration
    const MET_API_BASE_URL = window.MetConfig?.MET_API_BASE_URL || 'https://collectionapi.metmuseum.org/public/collection/v1';
    const CORS_PROXY_URL = window.MetConfig?.CORS_PROXY_URL || 'https://cors-proxy-xi-ten.vercel.app/api/proxy';
    const REQUEST_TIMEOUT = window.MetConfig?.REQUEST_TIMEOUT || 15000;
    
    // Alternative CORS proxies for fallback
    const CORS_PROXY_FALLBACKS = [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url='
    ];
    
    // Simple cache for object details
    const detailsCache = new Map();
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    
    let currentProxyIndex = 0;
    
    // Helper: Make API request with timeout
    async function fetchWithTimeout(url, timeout = REQUEST_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, { 
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                }
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }
    
    // Helper: Get proxy URL with rotation support
    function getProxyUrl(targetUrl, proxyIndex = currentProxyIndex) {
        const proxies = [CORS_PROXY_URL, ...CORS_PROXY_FALLBACKS];
        const proxy = proxies[proxyIndex % proxies.length];
        
        if (proxy.includes('?')) {
            return `${proxy}${encodeURIComponent(targetUrl)}`;
        } else {
            return `${proxy}?url=${encodeURIComponent(targetUrl)}`;
        }
    }
    
    // Helper: Fetch through CORS proxy with fallback
    async function fetchWithProxy(endpoint, retryProxyIndex = 0) {
        const fullUrl = `${MET_API_BASE_URL}${endpoint}`;
        const proxiedUrl = getProxyUrl(fullUrl, retryProxyIndex);
        
        try {
            window.MetLogger?.log(`Fetching: ${endpoint}`);
            return await fetchWithTimeout(proxiedUrl);
        } catch (error) {
            window.MetLogger?.error('API request failed:', error);
            
            // Try next proxy if available
            const proxies = [CORS_PROXY_URL, ...CORS_PROXY_FALLBACKS];
            if (retryProxyIndex < proxies.length - 1) {
                window.MetLogger?.log(`Trying fallback proxy ${retryProxyIndex + 1}`);
                return fetchWithProxy(endpoint, retryProxyIndex + 1);
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
    
    // Load artwork image through proxy with smart fallback
    function loadArtworkImage(imageUrl) {
        if (!imageUrl) return '';
        
        // If it's already a data URL or blob URL, return as is
        if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
            return imageUrl;
        }
        
        // Convert http to https for better compatibility
        const secureUrl = imageUrl.replace(/^http:/, 'https:');
        
        // Use current proxy
        return getProxyUrl(secureUrl, currentProxyIndex);
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
    
    // Test proxy health and select fastest one
    async function testProxyHealth() {
        const proxies = [CORS_PROXY_URL, ...CORS_PROXY_FALLBACKS];
        const testImageUrl = 'https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg';
        
        window.MetLogger?.log('Testing proxy health...');
        
        for (let i = 0; i < proxies.length; i++) {
            try {
                const proxiedUrl = getProxyUrl(testImageUrl, i);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const response = await fetch(proxiedUrl, {
                    method: 'HEAD',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    currentProxyIndex = i;
                    window.MetLogger?.log(`Selected proxy: ${proxies[i]}`);
                    return true;
                }
            } catch (error) {
                window.MetLogger?.warn(`Proxy ${proxies[i]} failed: ${error.message}`);
            }
        }
        
        return false;
    }
    
    // Clear cache
    function clearCache() {
        detailsCache.clear();
        window.MetLogger?.log('API cache cleared');
    }
    
    // Public API
    window.MetAPI = {
        getRandomArtwork,
        getObjectDetails,
        testConnection,
        loadArtworkImage,
        getCachedArtworks,
        testProxyHealth,
        clearCache
    };
    
})();