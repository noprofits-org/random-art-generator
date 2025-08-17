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

// Fetch with timeout and retries
async function fetchWithRetry(url, options = {}, retries = 0) {
    try {
        // Race between fetch and timeout
        const response = await Promise.race([
            fetch(url, options),
            timeoutPromise(REQUEST_TIMEOUT)
        ]);
        
        // Check if response is ok (status in the range 200-299)
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return response;
    } catch (error) {
        // If we have retries left, retry after a delay
        if (retries < MAX_RETRIES) {
            console.log(`Fetch attempt failed, retrying in ${RETRY_DELAY}ms... (${retries + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
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
            console.warn(`Proxy request failed, retrying in ${RETRY_DELAY}ms... (${retries + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
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
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    }
}

// Cache for search results
const searchCache = new Map();
const SEARCH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get a list of object IDs that match the filters
async function searchObjects(filters = {}) {
    // If the search endpoint has been failing, use the alternative approach
    try {
        // Check if this is a text search
        if (filters.searchQuery) {
            return await searchArtworks(filters);
        }
        
        // First try using specific department objects (smaller request)
        if (filters.departmentId) {
            console.log(`Fetching objects from department ${filters.departmentId}`);
            const endpoint = `/objects?departmentIds=${filters.departmentId}`;
            const data = await fetchWithProxy(endpoint);
            
            if (data && data.objectIDs && data.objectIDs.length > 0) {
                console.log(`Found ${data.objectIDs.length} objects in department ${filters.departmentId}`);
                // Limit to 100 for better performance
                const limitedIDs = data.objectIDs.length > 100 ? 
                    data.objectIDs.slice(0, 100) : data.objectIDs;
                return limitedIDs;
            }
        }
        
        // If department-specific search fails or no department is specified, 
        // try the regular search
        let queryParams = 'hasImages=true';
        
        // Add department filter if specified
        if (filters.departmentId) {
            queryParams += `&departmentIds=${filters.departmentId}`;
        }
        
        // Add date range filters if specified
        if (filters.dateBegin && filters.dateEnd) {
            queryParams += `&dateBegin=${filters.dateBegin}&dateEnd=${filters.dateEnd}`;
        }
        
        // Add medium filter if specified
        if (filters.medium) {
            queryParams += `&medium=${encodeURIComponent(filters.medium)}`;
        }
        
        console.log(`Searching with query: ${queryParams}`);
        
        // Make the API request
        const data = await fetchWithProxy(`/search?${queryParams}`);
        
        console.log(`Found ${data.total || 0} objects matching filters`);
        
        // If we have too many results, limit to 100 for better performance
        const objectIDs = data.objectIDs || [];
        const limitedIDs = objectIDs.length > 100 ? objectIDs.slice(0, 100) : objectIDs;
        
        return limitedIDs;
    } catch (error) {
        console.error('Error searching objects, falling back to random IDs:', error);
        
        // Fallback to random objects
        return await getRandomObjectIds(20);
    }
}

// Search artworks by text query
async function searchArtworks(filters = {}) {
    const { searchQuery, departmentId, dateBegin, dateEnd, medium } = filters;
    
    if (!searchQuery) {
        console.warn('searchArtworks called without a search query');
        return [];
    }
    
    // Create a cache key based on all filters
    const cacheKey = JSON.stringify(filters);
    
    // Check cache first
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_DURATION) {
        console.log('Returning cached search results');
        return cached.objectIDs;
    }
    
    try {
        // Build the search query
        let queryParams = `q=${encodeURIComponent(searchQuery)}&hasImages=true`;
        
        // Add additional filters
        if (departmentId) {
            queryParams += `&departmentIds=${departmentId}`;
        }
        
        if (dateBegin && dateEnd) {
            queryParams += `&dateBegin=${dateBegin}&dateEnd=${dateEnd}`;
        }
        
        if (medium) {
            queryParams += `&medium=${encodeURIComponent(medium)}`;
        }
        
        console.log(`Searching artworks with query: ${queryParams}`);
        
        // Make the API request
        const data = await fetchWithProxy(`/search?${queryParams}`);
        
        if (!data || !data.objectIDs) {
            console.log('No results found for search query');
            return [];
        }
        
        console.log(`Found ${data.total || data.objectIDs.length} artworks matching search`);
        
        // Cache the results
        searchCache.set(cacheKey, {
            objectIDs: data.objectIDs,
            timestamp: Date.now(),
            total: data.total
        });
        
        return data.objectIDs;
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

// Get details for a specific object by ID
async function getObjectDetails(objectId) {
    try {
        const data = await fetchWithProxy(`/objects/${objectId}`);
        return data;
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
        window.MetUI.updateLoadingMessage('Searching for artworks...');
        
        // Get a list of object IDs that match the filters
        const objectIDs = await searchObjects(filters);
        
        if (!objectIDs || objectIDs.length === 0) {
            console.warn('No objects found matching the filters');
            window.MetUI.hideLoading();
            window.MetUI.showError('No artworks found matching your filters. Try different criteria.');
            return null;
        }
        
        // Select a random object ID from the results
        const randomIndex = Math.floor(Math.random() * objectIDs.length);
        const randomObjectId = objectIDs[randomIndex];
        
        console.log(`Selected random object ID ${randomObjectId} from ${objectIDs.length} options`);
        
        // Update loading message
        window.MetUI.updateLoadingMessage('Fetching artwork details...');
        
        // Get the details for the random object
        const objectDetails = await getObjectDetails(randomObjectId);
        
        // Hide loading state
        window.MetUI.hideLoading();
        
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
        window.MetUI.updateLoadingMessage('No results with filters. Trying with minimal filters...');
        
        const minimalResult = await getRandomArtwork({}); // Minimal query
        if (minimalResult) return minimalResult;
        
        // If no results with minimal filters, try without department and medium
        if (filters.departmentId || filters.medium) {
            const simpleFilters = { ...filters };
            delete simpleFilters.departmentId;
            delete simpleFilters.medium;
            
            window.MetUI.showLoading();
            window.MetUI.updateLoadingMessage('Trying without department and medium filters...');
            
            return await getRandomArtwork(simpleFilters);
        }
        
        return null;
    } catch (error) {
        console.error('Error in artwork fallback:', error);
        window.MetUI.hideLoading();
        window.MetUI.showError('Unable to find any artwork. Please try again later.');
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
    clearSearchCache
};