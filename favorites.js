// Favorites management using IndexedDB

const FAVORITES_DB_NAME = 'MetArtFavorites';
const FAVORITES_DB_VERSION = 1;
const FAVORITES_STORE_NAME = 'favorites';
const MAX_FAVORITES = 100; // Limit to prevent storage issues
const THUMBNAIL_MAX_SIZE = 300; // Max width/height for thumbnails

let db = null;

// Initialize IndexedDB with better error handling
async function initFavoritesDB() {
    // Return existing db if already initialized
    if (db && db.objectStoreNames.contains(FAVORITES_STORE_NAME)) {
        return db;
    }
    
    return new Promise((resolve, reject) => {
        // Check if IndexedDB is available
        if (!window.indexedDB) {
            const error = new Error('IndexedDB is not supported in this browser');
            console.error(error.message); // Critical: IndexedDB not supported - favorites won't work
            reject(error);
            return;
        }
        
        const request = indexedDB.open(FAVORITES_DB_NAME, FAVORITES_DB_VERSION);
        
        request.onerror = () => {
            const error = request.error || new Error('Failed to open favorites database');
            window.MetLogger?.error('IndexedDB error:', error);
            reject(error);
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            
            // Handle database errors
            db.onerror = (event) => {
                window.MetLogger?.error('Database error:', event.target.error);
            };
            
            // Handle version change
            db.onversionchange = () => {
                db.close();
                db = null;
                window.MetLogger?.log('Database version changed, connection closed');
            };
            
            window.MetLogger?.log('Favorites database opened successfully');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(FAVORITES_STORE_NAME)) {
                const objectStore = db.createObjectStore(FAVORITES_STORE_NAME, { 
                    keyPath: 'objectID' 
                });
                
                // Create indexes for searching
                objectStore.createIndex('dateAdded', 'dateAdded', { unique: false });
                objectStore.createIndex('department', 'department', { unique: false });
                objectStore.createIndex('isHighlight', 'isHighlight', { unique: false });
                
                window.MetLogger?.log('Favorites object store created');
            }
        };
        
        request.onblocked = () => {
            window.MetLogger?.warn('Database blocked by another connection');
        };
    });
}

// Thumbnail cache management
const thumbnailCache = new Map();
const THUMBNAIL_CACHE_NAME = 'met-thumbnails';
const THUMBNAIL_CACHE_VERSION = 1;

// Initialize thumbnail cache in IndexedDB
async function initThumbnailCache() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(THUMBNAIL_CACHE_NAME, THUMBNAIL_CACHE_VERSION);
        
        request.onerror = () => {
            window.MetLogger?.error('Failed to open thumbnail cache');
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

// Get cached thumbnail
async function getCachedThumbnail(objectID) {
    // Check memory cache first
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
                    // Update memory cache
                    thumbnailCache.set(objectID, result.thumbnail);
                    
                    // Update last accessed time
                    updateThumbnailAccess(objectID);
                    
                    resolve(result.thumbnail);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    } catch (error) {
        window.MetLogger?.error('Error getting cached thumbnail:', error);
        return null;
    }
}

// Save thumbnail to cache
async function saveThumbnailToCache(objectID, thumbnail) {
    // Save to memory cache
    thumbnailCache.set(objectID, thumbnail);
    
    // Limit memory cache size
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
        
        // Clean up old thumbnails if needed
        cleanupOldThumbnails(db);
    } catch (error) {
        window.MetLogger?.error('Error saving thumbnail to cache:', error);
    }
}

// Update thumbnail access time
async function updateThumbnailAccess(objectID) {
    try {
        const db = await initThumbnailCache();
        const transaction = db.transaction(['thumbnails'], 'readwrite');
        const store = transaction.objectStore('thumbnails');
        const request = store.get(objectID);
        
        request.onsuccess = () => {
            const data = request.result;
            if (data) {
                data.lastAccessed = Date.now();
                store.put(data);
            }
        };
    } catch (error) {
        window.MetLogger?.error('Error updating thumbnail access:', error);
    }
}

