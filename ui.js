// UI related functions

// Initialize UI elements and event listeners
function initUI() {
    // Get references to DOM elements
    const toggleDrawerButton = document.getElementById('toggleDrawer');
    const controlsDrawer = document.getElementById('controlsDrawer');
    const contentArea = document.getElementById('contentArea');

    // Check if mobile
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        initMobileUI();
    } else {
        // Desktop drawer toggle
        toggleDrawerButton.addEventListener('click', () => {
            controlsDrawer.classList.toggle('collapsed');
            
            // Check if drawer is now collapsed
            const isCollapsed = controlsDrawer.classList.contains('collapsed');
            
            // Update the button icon
            const iconElement = toggleDrawerButton.querySelector('i');
            if (isCollapsed) {
                iconElement.classList.remove('fa-chevron-left');
                iconElement.classList.add('fa-chevron-right');
            } else {
                iconElement.classList.remove('fa-chevron-right');
                iconElement.classList.add('fa-chevron-left');
            }
        });
    }

    // Handle window resize for responsive behavior
    let wasMobile = isMobile;
    window.addEventListener('resize', () => {
        const isNowMobile = window.innerWidth <= 768;
        if (wasMobile !== isNowMobile) {
            wasMobile = isNowMobile;
            if (isNowMobile) {
                initMobileUI();
            } else {
                removeMobileUI();
            }
        }
    });
    
    // Add a status indicator to the UI
    addStatusIndicator();
}

// Initialize mobile UI
function initMobileUI() {
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const controlsDrawer = document.getElementById('controlsDrawer');
    const closeDrawer = document.getElementById('closeDrawer');
    const artworkInfo = document.getElementById('artworkInfo');
    const artworkContainer = document.getElementById('artworkContainer');
    
    // Mobile menu button
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', openMobileDrawer);
    }
    
    // Close drawer button
    if (closeDrawer) {
        closeDrawer.addEventListener('click', closeMobileDrawer);
    }
    
    // Overlay click
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', closeMobileDrawer);
    }
    
    // Handle swipe down on drawer
    initDrawerSwipe();
    
    // Handle collapsible artwork info
    if (artworkInfo) {
        initArtworkInfoSwipe();
    }
    
    // Handle swipe gestures on artwork
    if (artworkContainer) {
        initArtworkSwipeGestures();
    }
}

// Remove mobile UI event listeners
function removeMobileUI() {
    const controlsDrawer = document.getElementById('controlsDrawer');
    const info = document.getElementById('artworkInfo');
    const container = document.getElementById('artworkContainer');
    
    // Clean up event handlers
    const handle = controlsDrawer?.querySelector('.mobile-drawer-handle');
    
    // Remove drawer swipe handlers
    if (handle && handle._swipeHandlers) {
        handle.removeEventListener('touchstart', handle._swipeHandlers.handleStart);
        handle.removeEventListener('touchmove', handle._swipeHandlers.handleMove);
        handle.removeEventListener('touchend', handle._swipeHandlers.handleEnd);
        handle.removeEventListener('mousedown', handle._swipeHandlers.handleStart);
        delete handle._swipeHandlers;
    }
    
    // Remove info swipe handlers
    if (info && info._swipeHandlers) {
        info.removeEventListener('touchstart', info._swipeHandlers.handleStart);
        info.removeEventListener('touchmove', info._swipeHandlers.handleMove);
        info.removeEventListener('touchend', info._swipeHandlers.handleEnd);
        delete info._swipeHandlers;
    }
    
    // Remove container swipe handlers
    if (container && container._swipeHandlers) {
        container.removeEventListener('touchstart', container._swipeHandlers.handleTouchStart);
        container.removeEventListener('touchmove', container._swipeHandlers.handleTouchMove);
        container.removeEventListener('touchend', container._swipeHandlers.handleTouchEnd);
        delete container._swipeHandlers;
    }
    
    // Reset UI state
    controlsDrawer?.classList.remove('active');
    document.getElementById('mobileOverlay')?.classList.remove('active');
    document.body.style.overflow = '';
    document.body.classList.remove('mobile');
}

