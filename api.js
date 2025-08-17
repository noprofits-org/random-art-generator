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

// Cache for validated object IDs (ones we know have images)
const validatedIDsCache = new Map();
const VALIDATION_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

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
                // Limit to 200 for validation
                const limitedIDs = data.objectIDs.length > 200 ? 
                    data.objectIDs.slice(0, 200) : data.objectIDs;
                
                // Validate that the objects have images
                console.log('Validating department objects for images...');
                const validatedIDs = await validateObjectIDs(limitedIDs, 50);
                console.log(`Validated ${validatedIDs.length} objects with images`);
                
                return validatedIDs.length > 0 ? validatedIDs : limitedIDs.slice(0, 20); // Fallback
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
        
        // If we have too many results, limit to 200 for validation
        const objectIDs = data.objectIDs || [];
        const limitedIDs = objectIDs.length > 200 ? objectIDs.slice(0, 200) : objectIDs;
        
        // Validate that the objects have images
        if (limitedIDs.length > 0) {
            console.log('Validating object IDs for images...');
            const validatedIDs = await validateObjectIDs(limitedIDs, 50);
            console.log(`Validated ${validatedIDs.length} objects with images`);
            return validatedIDs.length > 0 ? validatedIDs : limitedIDs.slice(0, 20); // Fallback to first 20
        }
        
        return limitedIDs;
    } catch (error) {
        console.error('Error searching objects, falling back to random IDs:', error);
        
        // Fallback to random objects
        return await getRandomObjectIds(20);
    }
}

// Search artworks by text query
async function searchArtworks(filters = {}) {
    const { searchQuery, departmentId, dateBegin, dateEnd, medium, includeTypes, excludeTypes } = filters;
    
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
        
        // If we have object type filters, we need to validate and filter
        let filteredIDs = data.objectIDs;
        if ((includeTypes && includeTypes.length > 0) || (excludeTypes && excludeTypes.length > 0)) {
            console.log('Applying object type filters...');
            filteredIDs = await filterByObjectType(data.objectIDs, includeTypes, excludeTypes);
            console.log(`Filtered to ${filteredIDs.length} objects after type filtering`);
        }
        
        // Validate results for images if we have a reasonable number
        let validatedIDs = filteredIDs;
        if (filteredIDs.length <= 200) {
            console.log('Validating search results for images...');
            validatedIDs = await validateObjectIDs(filteredIDs, Math.min(50, filteredIDs.length));
            console.log(`Validated ${validatedIDs.length} search results with images`);
        } else {
            // For large result sets, just validate a sample
            const sampleSize = 100;
            const sample = filteredIDs.slice(0, sampleSize);
            validatedIDs = await validateObjectIDs(sample, 50);
        }
        
        // Cache the validated results
        searchCache.set(cacheKey, {
            objectIDs: validatedIDs,
            timestamp: Date.now(),
            total: validatedIDs.length
        });
        
        return validatedIDs;
    } catch (error) {
        console.error('Error searching artworks:', error);
        return [];
    }
}

// Search artworks by artist name
async function searchByArtist(artistName, filters = {}) {
    if (!artistName) {
        console.warn('searchByArtist called without artist name');
        return [];
    }
    
    // Create a search query specifically for artist
    const searchFilters = {
        ...filters,
        searchQuery: artistName,
        searchType: 'artist'
    };
    
    try {
        // Use the regular search but we'll filter results by artist match
        const objectIds = await searchArtworks(searchFilters);
        
        if (!objectIds || objectIds.length === 0) {
            return [];
        }
        
        // Fetch details and filter by exact artist match
        const details = await getObjectDetailsMultiple(objectIds.slice(0, 100));
        const artistLower = artistName.toLowerCase();
        
        // Filter and score by artist relevance
        const artistMatches = details.filter(artwork => {
            if (!artwork || !artwork.artistDisplayName) return false;
            const artworkArtist = artwork.artistDisplayName.toLowerCase();
            return artworkArtist.includes(artistLower);
        }).map(artwork => {
            const artworkArtist = artwork.artistDisplayName.toLowerCase();
            let score = 0;
            
            if (artworkArtist === artistLower) {
                score = 100; // Exact match
            } else if (artworkArtist.startsWith(artistLower)) {
                score = 80; // Starts with
            } else if (artworkArtist.includes(artistLower)) {
                score = 50; // Contains
            }
            
            return {
                ...artwork,
                searchContext: {
                    type: 'artist',
                    matchField: 'artistDisplayName',
                    score
                }
            };
        });
        
        // Sort by relevance
        artistMatches.sort((a, b) => b.searchContext.score - a.searchContext.score);
        
        return artistMatches.map(a => a.objectID);
    } catch (error) {
        console.error('Error searching by artist:', error);
        return [];
    }
}

