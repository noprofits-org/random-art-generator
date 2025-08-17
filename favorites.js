// Favorites management using IndexedDB

const FAVORITES_DB_NAME = 'MetArtFavorites';
const FAVORITES_DB_VERSION = 1;
const FAVORITES_STORE_NAME = 'favorites';
const MAX_FAVORITES = 100; // Limit to prevent storage issues
const THUMBNAIL_MAX_SIZE = 300; // Max width/height for thumbnails

let db = null;

// Initialize IndexedDB
async function initFavoritesDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(FAVORITES_DB_NAME, FAVORITES_DB_VERSION);
        
        request.onerror = () => {
            console.error('Failed to open favorites database');
            reject(request.error);
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Favorites database opened successfully');
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
                
                console.log('Favorites object store created');
            }
        };
    });
}

// Create thumbnail from image URL
async function createThumbnail(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate thumbnail dimensions
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > THUMBNAIL_MAX_SIZE) {
                    height = (height * THUMBNAIL_MAX_SIZE) / width;
                    width = THUMBNAIL_MAX_SIZE;
                }
            } else {
                if (height > THUMBNAIL_MAX_SIZE) {
                    width = (width * THUMBNAIL_MAX_SIZE) / height;
                    height = THUMBNAIL_MAX_SIZE;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and convert to data URL
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        
        img.onerror = () => {
            console.error('Failed to create thumbnail');
            resolve(null);
        };
        
        img.src = imageUrl;
    });
}

// Add artwork to favorites
async function addToFavorites(artwork) {
    if (!db) await initFavoritesDB();
    
    try {
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
            thumbnail = await createThumbnail(imageUrl);
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
        const request = objectStore.put(favorite);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                console.log(`Added artwork ${artwork.objectID} to favorites`);
                // Notify service worker to cache the image
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'CACHE_FAVORITE',
                        objectID: artwork.objectID,
                        imageUrl: artwork.primaryImage
                    });
                }
                resolve(true);
            };
            
            request.onerror = () => {
                console.error('Failed to add favorite');
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Error adding to favorites:', error);
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
            console.log(`Removed artwork ${objectID} from favorites`);
            resolve(true);
        };
        
        request.onerror = () => {
            console.error('Failed to remove favorite');
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
            console.error('Failed to check favorite status');
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
            console.error('Failed to get favorites');
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
            console.error('Failed to get favorite');
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
            console.error('Failed to get favorites count');
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
                console.log(`Removed oldest favorite: ${cursor.value.objectID}`);
                resolve(true);
            } else {
                resolve(false);
            }
        };
        
        request.onerror = () => {
            console.error('Failed to remove oldest favorite');
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
            console.log('Cleared all favorites');
            resolve(true);
        };
        
        request.onerror = () => {
            console.error('Failed to clear favorites');
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

// Initialize favorites on load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initFavoritesDB();
        console.log('Favorites system initialized');
    } catch (error) {
        console.error('Failed to initialize favorites:', error);
    }
});

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
    toggleFavorite
};