// Open mobile drawer
function openMobileDrawer() {
    const controlsDrawer = document.getElementById('controlsDrawer');
    const mobileOverlay = document.getElementById('mobileOverlay');
    
    controlsDrawer.classList.add('active');
    mobileOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close mobile drawer
function closeMobileDrawer() {
    const controlsDrawer = document.getElementById('controlsDrawer');
    const mobileOverlay = document.getElementById('mobileOverlay');
    
    controlsDrawer.classList.remove('active');
    mobileOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Initialize drawer swipe gestures
function initDrawerSwipe() {
    const drawer = document.getElementById('controlsDrawer');
    const handle = drawer.querySelector('.mobile-drawer-handle');
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    
    const handleStart = (e) => {
        isDragging = true;
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        drawer.style.transition = 'none';
    };
    
    const handleMove = (e) => {
        if (!isDragging) return;
        
        currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const deltaY = currentY - startY;
        
        if (deltaY > 0) {
            drawer.style.transform = `translateY(${deltaY}px)`;
        }
    };
    
    const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        
        drawer.style.transition = '';
        const deltaY = currentY - startY;
        
        if (deltaY > 100) {
            closeMobileDrawer();
        } else {
            drawer.style.transform = '';
        }
    };
    
    // Touch events
    handle.addEventListener('touchstart', handleStart, { passive: true });
    handle.addEventListener('touchmove', handleMove, { passive: true });
    handle.addEventListener('touchend', handleEnd);
    
    // Mouse events for testing
    handle.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
}

// Initialize artwork info swipe
function initArtworkInfoSwipe() {
    const info = document.getElementById('artworkInfo');
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    
    const handleStart = (e) => {
        isDragging = true;
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        info.style.transition = 'none';
    };
    
    const handleMove = (e) => {
        if (!isDragging) return;
        
        currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const deltaY = currentY - startY;
        
        if (deltaY > 0) {
            info.style.transform = `translateY(${deltaY}px)`;
        }
    };
    
    const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        
        info.style.transition = '';
        const deltaY = currentY - startY;
        
        if (deltaY > 50) {
            info.classList.add('collapsed');
        } else if (deltaY < -50) {
            info.classList.remove('collapsed');
        }
        
        info.style.transform = '';
    };
    
    info.addEventListener('touchstart', handleStart, { passive: true });
    info.addEventListener('touchmove', handleMove, { passive: true });
    info.addEventListener('touchend', handleEnd);
}

// Initialize artwork swipe gestures
function initArtworkSwipeGestures() {
    const container = document.getElementById('artworkContainer');
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    
    container.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });
    
    container.addEventListener('touchend', (e) => {
        endX = e.changedTouches[0].clientX;
        endY = e.changedTouches[0].clientY;
        
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        
        // Check if horizontal swipe
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                // Swipe right - previous artwork
                console.log('Swipe right - previous artwork');
                // Implement previous artwork logic
            } else {
                // Swipe left - next artwork
                console.log('Swipe left - next artwork');
                // Trigger random artwork button
                const randomButton = document.getElementById('randomArtButton');
                if (randomButton) randomButton.click();
            }
        }
    }, { passive: true });
}

// Add a status indicator to the bottom of the screen
function addStatusIndicator() {
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'statusIndicator';
    statusIndicator.className = 'status-indicator';
    statusIndicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Ready</span>';
    document.body.appendChild(statusIndicator);
}

// Update the status indicator
function updateStatus(message, type = 'info') {
    const statusIndicator = document.getElementById('statusIndicator');
    if (!statusIndicator) return;
    
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');
    
    // Update status text
    statusText.textContent = message;
    
    // Update status type
    statusIndicator.className = `status-indicator ${type}`;
    
    // Make the status visible
    statusIndicator.style.opacity = '1';
    
    // Auto-hide info messages after 5 seconds
    if (type === 'info') {
        setTimeout(() => {
            statusIndicator.style.opacity = '0';
        }, 5000);
    }
}