// Search artworks by title
async function searchByTitle(title, filters = {}) {
    if (!title) {
        console.warn('searchByTitle called without title');
        return [];
    }
    
    // Create a search query specifically for title
    const searchFilters = {
        ...filters,
        searchQuery: title,
        searchType: 'title'
    };
    
    try {
        // Use the regular search but we'll filter results by title match
        const objectIds = await searchArtworks(searchFilters);
        
        if (!objectIds || objectIds.length === 0) {
            return [];
        }
        
        // Fetch details and filter by title match
        const details = await getObjectDetailsMultiple(objectIds.slice(0, 100));
        const titleLower = title.toLowerCase();
        
        // Filter and score by title relevance
        const titleMatches = details.filter(artwork => {
            if (!artwork || !artwork.title) return false;
            const artworkTitle = artwork.title.toLowerCase();
            return artworkTitle.includes(titleLower);
        }).map(artwork => {
            const artworkTitle = artwork.title.toLowerCase();
            let score = 0;
            
            if (artworkTitle === titleLower) {
                score = 100; // Exact match
            } else if (artworkTitle.startsWith(titleLower)) {
                score = 80; // Starts with
            } else if (artworkTitle.includes(titleLower)) {
                score = 50; // Contains
            }
            
            return {
                ...artwork,
                searchContext: {
                    type: 'title',
                    matchField: 'title',
                    score
                }
            };
        });
        
        // Sort by relevance
        titleMatches.sort((a, b) => b.searchContext.score - a.searchContext.score);
        
        return titleMatches.map(a => a.objectID);
    } catch (error) {
        console.error('Error searching by title:', error);
        return [];
    }
}

// Cache for artist suggestions
const artistSuggestionsCache = new Map();
const ARTIST_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Get artist suggestions based on partial name
async function getArtistSuggestions(partialName) {
    if (!partialName || partialName.length < 2) return [];
    
    const cacheKey = partialName.toLowerCase();
    const cached = artistSuggestionsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ARTIST_CACHE_DURATION) {
        return cached.suggestions;
    }
    
    try {
        // Search for artworks with this partial artist name
        const searchResults = await searchArtworks({ searchQuery: partialName });
        if (!searchResults || searchResults.length === 0) return [];
        
        // Get details for a sample of results
        const sampleSize = Math.min(30, searchResults.length);
        const details = await getObjectDetailsMultiple(searchResults.slice(0, sampleSize));
        
        // Extract unique artists
        const artistMap = new Map();
        const partialLower = partialName.toLowerCase();
        
        details.forEach(artwork => {
            if (artwork && artwork.artistDisplayName) {
                const artistName = artwork.artistDisplayName;
                const artistLower = artistName.toLowerCase();
                
                if (artistLower.includes(partialLower) && !artistMap.has(artistLower)) {
                    artistMap.set(artistLower, {
                        name: artistName,
                        nationality: artwork.artistNationality || '',
                        dates: artwork.artistDisplayBio || '',
                        count: 1
                    });
                } else if (artistMap.has(artistLower)) {
                    artistMap.get(artistLower).count++;
                }
            }
        });
        
        // Convert to array and sort by relevance
        const suggestions = Array.from(artistMap.values())
            .sort((a, b) => {
                // Prioritize exact matches
                const aExact = a.name.toLowerCase() === partialLower;
                const bExact = b.name.toLowerCase() === partialLower;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // Then by count
                return b.count - a.count;
            })
            .slice(0, 10); // Limit to 10 suggestions
        
        // Cache the results
        artistSuggestionsCache.set(cacheKey, {
            suggestions,
            timestamp: Date.now()
        });
        
        return suggestions;
    } catch (error) {
        console.error('Error getting artist suggestions:', error);
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

// Filter objects by type (include/exclude)
async function filterByObjectType(objectIds, includeTypes = [], excludeTypes = []) {
    if (objectIds.length === 0) return [];
    
    const filteredIDs = [];
    const batchSize = 10;
    const maxToCheck = Math.min(200, objectIds.length); // Limit to prevent too many API calls
    
    for (let i = 0; i < maxToCheck; i += batchSize) {
        const batch = objectIds.slice(i, Math.min(i + batchSize, maxToCheck));
        const batchPromises = batch.map(id => 
            fetchWithProxy(`/objects/${id}`)
                .then(data => {
                    if (!data) return null;
                    
                    // Check if object has an image first
                    if (!data.primaryImage && !data.primaryImageSmall) return null;
                    
                    const objectName = (data.objectName || '').toLowerCase();
                    const title = (data.title || '').toLowerCase();
                    const classification = (data.classification || '').toLowerCase();
                    const objectType = objectName || classification;
                    
                    // Check exclude filters first
                    if (excludeTypes.length > 0) {
                        for (const excludeType of excludeTypes) {
                            const exclude = excludeType.toLowerCase();
                            if (objectType.includes(exclude) || title.includes(exclude)) {
                                console.log(`Excluding ${id}: ${objectName} (matches ${exclude})`);
                                return null;
                            }
                        }
                    }
                    
                    // Check include filters if specified
                    if (includeTypes.length > 0) {
                        let included = false;
                        for (const includeType of includeTypes) {
                            const include = includeType.toLowerCase();
                            if (objectType.includes(include) || classification.includes(include)) {
                                included = true;
                                break;
                            }
                        }
                        if (!included) {
                            console.log(`Not including ${id}: ${objectName} (doesn't match include filters)`);
                            return null;
                        }
                    }
                    
                    return { id, data };
                })
                .catch(() => null)
        );
        
        try {
            const results = await Promise.all(batchPromises);
            results.forEach(result => {
                if (result && result.id) {
                    filteredIDs.push(result.id);
                }
            });
            
            console.log(`Processed ${i + batch.length} objects, ${filteredIDs.length} passed filters`);
            
            // Stop early if we have enough results
            if (filteredIDs.length >= 50) break;
        } catch (error) {
            console.error('Error filtering batch:', error);
        }
    }
    
    return filteredIDs;
}

// Validate object IDs by checking if they have images
async function validateObjectIDs(objectIds, maxToValidate = 50) {
    const validatedIDs = [];
    const cacheKey = objectIds.slice(0, 10).join(','); // Use first 10 IDs as cache key
    
    // Check cache first
    const cached = validatedIDsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < VALIDATION_CACHE_DURATION) {
        console.log('Returning cached validated IDs');
        return cached.validIDs;
    }
    
    console.log(`Validating up to ${maxToValidate} object IDs for images...`);
    
    // Process in batches for efficiency
    const batchSize = 10;
    let processed = 0;
    
    for (let i = 0; i < objectIds.length && validatedIDs.length < maxToValidate; i += batchSize) {
        if (processed >= maxToValidate * 2) break; // Stop if we've checked too many
        
        const batch = objectIds.slice(i, Math.min(i + batchSize, objectIds.length));
        const batchPromises = batch.map(id => 
            fetchWithProxy(`/objects/${id}`)
                .then(data => ({ id, hasImage: !!(data && (data.primaryImage || data.primaryImageSmall)) }))
                .catch(() => ({ id, hasImage: false }))
        );
        
        try {
            const results = await Promise.all(batchPromises);
            results.forEach(result => {
                if (result.hasImage) {
                    validatedIDs.push(result.id);
                }
            });
            processed += batch.length;
            
            console.log(`Validated ${processed} IDs, found ${validatedIDs.length} with images`);
        } catch (error) {
            console.error('Error validating batch:', error);
        }
        
        // Early exit if we have enough
        if (validatedIDs.length >= maxToValidate) break;
    }
    
    // Cache the results
    validatedIDsCache.set(cacheKey, {
        validIDs: validatedIDs,
        timestamp: Date.now()
    });
    
    return validatedIDs;
}

