// api.js - API related functions

// Use the configuration from config.js
const MET_API_BASE_URL = window.MetConfig ? window.MetConfig.MET_API_BASE_URL : 'https://collectionapi.metmuseum.org/public/collection/v1';
const CORS_PROXY_URL = window.MetConfig ? window.MetConfig.CORS_PROXY_URL : 'https://cors-proxy-xi-ten.vercel.app/api/proxy';
const REQUEST_TIMEOUT = window.MetConfig ? window.MetConfig.REQUEST_TIMEOUT : 15000;
const MAX_RETRIES = window.MetConfig ? window.MetConfig.MAX_RETRIES : 3;
const RETRY_DELAY = window.MetConfig ? window.MetConfig.RETRY_DELAY : 1000;

// Function to create a promise that rejects after a timeout
function timeoutPromise(ms) {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Request timed out after ${ms}ms`));
        }, ms);
    });
}

// Calculate exponential backoff delay
function calculateBackoffDelay(retryCount) {
    // Exponential backoff: 1s, 2s, 4s, etc., with jitter
    const baseDelay = RETRY_DELAY * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
    return Math.min(baseDelay + jitter, 30000); // Cap at 30 seconds
}

// Fetch with timeout and retries with exponential backoff
async function fetchWithRetry(url, options = {}, retries = 0) {
    try {
        // Race between fetch and timeout
        const response = await Promise.race([
            fetch(url, options),
            timeoutPromise(REQUEST_TIMEOUT)
        ]);
        
        // Check if response is ok (status in the range 200-299)
        if (!response.ok) {
            // Handle rate limiting specifically
            if (response.status === 429) {
                console.warn('Rate limited by API');
                // Look for Retry-After header
                const retryAfter = response.headers.get('Retry-After');
                if (retryAfter) {
                    const delay = parseInt(retryAfter) * 1000;
                    console.log(`API requested retry after ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return fetchWithRetry(url, options, retries);
                }
            }
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return response;
    } catch (error) {
        // If we have retries left, retry after a delay
        if (retries < MAX_RETRIES) {
            const delay = calculateBackoffDelay(retries);
            console.log(`Fetch attempt failed, retrying in ${Math.round(delay)}ms... (${retries + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, retries + 1);
        }
        
        // Otherwise, rethrow the error
        throw error;
    }
}

// Fetch API data through the proxy
async function fetchWithProxy(endpoint, retries = 0) {
    const targetUrl = `${MET_API_BASE_URL}${endpoint}`;
    const proxyUrl = `${CORS_PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
    
    console.log(`Fetching from proxy: ${proxyUrl}`);
    
    try {
        // Use fetch with retries
        const response = await fetchWithRetry(proxyUrl, {
            headers: {
                'Origin': window.location.origin,
                'Accept': 'application/json'
            }
        });
        
        // Special handling for search endpoint which might be large
        if (endpoint.includes('/search')) {
            console.log('Search endpoint - expecting large response, using streaming approach');
            
            // First try to parse as JSON
            try {
                const reader = response.body.getReader();
                let result = '';
                
                // Process the stream in chunks
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        break;
                    }
                    
                    // Convert the chunk to a string and append to result
                    result += new TextDecoder().decode(value);
                }
                
                // Try to parse the result as JSON
                try {
                    const data = JSON.parse(result);
                    console.log('Successfully parsed JSON from stream');
                    return data;
                } catch (parseError) {
                    console.error('Error parsing JSON from stream:', parseError);
                    throw parseError;
                }
            } catch (streamError) {
                console.error('Error streaming response:', streamError);
                throw streamError;
            }
        } else {
            // For other endpoints, which should be smaller
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                console.log('Fetch successful');
                return data;
            } catch (parseError) {
                console.error('Invalid JSON response from proxy:', text.substring(0, 500));
                throw new Error('Invalid JSON response');
            }
        }
    } catch (error) {
        // If we have retries left, retry the entire proxy call
        if (retries < MAX_RETRIES) {
            const delay = calculateBackoffDelay(retries);
            console.warn(`Proxy request failed, retrying in ${Math.round(delay)}ms... (${retries + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithProxy(endpoint, retries + 1);
        }
        
        console.error(`Proxy request failed after ${MAX_RETRIES} retries:`, error);
        throw error;
    }
}

// Test connection to the API
async function testApiConnection() {
    try {
        const data = await fetchWithProxy('/departments');
        console.log('API connection successful!', data);
        return data;
    } catch (error) {
        console.error('API connection failed:', error);
        return null;
    }
}

// Get all departments
async function getDepartments() {
    try {
        const data = await fetchWithProxy('/departments');
        return data.departments || [];
    } catch (error) {
        console.error('Failed to fetch departments:', error);
        return [];
    }
}

// Get artworks from a specific department (more reliable than search)
async function getArtworksFromDepartment(departmentId, limit = 1000) {
    try {
        console.log(`Fetching objects from department ${departmentId}`);
        const endpoint = `/objects?departmentIds=${departmentId}`;
        const data = await fetchWithProxy(endpoint);
        
        if (!data || !data.objectIDs || data.objectIDs.length === 0) {
            console.log('No objects found in department');
            return [];
        }
        
        // Limit results to prevent memory issues
        const limitedIDs = data.objectIDs.slice(0, Math.min(limit, data.objectIDs.length));
        console.log(`Found ${data.objectIDs.length} objects in department, using ${limitedIDs.length}`);
        
        // Shuffle for randomness
        return limitedIDs.sort(() => 0.5 - Math.random());
    } catch (error) {
        console.error(`Error fetching department ${departmentId} objects:`, error);
        return [];
    }
}

// Alternative approach: use individual object IDs instead of the search endpoint
async function getRandomObjectIds(count = 20) {
    try {
        // Get a list of all object IDs
        const data = await fetchWithProxy('/objects');
        
        if (!data || !data.objectIDs || data.objectIDs.length === 0) {
            throw new Error('No object IDs returned from API');
        }
        
        // Shuffle the array and pick the first 'count' elements
        const shuffled = data.objectIDs.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    } catch (error) {
        console.error('Error getting random object IDs:', error);
        
        // Fallback to a small set of known object IDs if API fails
        console.log('Using fallback object IDs');
        return [435809, 11737, 436944, 436964, 436965, 438144, 438821, 437386, 435888, 437394]; // Known good IDs
    }
}

// Cache for search results
const searchCache = new Map();
const SEARCH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for object details
const objectDetailsCache = new Map();
const OBJECT_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes


// Get a list of object IDs that match the filters
async function searchObjects(filters = {}) {
    try {
        // Check if this is a text search
        if (filters.searchQuery) {
            return await searchArtworks(filters);
        }
        
        // Try department-specific objects first (more reliable)
        if (filters.departmentId) {
            const departmentObjects = await getArtworksFromDepartment(filters.departmentId);
            if (departmentObjects && departmentObjects.length > 0) {
                return departmentObjects;
            }
        }
        
        // Fallback to search with simplified query
        let queryParams = 'q=*&hasImages=true'; // Add default query to limit results
        
        // Add department filter if specified
        if (filters.departmentId) {
            queryParams += `&departmentIds=${filters.departmentId}`;
        }
        
        // Add date range filters if specified
        // Met API expects date format as YYYY for years or YYYY-MM-DD for specific dates
        if (filters.dateBegin && filters.dateEnd) {
            // Ensure proper formatting for years (negative years for BCE)
            const beginYear = parseInt(filters.dateBegin);
            const endYear = parseInt(filters.dateEnd);
            queryParams += `&dateBegin=${encodeURIComponent(beginYear)}&dateEnd=${encodeURIComponent(endYear)}`;
        }
        
        // Add medium filter if specified
        if (filters.medium) {
            queryParams += `&medium=${encodeURIComponent(filters.medium)}`;
        }
        
        console.log(`Searching with query: ${queryParams}`);
        
        // Make the API request
        const data = await fetchWithProxy(`/search?${queryParams}`);
        
        if (data && data.objectIDs && data.objectIDs.length > 0) {
            // Limit results to prevent 502 errors
            const limitedIDs = data.objectIDs.slice(0, 100);
            console.log(`Found ${data.total || limitedIDs.length} objects, using first ${limitedIDs.length}`);
            return limitedIDs;
        }
        
        return [];
    } catch (error) {
        console.error('Error searching objects:', error);
        // Fallback to department objects or random
        if (filters.departmentId) {
            return await getArtworksFromDepartment(filters.departmentId);
        }
        return await getRandomObjectIds(20);
    }
}

// Search artworks by text query
async function searchArtworks(filters = {}) {
    const { 
        searchQuery, 
        departmentId, 
        dateBegin, 
        dateEnd, 
        medium,
        geoLocation,
        excavation,
        title,
        artistOrCulture,
        isHighlight,
        isPublicDomain
    } = filters;
    
    // Use title search if provided, otherwise use general search query
    const query = title || searchQuery || '*';
    
    // Create a cache key based on all filters
    const cacheKey = JSON.stringify(filters);
    
    // Check cache first
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_DURATION) {
        console.log('Returning cached search results');
        return cached.objectIDs;
    }
    
    try {
        // Build the search query with default to prevent 502
        let queryParams = `q=${encodeURIComponent(query)}`;
        
        // Always add hasImages=true unless explicitly searching for all
        queryParams += '&hasImages=true';
        
        // Add additional filters
        if (departmentId) {
            queryParams += `&departmentIds=${departmentId}`;
        }
        
        if (dateBegin && dateEnd) {
            // Ensure proper formatting for years (negative years for BCE)
            const beginYear = parseInt(dateBegin);
            const endYear = parseInt(dateEnd);
            queryParams += `&dateBegin=${encodeURIComponent(beginYear)}&dateEnd=${encodeURIComponent(endYear)}`;
        }
        
        if (medium) {
            queryParams += `&medium=${encodeURIComponent(medium)}`;
        }
        
        if (geoLocation) {
            queryParams += `&geoLocation=${encodeURIComponent(geoLocation)}`;
        }
        
        if (excavation) {
            queryParams += `&excavation=${encodeURIComponent(excavation)}`;
        }
        
        if (title) {
            queryParams += `&title=true`; // Tell API to search in titles only
        }
        
        if (artistOrCulture) {
            queryParams += `&artistOrCulture=true`;
        }
        
        if (isHighlight) {
            queryParams += `&isHighlight=true`;
        }
        
        if (isPublicDomain !== undefined) {
            queryParams += `&isPublicDomain=${isPublicDomain}`;
        }
        
        console.log(`Searching artworks with query: ${queryParams}`);
        
        // Make the API request
        const data = await fetchWithProxy(`/search?${queryParams}`);
        
        if (!data || !data.objectIDs) {
            console.log('No results found for search query');
            return [];
        }
        
        console.log(`Found ${data.total || data.objectIDs.length} artworks matching search`);
        
        // Limit results to prevent performance issues
        let limitedIDs = data.objectIDs;
        if (limitedIDs.length > 500) {
            limitedIDs = limitedIDs.slice(0, 500);
            console.log(`Limited results to ${limitedIDs.length} for performance`);
        }
        
        // Cache the results
        searchCache.set(cacheKey, {
            objectIDs: limitedIDs,
            timestamp: Date.now(),
            total: limitedIDs.length
        });
        
        return limitedIDs;
    } catch (error) {
        console.error('Error searching artworks:', error);
        return [];
    }
}


// Get multiple object details in batches
async function getObjectDetailsMultiple(objectIds, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < objectIds.length; i += batchSize) {
        const batch = objectIds.slice(i, i + batchSize);
        const batchPromises = batch.map(id => getObjectDetails(id));
        
        try {
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.filter(result => result !== null));
        } catch (error) {
            console.error('Error fetching batch:', error);
        }
    }
    
    return results;
}


// Clear search cache
function clearSearchCache() {
    searchCache.clear();
    console.log('Search cache cleared');
}

// Clear object details cache
function clearObjectCache() {
    objectDetailsCache.clear();
    console.log('Object details cache cleared');
}

// Clear all caches
function clearAllCaches() {
    clearSearchCache();
    clearObjectCache();
}

// Get details for a specific object by ID
async function getObjectDetails(objectId) {
    // Check cache first
    const cached = objectDetailsCache.get(objectId);
    if (cached && Date.now() - cached.timestamp < OBJECT_CACHE_DURATION) {
        console.log(`Returning cached details for object ${objectId}`);
        return cached.data;
    }
    
    try {
        const data = await fetchWithProxy(`/objects/${objectId}`);
        
        // Validate that the artwork has an image
        if (data && (data.primaryImage || data.primaryImageSmall)) {
            // Cache the successful result
            objectDetailsCache.set(objectId, {
                data: data,
                timestamp: Date.now()
            });
            
            // Limit cache size to prevent memory issues
            if (objectDetailsCache.size > 1000) {
                // Remove oldest entries
                const entriesToRemove = objectDetailsCache.size - 800;
                const keys = Array.from(objectDetailsCache.keys());
                for (let i = 0; i < entriesToRemove; i++) {
                    objectDetailsCache.delete(keys[i]);
                }
            }
            
            return data;
        } else {
            console.log(`Object ${objectId} has no image, skipping`);
            // Cache null result to avoid repeated requests
            objectDetailsCache.set(objectId, {
                data: null,
                timestamp: Date.now()
            });
            return null;
        }
    } catch (error) {
        console.error(`Error fetching details for object ${objectId}:`, error);
        return null;
    }
}

// Function to fetch a random artwork based on filters
async function getRandomArtwork(filters = {}) {
    try {
        // Show loading state
        window.MetUI.showLoading();
        window.MetUI.updateLoadingMessage('Finding artwork...');
        
        let objectIDs = [];
        
        // Try department-specific search first if department is selected
        if (filters.departmentId) {
            objectIDs = await getArtworksFromDepartment(filters.departmentId);
        }
        
        // Fall back to search if no department or no results
        if (!objectIDs || objectIDs.length === 0) {
            objectIDs = await searchObjects(filters);
        }
        
        // Final fallback to random objects
        if (!objectIDs || objectIDs.length === 0) {
            console.log('No filtered results, using random objects');
            objectIDs = await getRandomObjectIds(50);
        }
        
        if (!objectIDs || objectIDs.length === 0) {
            window.MetUI.hideLoading();
            window.MetUI.showError('Unable to find artworks. Please try again.');
            return null;
        }
        
        // Simplified logic: just try up to 5 random objects
        let objectDetails = null;
        const maxAttempts = 5;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const randomIndex = Math.floor(Math.random() * objectIDs.length);
            const randomObjectId = objectIDs[randomIndex];
            
            console.log(`Attempt ${attempt + 1}: Trying object ID ${randomObjectId}`);
            objectDetails = await getObjectDetails(randomObjectId);
            
            if (objectDetails) {
                break; // Found an artwork with an image
            }
        }
        
        // Hide loading state
        window.MetUI.hideLoading();
        
        if (!objectDetails) {
            console.warn('Could not find any artwork with images');
            window.MetUI.showError('No artworks with images found. Please try again.');
            return null;
        }
        
        return objectDetails;
    } catch (error) {
        console.error('Error getting random artwork:', error);
        window.MetUI.hideLoading();
        window.MetUI.showError('Error fetching artwork. Please try again.');
        return null;
    }
}

// Get random artwork with fallback search
async function getRandomArtworkWithFallback(filters = {}) {
    try {
        // First try with the user's filters
        const result = await getRandomArtwork(filters);
        if (result) return result;
        
        // If no results, try with only hasImages=true
        window.MetUI.showLoading();
        window.MetUI.updateLoadingMessage('No artworks with images found. Trying with minimal filters...');
        
        const minimalResult = await getRandomArtwork({}); // Minimal query
        if (minimalResult) return minimalResult;
        
        // If no results with minimal filters, try without department and medium
        if (filters.departmentId || filters.medium) {
            const simpleFilters = { ...filters };
            delete simpleFilters.departmentId;
            delete simpleFilters.medium;
            
            window.MetUI.showLoading();
            window.MetUI.updateLoadingMessage('Searching more broadly for artworks with images...');
            
            return await getRandomArtwork(simpleFilters);
        }
        
        return null;
    } catch (error) {
        console.error('Error in artwork fallback:', error);
        window.MetUI.hideLoading();
        window.MetUI.showError('Unable to find artworks with images. Please try different filters.');
        return null;
    }
}

// Function to get a proxied URL for images
function getProxiedUrl(originalUrl) {
    if (!originalUrl) return '';
    return `${CORS_PROXY_URL}?url=${encodeURIComponent(originalUrl)}`;
}

// Function to load artwork image with proxy
function loadArtworkImage(imageUrl) {
    if (!imageUrl) return '';
    return getProxiedUrl(imageUrl);
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
            setTimeout(() => {
                resolve([]);
            }, 2000);
        });
    }
    return [];
}

// Check if we have cached artworks
async function hasCachedArtworks() {
    const cached = await getCachedArtworks();
    return cached.length > 0;
}

// Get random cached artwork when offline
async function getRandomCachedArtwork() {
    try {
        const cachedArtworks = await getCachedArtworks();
        
        if (cachedArtworks.length === 0) {
            console.log('No cached artworks available');
            return null;
        }
        
        // Select a random artwork from the cache
        const randomIndex = Math.floor(Math.random() * cachedArtworks.length);
        const artwork = cachedArtworks[randomIndex];
        
        console.log(`Selected random cached artwork: ${artwork.title}`);
        return artwork;
    } catch (error) {
        console.error('Error getting random cached artwork:', error);
        return null;
    }
}

// Enhanced version of getRandomArtwork with offline fallback
async function getRandomArtworkEnhanced(filters = {}) {
    // Check if we're online
    if (!navigator.onLine) {
        console.log('Offline - attempting to load cached artwork');
        window.MetUI.updateLoadingMessage('Loading from offline collection...');
        
        const cachedArtwork = await getRandomCachedArtwork();
        if (cachedArtwork) {
            window.MetUI.hideLoading();
            return cachedArtwork;
        } else {
            window.MetUI.hideLoading();
            window.MetUI.showError('No cached artworks available. Connect to the internet to discover new artworks.');
            return null;
        }
    }
    
    // Online - use the existing function
    return getRandomArtworkWithFallback(filters);
}

// Make functions available globally
window.MetAPI = {
    testApiConnection,
    getDepartments,
    searchObjects,
    searchArtworks,
    getObjectDetails,
    getObjectDetailsMultiple,
    getRandomArtwork: getRandomArtworkEnhanced,
    getProxiedUrl,
    loadArtworkImage,
    getCachedArtworks,
    hasCachedArtworks,
    getRandomCachedArtwork,
    clearSearchCache,
    clearObjectCache,
    clearAllCaches
};