// Show API connection status
function showConnectionStatus(isConnected) {
    const statusIndicator = document.getElementById('statusIndicator');
    if (!statusIndicator) return;

    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');

    // Update status text and dot based on connection
    statusText.textContent = isConnected ? 'Connected to Met API' : 'Disconnected from Met API';
    statusIndicator.className = `status-indicator ${isConnected ? 'success' : 'error'}`;
    statusDot.style.backgroundColor = isConnected ? '#28a745' : '#dc3545';

    // Make the status visible
    statusIndicator.style.opacity = '1';

    // Auto-hide after 5 seconds if connected
    if (isConnected) {
        setTimeout(() => {
            statusIndicator.style.opacity = '0';
        }, 5000);
    }
}

// Show loading state
function showLoading() {
    const artworkContainer = document.getElementById('artworkContainer');
    
    // Create loading element if it doesn't exist
    let loadingElement = document.querySelector('.loading');
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.className = 'loading';
        loadingElement.innerHTML = '<div class="loading-spinner"></div><p class="loading-text">Fetching artwork...</p>';
        artworkContainer.appendChild(loadingElement);
    } else {
        // Update loading message
        const loadingText = loadingElement.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Fetching artwork...';
        }
    }
    
    // Show the loading element
    loadingElement.style.display = 'flex';
    
    // Update status
    updateStatus('Loading...', 'loading');
}

// Update loading message
function updateLoadingMessage(message) {
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        const loadingText = loadingElement.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        } else {
            const newLoadingText = document.createElement('p');
            newLoadingText.className = 'loading-text';
            newLoadingText.textContent = message;
            loadingElement.appendChild(newLoadingText);
        }
    }
    
    // Update status
    updateStatus(message, 'loading');
}

// Hide loading state
function hideLoading() {
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    // Update status
    updateStatus('Ready', 'info');
}

// Show error message
function showError(message) {
    const artworkContainer = document.getElementById('artworkContainer');
    
    // Create error element
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    
    // Add error message
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    errorElement.appendChild(messageElement);
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.textContent = 'Try Again';
    retryButton.addEventListener('click', () => {
        // Get current filters and try again
        const filters = window.MetFilters ? window.MetFilters.getCurrentFilters() : {};
        
        if (window.MetAPI) {
            // Clear error message
            artworkContainer.innerHTML = '';
            
            // Add placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'artwork-placeholder';
            placeholder.innerHTML = `
                <i class="fas fa-paint-brush"></i>
                <p>Retrying...</p>
            `;
            artworkContainer.appendChild(placeholder);
            
            // Get random artwork with the selected filters
            setTimeout(async () => {
                const artwork = await window.MetAPI.getRandomArtwork(filters);
                
                // Display the artwork if we got one
                if (artwork && window.MetArtwork) {
                    window.MetArtwork.displayArtwork(artwork);
                }
            }, 500);
        }
    });
    errorElement.appendChild(retryButton);
    
    // Add button to try without filters
    const noFiltersButton = document.createElement('button');
    noFiltersButton.className = 'retry-button no-filters';
    noFiltersButton.textContent = 'Try Without Filters';
    noFiltersButton.addEventListener('click', () => {
        if (window.MetAPI) {
            // Clear error message
            artworkContainer.innerHTML = '';
            
            // Add placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'artwork-placeholder';
            placeholder.innerHTML = `
                <i class="fas fa-paint-brush"></i>
                <p>Fetching any artwork...</p>
            `;
            artworkContainer.appendChild(placeholder);
            
            // Get random artwork without filters
            setTimeout(async () => {
                // Reset department dropdown to "Any Department"
                const departmentSelect = document.getElementById('departmentSelect');
                if (departmentSelect) {
                    departmentSelect.value = '';
                }
                
                // Reset date inputs
                const dateBeginInput = document.getElementById('dateBegin');
                const dateEndInput = document.getElementById('dateEnd');
                if (dateBeginInput) dateBeginInput.value = '';
                if (dateEndInput) dateEndInput.value = '';
                
                // Reset medium dropdown to "Any Medium"
                const mediumSelect = document.getElementById('mediumSelect');
                if (mediumSelect) {
                    mediumSelect.value = '';
                }
                
                // Get random artwork with no filters
                const artwork = await window.MetAPI.getRandomArtwork({});
                
                // Display the artwork if we got one
                if (artwork && window.MetArtwork) {
                    window.MetArtwork.displayArtwork(artwork);
                }
            }, 500);
        }
    });
    errorElement.appendChild(noFiltersButton);
    
    // Clear container and add error
    artworkContainer.innerHTML = '';
    artworkContainer.appendChild(errorElement);
    
    // Update status
    updateStatus(message, 'error');
}

