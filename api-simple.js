// api-simple.js - Simplified API for core functionality only
// Only includes: getRandomArtwork() and getObjectDetails()

(function() {
    'use strict';
    
    // Configuration
    const MET_API_BASE_URL = window.MetConfig?.MET_API_BASE_URL || 'https://collectionapi.metmuseum.org/public/collection/v1';
    const CORS_PROXY_URL = window.MetConfig?.CORS_PROXY_URL || 'https://cors-proxy-xi-ten.vercel.app/api/proxy';
    const REQUEST_TIMEOUT = window.MetConfig?.REQUEST_TIMEOUT || 15000;
    
    // Simple cache for object details
    const detailsCache = new Map();
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    
    // Helper: Make API request with timeout
    async function fetchWithTimeout(url, timeout = REQUEST_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, { 
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
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
    
    // Helper: Fetch through CORS proxy
    async function fetchWithProxy(endpoint) {
        const fullUrl = `${MET_API_BASE_URL}${endpoint}`;
        const proxiedUrl = `${CORS_PROXY_URL}?url=${encodeURIComponent(fullUrl)}`;
        
        try {
            return await fetchWithTimeout(proxiedUrl);
        } catch (error) {
            window.MetLogger?.error('API request failed:', error);
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
            // Return fallback IDs
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
                return data;
            }
            
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
            
            // Get random object IDs
            const objectIds = await getRandomObjectIds(50);
            
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
    async function testAPIConnection() {
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
        
        // Use CORS proxy for Met images
        return `${CORS_PROXY_URL}?url=${encodeURIComponent(imageUrl)}`;
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
        testAPIConnection,
        loadArtworkImage,
        clearCache
    };
    
})();