// Clear search cache
function clearSearchCache() {
    searchCache.clear();
    validatedIDsCache.clear();
    console.log('Search and validation caches cleared');
}

// Get details for a specific object by ID
async function getObjectDetails(objectId) {
    try {
        const data = await fetchWithProxy(`/objects/${objectId}`);
        
        // Validate that the artwork has an image
        if (data && (data.primaryImage || data.primaryImageSmall)) {
            return data;
        } else {
            console.log(`Object ${objectId} has no image, skipping`);
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
        window.MetUI.updateLoadingMessage('Searching for artworks...');
        
        // Get a list of object IDs that match the filters
        const objectIDs = await searchObjects(filters);
        
        if (!objectIDs || objectIDs.length === 0) {
            console.warn('No objects found matching the filters');
            window.MetUI.hideLoading();
            window.MetUI.showError('No artworks found matching your filters. Try different criteria.');
            return null;
        }
        
        // Try to find an artwork with an image
        let objectDetails = null;
        let attempts = 0;
        const maxAttempts = Math.min(10, objectIDs.length);
        const triedIndices = new Set();
        
        while (!objectDetails && attempts < maxAttempts && triedIndices.size < objectIDs.length) {
            // Select a random object ID that we haven't tried yet
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * objectIDs.length);
            } while (triedIndices.has(randomIndex) && triedIndices.size < objectIDs.length);
            
            triedIndices.add(randomIndex);
            const randomObjectId = objectIDs[randomIndex];
            
            console.log(`Attempt ${attempts + 1}: Trying object ID ${randomObjectId}`);
            
            // Update loading message
            window.MetUI.updateLoadingMessage('Searching for artwork with image...');
            
            // Get the details for the random object
            objectDetails = await getObjectDetails(randomObjectId);
            
            attempts++;
        }
        
        // Hide loading state
        window.MetUI.hideLoading();
        
        if (!objectDetails) {
            console.warn('Could not find any artwork with images after', attempts, 'attempts');
            window.MetUI.showError('No artworks with images found. Try different filters.');
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
    searchByArtist,
    searchByTitle,
    getArtistSuggestions,
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