// Initialize offline detection
function initOfflineDetection() {
    // Check initial online status
    updateOnlineStatus(navigator.onLine);
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
        console.log('[UI] App is online');
        updateOnlineStatus(true);
    });
    
    window.addEventListener('offline', () => {
        console.log('[UI] App is offline');
        updateOnlineStatus(false);
    });
    
    // Check for offline mode parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'offline') {
        showOfflineCollection();
    }
}

// Update UI based on online/offline status
async function updateOnlineStatus(isOnline) {
    const statusIndicator = document.getElementById('statusIndicator');
    if (!statusIndicator) return;
    
    if (isOnline) {
        // Show online status briefly
        updateStatus('Back online', 'success');
        
        // Hide after 3 seconds
        setTimeout(() => {
            const currentStatus = statusIndicator.querySelector('.status-text').textContent;
            if (currentStatus === 'Back online') {
                statusIndicator.style.opacity = '0';
            }
        }, 3000);
    } else {
        // Get cache info from service worker
        const cacheInfo = await getCacheInfo();
        
        // Show offline status with cache info
        if (cacheInfo.cachedArtworks > 0) {
            updateStatus(`Offline - ${cacheInfo.cachedArtworks} artworks available`, 'warning');
            
            // Add offline collection button if it doesn't exist
            addOfflineCollectionButton();
        } else {
            updateStatus('Offline - no cached content', 'warning');
        }
        statusIndicator.style.opacity = '1';
    }
}

// Get cache information from service worker
async function getCacheInfo() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        return new Promise((resolve) => {
            const messageChannel = new MessageChannel();
            
            navigator.serviceWorker.controller.postMessage(
                { type: 'GET_CACHE_INFO' }, 
                [messageChannel.port2]
            );
            
            messageChannel.port1.onmessage = (event) => {
                resolve(event.data);
            };
            
            // Timeout fallback
            setTimeout(() => {
                resolve({ cachedArtworks: 0, cachedImages: 0 });
            }, 1000);
        });
    }
    return { cachedArtworks: 0, cachedImages: 0 };
}

// Add offline collection button to status indicator
function addOfflineCollectionButton() {
    const statusIndicator = document.getElementById('statusIndicator');
    if (!statusIndicator || statusIndicator.querySelector('.offline-collection-btn')) return;
    
    const button = document.createElement('button');
    button.className = 'offline-collection-btn';
    button.innerHTML = '<i class="fas fa-images"></i>';
    button.title = 'View offline collection';
    button.style.cssText = `
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        margin-left: 10px;
        font-size: 1rem;
    `;
    
    button.addEventListener('click', showOfflineCollection);
    statusIndicator.appendChild(button);
}

// Show offline collection
async function showOfflineCollection() {
    if (!window.MetAPI) return;
    
    showLoading();
    updateLoadingMessage('Loading offline collection...');
    
    try {
        const artwork = await window.MetAPI.getRandomCachedArtwork();
        if (artwork && window.MetArtwork) {
            window.MetArtwork.displayArtwork(artwork);
        } else {
            hideLoading();
            showError('No cached artworks available. View some artworks online first!');
        }
    } catch (error) {
        hideLoading();
        showError('Error loading offline collection');
    }
}

// Initialize favorites view functionality
function initFavoritesView() {
    const viewFavoritesButton = document.getElementById('viewFavoritesButton');
    const favoritesModal = document.getElementById('favoritesModal');
    const closeFavoritesModal = document.getElementById('closeFavoritesModal');
    const clearFavoritesButton = document.getElementById('clearFavoritesButton');
    
    // View favorites button click handler
    if (viewFavoritesButton) {
        viewFavoritesButton.addEventListener('click', async () => {
            await showFavoritesModal();
        });
    }
    
    // Close modal handler
    if (closeFavoritesModal) {
        closeFavoritesModal.addEventListener('click', () => {
            hideFavoritesModal();
        });
    }
    
    // Close modal on background click
    if (favoritesModal) {
        favoritesModal.addEventListener('click', (e) => {
            if (e.target === favoritesModal) {
                hideFavoritesModal();
            }
        });
    }
    
    // Clear all favorites handler
    if (clearFavoritesButton) {
        clearFavoritesButton.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all favorites? This cannot be undone.')) {
                await clearAllFavorites();
            }
        });
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && favoritesModal && favoritesModal.classList.contains('show')) {
            hideFavoritesModal();
        }
    });
}