// Clean up old thumbnails
async function cleanupOldThumbnails(db) {
    const transaction = db.transaction(['thumbnails'], 'readwrite');
    const store = transaction.objectStore('thumbnails');
    const index = store.index('lastAccessed');
    const countRequest = store.count();
    
    countRequest.onsuccess = () => {
        const count = countRequest.result;
        if (count > 200) { // Keep max 200 thumbnails
            const deleteCount = count - 150; // Delete down to 150
            const cursor = index.openCursor();
            let deleted = 0;
            
            cursor.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && deleted < deleteCount) {
                    store.delete(cursor.primaryKey);
                    deleted++;
                    cursor.continue();
                }
            };
        }
    };
}

// Create thumbnail from image URL with caching
async function createThumbnail(imageUrl, objectID) {
    // Check cache first
    if (objectID) {
        const cached = await getCachedThumbnail(objectID);
        if (cached) {
            window.MetLogger?.log(`Using cached thumbnail for ${objectID}`);
            return cached;
        }
    }
    
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        // Set timeout for image loading
        const timeout = setTimeout(() => {
            window.MetLogger?.warn('Thumbnail creation timed out');
            img.src = ''; // Cancel loading
            resolve(null);
        }, 5000); // 5 second timeout
        
        img.onload = () => {
            clearTimeout(timeout);
            
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                    window.MetLogger?.error('Canvas context not available');
                    resolve(null);
                    return;
                }
                
                // Calculate thumbnail dimensions
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
                
                // Use better image rendering
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Draw and convert to data URL
                ctx.drawImage(img, 0, 0, width, height);
                
                // Use webp if supported, fallback to jpeg
                const dataUrl = canvas.toDataURL('image/webp', 0.85);
                const thumbnail = dataUrl.includes('data:image/webp') ? dataUrl : canvas.toDataURL('image/jpeg', 0.85);
                
                // Cache the thumbnail
                if (objectID) {
                    saveThumbnailToCache(objectID, thumbnail);
                }
                
                resolve(thumbnail);
            } catch (error) {
                window.MetLogger?.error('Error creating thumbnail:', error);
                resolve(null);
            }
        };
        
        img.onerror = () => {
            clearTimeout(timeout);
            window.MetLogger?.error('Failed to load image for thumbnail');
            resolve(null);
        };
        
        img.src = imageUrl;
    });
}

// Add artwork to favorites with better error handling
async function addToFavorites(artwork) {
    try {
        // Ensure database is initialized
        if (!db) {
            await initFavoritesDB();
        }
        
        // Validate artwork object
        if (!artwork || !artwork.objectID) {
            throw new Error('Invalid artwork object');
        }
        // Check if we've reached the limit
        const count = await getFavoritesCount();
        if (count >= MAX_FAVORITES) {
            // Remove oldest favorite
            await removeOldestFavorite();
        }
        
        // Create thumbnail if image exists
        let thumbnail = null;
        if (artwork.primaryImageSmall) {
            // Use the proxied URL if available
            const imageUrl = window.MetAPI && window.MetAPI.loadArtworkImage 
                ? window.MetAPI.loadArtworkImage(artwork.primaryImageSmall)
                : artwork.primaryImageSmall;
            thumbnail = await createThumbnail(imageUrl, artwork.objectID);
        }
        
        // Prepare favorite object
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
            // Store essential metadata for offline viewing
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
        
        // Set up transaction error handling
        transaction.onerror = () => {
            window.MetLogger?.error('Transaction error:', transaction.error);
        };
        
        transaction.onabort = () => {
            window.MetLogger?.error('Transaction aborted');
        };
        
        const request = objectStore.put(favorite);
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                window.MetLogger?.log(`Added artwork ${artwork.objectID} to favorites`);
                
                // Notify service worker to cache the image
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    try {
                        navigator.serviceWorker.controller.postMessage({
                            type: 'CACHE_FAVORITE',
                            objectID: artwork.objectID,
                            imageUrl: artwork.primaryImage
                        });
                    } catch (error) {
                        window.MetLogger?.warn('Failed to notify service worker:', error);
                    }
                }
                
                // FIXED: Defensive check for UI update
                if (window.MetUI && window.MetUI.updateFavoriteButton) {
                    window.MetUI.updateFavoriteButton(artwork.objectID, true);
                }
                
                resolve(true);
            };
            
            request.onerror = () => {
                const error = request.error || new Error('Failed to add favorite');
                window.MetLogger?.error('Failed to add favorite:', error);
                reject(error);
            };
        });
    } catch (error) {
        window.MetLogger?.error('Error adding to favorites:', error);
        
        // Show user-friendly error message
        if (window.MetUI && window.MetUI.showError) {
            window.MetUI.showError('Unable to save favorite. Please try again.');
        }
        
        throw error;
    }
}