// Show favorites modal
async function showFavoritesModal() {
    const favoritesModal = document.getElementById('favoritesModal');
    const favoritesGrid = document.getElementById('favoritesGrid');
    const favoritesCount = document.getElementById('favoritesCount');
    
    if (!favoritesModal || !favoritesGrid || !window.MetFavorites) return;
    
    // Show modal
    favoritesModal.classList.add('show');
    
    // Load favorites
    favoritesGrid.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
    
    try {
        const favorites = await window.MetFavorites.getAllFavorites();
        const count = favorites.length;
        
        // Update count
        favoritesCount.textContent = count === 0 ? 'No favorites' : 
                                    count === 1 ? '1 favorite' : 
                                    `${count} favorites`;
        
        if (count === 0) {
            // Show empty state
            favoritesGrid.innerHTML = `
                <div class="favorites-empty">
                    <i class="fas fa-heart-broken"></i>
                    <p>You haven't added any favorites yet!</p>
                    <p>Click the heart icon on any artwork to save it here.</p>
                </div>
            `;
        } else {
            // Display favorites grid
            favoritesGrid.innerHTML = favorites.map(favorite => createFavoriteItemHTML(favorite)).join('');
            
            // Add click handlers to favorite items
            const favoriteItems = favoritesGrid.querySelectorAll('.favorite-item');
            favoriteItems.forEach(item => {
                item.addEventListener('click', async () => {
                    const objectID = item.dataset.objectId;
                    await displayFavoriteFromModal(objectID);
                });
            });
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
        favoritesGrid.innerHTML = `
            <div class="error-message">
                <p>Error loading favorites</p>
            </div>
        `;
    }
}

// Hide favorites modal
function hideFavoritesModal() {
    const favoritesModal = document.getElementById('favoritesModal');
    if (favoritesModal) {
        favoritesModal.classList.remove('show');
    }
}

// Create HTML for a favorite item in the grid
function createFavoriteItemHTML(favorite) {
    const imageHtml = favorite.thumbnail 
        ? `<img src="${favorite.thumbnail}" alt="${favorite.title}" class="favorite-item-image">`
        : `<div class="favorite-item-placeholder">
               <i class="fas fa-image"></i>
           </div>`;
    
    return `
        <div class="favorite-item" data-object-id="${favorite.objectID}">
            ${imageHtml}
            <div class="favorite-item-info">
                <div class="favorite-item-title">${favorite.title || 'Untitled'}</div>
                <div class="favorite-item-artist">${favorite.artistDisplayName || 'Unknown Artist'}</div>
            </div>
        </div>
    `;
}

// Display a favorite artwork from the modal
async function displayFavoriteFromModal(objectID) {
    if (!window.MetFavorites || !window.MetArtwork) return;
    
    try {
        const favorite = await window.MetFavorites.getFavorite(objectID);
        if (favorite) {
            // Close the modal
            hideFavoritesModal();
            
            // Display the artwork
            window.MetArtwork.displayFavoriteArtwork(favorite);
            
            // Update status
            updateStatus('Loaded from favorites', 'success');
        }
    } catch (error) {
        console.error('Error displaying favorite:', error);
        updateStatus('Error loading favorite', 'error');
    }
}

// Clear all favorites
async function clearAllFavorites() {
    if (!window.MetFavorites) return;
    
    try {
        await window.MetFavorites.clearAllFavorites();
        
        // Update the modal if it's open
        const favoritesModal = document.getElementById('favoritesModal');
        if (favoritesModal && favoritesModal.classList.contains('show')) {
            await showFavoritesModal();
        }
        
        // Update status
        updateStatus('All favorites cleared', 'info');
    } catch (error) {
        console.error('Error clearing favorites:', error);
        updateStatus('Error clearing favorites', 'error');
    }
}

// Wait for DOM to be fully loaded before initializing UI
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initOfflineDetection();
    initFavoritesView();
    initSearchUI();
});

// Search mode functions
function showSearchMode(show = true) {
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const artworkContainer = document.getElementById('artworkContainer');
    const artworkInfo = document.getElementById('artworkInfo');
    
    if (show) {
        // Show search results, hide artwork display
        if (searchResultsContainer) searchResultsContainer.style.display = 'block';
        if (artworkContainer) artworkContainer.style.display = 'none';
        if (artworkInfo) artworkInfo.style.display = 'none';
    } else {
        // Hide search results, show artwork display
        if (searchResultsContainer) searchResultsContainer.style.display = 'none';
        if (artworkContainer) artworkContainer.style.display = 'flex';
        if (artworkInfo) artworkInfo.style.display = 'block';
    }
}

// Trigger search from UI
function triggerSearch(query, searchType = 'quick') {
    if (!query || !window.MetSearch) return;
    
    // Get current filters
    const filters = window.MetFilters ? window.MetFilters.getCurrentFilters() : {};
    
    // Show search mode
    showSearchMode(true);
    
    // Perform search with type
    window.MetSearch.performSearch(query, filters, searchType);
}

// Clear search from UI
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    showSearchMode(false);
    
    if (window.MetSearch) {
        window.MetSearch.clearSearch();
    }
}

// Show search loading state
function showSearchLoading() {
    const searchResultsGrid = document.getElementById('searchResultsGrid');
    if (searchResultsGrid) {
        searchResultsGrid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p class="loading-text">Searching...</p></div>';
    }
    updateStatus('Searching...', 'loading');
}

// Show search results
function showSearchResults(count, query) {
    const searchResultsCount = document.getElementById('searchResultsCount');
    if (searchResultsCount) {
        searchResultsCount.textContent = count === 0 ? 'No results' : 
                                        count === 1 ? `1 result for "${query}"` : 
                                        `${count} results for "${query}"`;
    }
    updateStatus(`Found ${count} results`, 'success');
}

// Show empty search state
function showSearchEmpty(query) {
    const searchResultsGrid = document.getElementById('searchResultsGrid');
    if (searchResultsGrid) {
        searchResultsGrid.innerHTML = `
            <div class="search-empty">
                <i class="fas fa-search"></i>
                <p>No results found for "${query}"</p>
                <p>Try different keywords or adjust your filters</p>
            </div>
        `;
    }
    
    const searchResultsCount = document.getElementById('searchResultsCount');
    if (searchResultsCount) {
        searchResultsCount.textContent = `No results for "${query}"`;
    }
    
    updateStatus('No results found', 'info');
}

// Show search error
function showSearchError() {
    const searchResultsGrid = document.getElementById('searchResultsGrid');
    if (searchResultsGrid) {
        searchResultsGrid.innerHTML = `
            <div class="error-message">
                <p>Error performing search</p>
                <p>Please try again</p>
            </div>
        `;
    }
    updateStatus('Search error', 'error');
}

// Initialize search UI events
function initSearchUI() {
    // Close search button
    const closeSearchButton = document.getElementById('closeSearchButton');
    if (closeSearchButton) {
        closeSearchButton.addEventListener('click', () => {
            clearSearch();
        });
    }
    
    // Clear history button
    const clearHistoryButton = document.getElementById('clearHistoryButton');
    if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', () => {
            if (window.MetSearch) {
                window.MetSearch.clearSearchHistory();
            }
        });
    }
    
    // Initialize search results
    if (window.MetSearch) {
        window.MetSearch.initSearchResults();
        window.MetSearch.displaySearchHistory();
    }
}

// Make functions available globally
window.MetUI = {
    showLoading,
    updateLoadingMessage,
    hideLoading,
    showError,
    updateStatus,
    showConnectionStatus,
    showFavoritesModal,
    hideFavoritesModal,
    showSearchMode,
    triggerSearch,
    clearSearch,
    showSearchLoading,
    showSearchResults,
    showSearchEmpty,
    showSearchError
};