// Remove artwork from favorites
async function removeFromFavorites(objectID) {
    if (!db) await initFavoritesDB();
    
    const transaction = db.transaction([FAVORITES_STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
    const request = objectStore.delete(objectID);
    
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            window.MetLogger?.log(`Removed artwork ${objectID} from favorites`);
            resolve(true);
        };
        
        request.onerror = () => {
            window.MetLogger?.error('Failed to remove favorite');
            reject(request.error);
        };
    });
}

// Check if artwork is favorited
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
            window.MetLogger?.error('Failed to check favorite status');
            reject(request.error);
        };
    });
}

// Get all favorites
async function getAllFavorites() {
    if (!db) await initFavoritesDB();
    
    const transaction = db.transaction([FAVORITES_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
    const index = objectStore.index('dateAdded');
    const request = index.openCursor(null, 'prev'); // Sort by date added, newest first
    
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
            window.MetLogger?.error('Failed to get favorites');
            reject(request.error);
        };
    });
}

// Get favorite by ID
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
            window.MetLogger?.error('Failed to get favorite');
            reject(request.error);
        };
    });
}

// Get favorites count
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
            window.MetLogger?.error('Failed to get favorites count');
            reject(request.error);
        };
    });
}

// Remove oldest favorite when limit is reached
async function removeOldestFavorite() {
    if (!db) await initFavoritesDB();
    
    const transaction = db.transaction([FAVORITES_STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
    const index = objectStore.index('dateAdded');
    const request = index.openCursor(); // Get oldest first
    
    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                objectStore.delete(cursor.value.objectID);
                window.MetLogger?.log(`Removed oldest favorite: ${cursor.value.objectID}`);
                resolve(true);
            } else {
                resolve(false);
            }
        };
        
        request.onerror = () => {
            window.MetLogger?.error('Failed to remove oldest favorite');
            reject(request.error);
        };
    });
}

// Clear all favorites
async function clearAllFavorites() {
    if (!db) await initFavoritesDB();
    
    const transaction = db.transaction([FAVORITES_STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(FAVORITES_STORE_NAME);
    const request = objectStore.clear();
    
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            window.MetLogger?.log('Cleared all favorites');
            resolve(true);
        };
        
        request.onerror = () => {
            window.MetLogger?.error('Failed to clear favorites');
            reject(request.error);
        };
    });
}

// Toggle favorite status
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

// Initialize favorites with better lifecycle management
let initPromise = null;

async function ensureFavoritesInitialized() {
    if (!initPromise) {
        initPromise = initFavoritesDB().catch(error => {
            console.error('Failed to initialize favorites database. Favorites feature will not work.', error); // Critical: Database initialization failure
            initPromise = null; // Allow retry
            throw error;
        });
    }
    return initPromise;
}

// Initialize on multiple events to ensure it runs
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureFavoritesInitialized);
} else {
    // DOM already loaded
    ensureFavoritesInitialized();
}

// Also try to initialize when first used
const originalFunctions = {
    addToFavorites,
    removeFromFavorites,
    isFavorited,
    getAllFavorites,
    getFavorite,
    toggleFavorite
};

// Wrap each function to ensure initialization
for (const [name, fn] of Object.entries(originalFunctions)) {
    window[name] = async function(...args) {
        await ensureFavoritesInitialized();
        return fn.apply(this, args);
    };
}

// FIXED: Add cleanup function
function cleanup() {
    window.MetLogger?.log('Cleaning up favorites module...');
    
    // Close database connection
    if (db) {
        db.close();
        db = null;
    }
    
    // Reset initialization state
    favoritesDBInitialized = false;
}

// Make functions available globally
window.MetFavorites = {
    initFavoritesDB,
    addToFavorites,
    removeFromFavorites,
    isFavorited,
    getAllFavorites,
    getFavorite,
    getFavoritesCount,
    clearAllFavorites,
    toggleFavorite,
    cleanup
};