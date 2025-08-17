// UI related functions

// Initialize UI elements and event listeners
function initUI() {
    // Get references to DOM elements
    const toggleDrawerButton = document.getElementById('toggleDrawer');
    const controlsDrawer = document.getElementById('controlsDrawer');
    const contentArea = document.getElementById('contentArea');

    // FIXED: Add defensive checks for all DOM elements
    if (!controlsDrawer) {
        console.error('Controls drawer element not found');
        return;
    }

    // Check if mobile
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        initMobileUI();
    } else {
        // Desktop drawer toggle
        if (toggleDrawerButton) {
            const toggleHandler = () => {
                controlsDrawer.classList.toggle('collapsed');
                
                // Check if drawer is now collapsed
                const isCollapsed = controlsDrawer.classList.contains('collapsed');
                
                // Update the button icon
                const iconElement = toggleDrawerButton.querySelector('i');
                if (iconElement) {
                    if (isCollapsed) {
                        iconElement.classList.remove('fa-chevron-left');
                        iconElement.classList.add('fa-chevron-right');
                    } else {
                        iconElement.classList.remove('fa-chevron-right');
                        iconElement.classList.add('fa-chevron-left');
                    }
                }
            };
            
            // FIXED: Use EventManager for toggle button
            if (window.MetEventManager) {
                window.MetEventManager.addEventListener(toggleDrawerButton, 'click', toggleHandler);
            } else {
                toggleDrawerButton.addEventListener('click', toggleHandler);
            }
        } else {
            console.warn('Toggle drawer button not found');
        }
    }

    // Handle window resize for responsive behavior
    let wasMobile = isMobile;
    
    // FIXED: Debounced resize handler using EventManager
    const resizeHandler = window.MetUtils ? 
        window.MetUtils.debounce(() => {
            const isNowMobile = window.innerWidth <= 768;
            if (wasMobile !== isNowMobile) {
                wasMobile = isNowMobile;
                if (isNowMobile) {
                    initMobileUI();
                } else {
                    removeMobileUI();
                }
            }
        }, 250) :
        () => {
            const isNowMobile = window.innerWidth <= 768;
            if (wasMobile !== isNowMobile) {
                wasMobile = isNowMobile;
                if (isNowMobile) {
                    initMobileUI();
                } else {
                    removeMobileUI();
                }
            }
        };
    
    if (window.MetEventManager) {
        window.MetEventManager.addEventListener(window, 'resize', resizeHandler);
    } else {
        window.addEventListener('resize', resizeHandler);
    }
    
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
    
    // FIXED: Add defensive checks and use EventManager
    // Mobile menu button
    if (mobileMenuButton) {
        if (window.MetEventManager) {
            window.MetEventManager.addEventListener(mobileMenuButton, 'click', openMobileDrawer);
        } else {
            mobileMenuButton.addEventListener('click', openMobileDrawer);
        }
    } else {
        console.warn('Mobile menu button not found');
    }
    
    // Close drawer button
    if (closeDrawer) {
        if (window.MetEventManager) {
            window.MetEventManager.addEventListener(closeDrawer, 'click', closeMobileDrawer);
        } else {
            closeDrawer.addEventListener('click', closeMobileDrawer);
        }
    }
    
    // Overlay click
    if (mobileOverlay) {
        if (window.MetEventManager) {
            window.MetEventManager.addEventListener(mobileOverlay, 'click', closeMobileDrawer);
        } else {
            mobileOverlay.addEventListener('click', closeMobileDrawer);
        }
    }
    
    // Handle swipe down on drawer
    if (controlsDrawer) {
        initDrawerSwipe();
    }
    
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
    // FIXED: Enhanced cleanup with null checks and event manager
    const controlsDrawer = document.getElementById('controlsDrawer');
    const info = document.getElementById('artworkInfo');
    const container = document.getElementById('artworkContainer');
    
    // Use EventManager to clean up all handlers for these elements
    if (window.MetEventManager) {
        window.MetEventManager.cleanupElement(controlsDrawer);
        window.MetEventManager.cleanupElement(info);
        window.MetEventManager.cleanupElement(container);
        
        // Also cleanup mobile-specific elements
        const mobileMenuButton = document.getElementById('mobileMenuButton');
        const mobileOverlay = document.getElementById('mobileOverlay');
        const closeDrawer = document.getElementById('closeDrawer');
        
        window.MetEventManager.cleanupElement(mobileMenuButton);
        window.MetEventManager.cleanupElement(mobileOverlay);
        window.MetEventManager.cleanupElement(closeDrawer);
    }
    
    // Clean up manual handlers if they exist
    const handle = controlsDrawer?.querySelector('.mobile-drawer-handle');
    
    // Remove drawer swipe handlers
    if (handle && handle._swipeHandlers) {
        try {
            handle.removeEventListener('touchstart', handle._swipeHandlers.handleStart, { passive: true });
            handle.removeEventListener('touchmove', handle._swipeHandlers.handleMove, { passive: true });
            handle.removeEventListener('touchend', handle._swipeHandlers.handleEnd);
            handle.removeEventListener('mousedown', handle._swipeHandlers.handleStart);
            
            // Also remove document-level mouse handlers
            if (handle._swipeHandlers.handleMove) {
                document.removeEventListener('mousemove', handle._swipeHandlers.handleMove);
            }
            if (handle._swipeHandlers.handleEnd) {
                document.removeEventListener('mouseup', handle._swipeHandlers.handleEnd);
            }
        } catch (error) {
            console.error('Error removing drawer handlers:', error);
        }
        delete handle._swipeHandlers;
    }
    
    // Remove info swipe handlers
    if (info && info._swipeHandlers) {
        try {
            info.removeEventListener('touchstart', info._swipeHandlers.handleStart, { passive: true });
            info.removeEventListener('touchmove', info._swipeHandlers.handleMove, { passive: true });
            info.removeEventListener('touchend', info._swipeHandlers.handleEnd);
        } catch (error) {
            console.error('Error removing info handlers:', error);
        }
        delete info._swipeHandlers;
    }
    
    // Remove container swipe handlers
    if (container && container._swipeHandlers) {
        try {
            container.removeEventListener('touchstart', container._swipeHandlers.handleTouchStart, { passive: true });
            container.removeEventListener('touchmove', container._swipeHandlers.handleTouchMove, { passive: true });
            container.removeEventListener('touchend', container._swipeHandlers.handleTouchEnd, { passive: true });
        } catch (error) {
            console.error('Error removing container handlers:', error);
        }
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
    const handle = drawer?.querySelector('.mobile-drawer-handle');
    
    // FIXED: Add null checks and proper cleanup tracking
    if (!drawer || !handle) {
        console.warn('Drawer elements not found for swipe initialization');
        return;
    }
    
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
    
    // Store handlers for cleanup
    handle._swipeHandlers = {
        handleStart,
        handleMove,
        handleEnd
    };
    
    // FIXED: Use EventManager for automatic cleanup tracking
    if (window.MetEventManager) {
        // Touch events
        window.MetEventManager.addEventListener(handle, 'touchstart', handleStart, { passive: true });
        window.MetEventManager.addEventListener(handle, 'touchmove', handleMove, { passive: true });
        window.MetEventManager.addEventListener(handle, 'touchend', handleEnd);
        
        // Mouse events for testing
        window.MetEventManager.addEventListener(handle, 'mousedown', handleStart);
        window.MetEventManager.addEventListener(document, 'mousemove', handleMove);
        window.MetEventManager.addEventListener(document, 'mouseup', handleEnd);
    } else {
        // Fallback to regular event listeners
        handle.addEventListener('touchstart', handleStart, { passive: true });
        handle.addEventListener('touchmove', handleMove, { passive: true });
        handle.addEventListener('touchend', handleEnd);
        handle.addEventListener('mousedown', handleStart);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
    }
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
    // FIXED: Check if status indicator already exists
    if (document.getElementById('statusIndicator')) {
        console.log('Status indicator already exists');
        return;
    }
    
    try {
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'statusIndicator';
        statusIndicator.className = 'status-indicator';
        statusIndicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Ready</span>';
        
        if (document.body) {
            document.body.appendChild(statusIndicator);
        } else {
            console.error('Document body not available for status indicator');
        }
    } catch (error) {
        console.error('Error creating status indicator:', error);
    }
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
    
    // FIXED: Update state manager
    if (window.MetState) {
        window.MetState.setState('app.loading', true);
    }
    
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
    // FIXED: Update state manager
    if (window.MetState) {
        window.MetState.setState('app.loading', false);
    }
    
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
        // REMOVED: Filter functionality - retry without filters
        // const filters = window.MetFilters ? window.MetFilters.getCurrentFilters() : {};
        
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
            
            // Get random artwork without filters
            setTimeout(async () => {
                const artwork = await window.MetAPI.getRandomArtwork({});
                
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
                // REMOVED: Filter reset code - no longer needed
                /*
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
                */
                
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

// FIXED: Add state management for modal operations
let favoritesModalState = {
    isOpen: false,
    isLoading: false,
    isClearing: false
};

// Initialize favorites view functionality
function initFavoritesView() {
    const viewFavoritesButton = document.getElementById('viewFavoritesButton');
    const favoritesModal = document.getElementById('favoritesModal');
    const closeFavoritesModal = document.getElementById('closeFavoritesModal');
    const clearFavoritesButton = document.getElementById('clearFavoritesButton');
    
    // FIXED: Add null checks for all elements
    if (!viewFavoritesButton || !favoritesModal) {
        console.warn('Favorites elements not found');
        return;
    }
    
    // FIXED: Debounced show modal function to prevent rapid clicks
    const debouncedShowModal = window.MetUtils ? 
        window.MetUtils.debounce(async () => {
            if (!favoritesModalState.isOpen && !favoritesModalState.isLoading) {
                await showFavoritesModal();
            }
        }, 300) : 
        async () => await showFavoritesModal();
    
    // View favorites button click handler
    if (window.MetEventManager) {
        window.MetEventManager.addEventListener(viewFavoritesButton, 'click', async (e) => {
            e.preventDefault();
            await debouncedShowModal();
        });
    } else {
        viewFavoritesButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await debouncedShowModal();
        });
    }
    
    // Close modal handler
    if (closeFavoritesModal) {
        const closeHandler = () => {
            if (!favoritesModalState.isLoading) {
                hideFavoritesModal();
            }
        };
        
        if (window.MetEventManager) {
            window.MetEventManager.addEventListener(closeFavoritesModal, 'click', closeHandler);
        } else {
            closeFavoritesModal.addEventListener('click', closeHandler);
        }
    }
    
    // Close modal on background click
    const backgroundClickHandler = (e) => {
        if (e.target === favoritesModal && !favoritesModalState.isLoading) {
            hideFavoritesModal();
        }
    };
    
    if (window.MetEventManager) {
        window.MetEventManager.addEventListener(favoritesModal, 'click', backgroundClickHandler);
    } else {
        favoritesModal.addEventListener('click', backgroundClickHandler);
    }
    
    // Clear all favorites handler with debouncing
    if (clearFavoritesButton) {
        const clearHandler = window.MetUtils ? 
            window.MetUtils.debounce(async () => {
                if (!favoritesModalState.isClearing) {
                    if (confirm('Are you sure you want to clear all favorites? This cannot be undone.')) {
                        await clearAllFavorites();
                    }
                }
            }, 500) :
            async () => {
                if (!favoritesModalState.isClearing && confirm('Are you sure you want to clear all favorites? This cannot be undone.')) {
                    await clearAllFavorites();
                }
            };
        
        if (window.MetEventManager) {
            window.MetEventManager.addEventListener(clearFavoritesButton, 'click', clearHandler);
        } else {
            clearFavoritesButton.addEventListener('click', clearHandler);
        }
    }
    
    // Close modal on Escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape' && favoritesModalState.isOpen && !favoritesModalState.isLoading) {
            hideFavoritesModal();
        }
    };
    
    if (window.MetEventManager) {
        window.MetEventManager.addEventListener(document, 'keydown', escapeHandler);
    } else {
        document.addEventListener('keydown', escapeHandler);
    }
}

// Show favorites modal
async function showFavoritesModal() {
    // FIXED: Check modal state to prevent multiple opens
    if (favoritesModalState.isOpen || favoritesModalState.isLoading) {
        console.log('Favorites modal already open or loading');
        return;
    }
    
    const favoritesModal = document.getElementById('favoritesModal');
    const favoritesGrid = document.getElementById('favoritesGrid');
    const favoritesCount = document.getElementById('favoritesCount');
    
    // FIXED: Add null checks
    if (!favoritesModal || !favoritesGrid || !window.MetFavorites) {
        console.error('Required favorites elements not found');
        return;
    }
    
    // Update state
    favoritesModalState.isOpen = true;
    favoritesModalState.isLoading = true;
    
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
                // FIXED: Use EventManager for click handlers
                const clickHandler = async () => {
                    const objectID = item.dataset.objectId;
                    await displayFavoriteFromModal(objectID);
                };
                
                if (window.MetEventManager) {
                    window.MetEventManager.addEventListener(item, 'click', clickHandler);
                } else {
                    item.addEventListener('click', clickHandler);
                }
            });
        }
        
        // Update state - loading complete
        favoritesModalState.isLoading = false;
    } catch (error) {
        console.error('Error loading favorites:', error);
        favoritesGrid.innerHTML = `
            <div class="error-message">
                <p>Error loading favorites</p>
                <p class="error-details">${error.message || 'Please try again'}</p>
            </div>
        `;
        
        // Update state - loading failed
        favoritesModalState.isLoading = false;
    }
}

// Hide favorites modal
function hideFavoritesModal() {
    // FIXED: Check state before closing
    if (!favoritesModalState.isOpen) {
        return;
    }
    
    const favoritesModal = document.getElementById('favoritesModal');
    if (favoritesModal) {
        favoritesModal.classList.remove('show');
        
        // Clean up event handlers for favorite items
        if (window.MetEventManager) {
            const favoritesGrid = document.getElementById('favoritesGrid');
            if (favoritesGrid) {
                const items = favoritesGrid.querySelectorAll('.favorite-item');
                items.forEach(item => window.MetEventManager.cleanupElement(item));
            }
        }
    }
    
    // Update state
    favoritesModalState.isOpen = false;
    favoritesModalState.isLoading = false;
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
    // FIXED: Check state to prevent concurrent operations
    if (favoritesModalState.isClearing || !window.MetFavorites) {
        return;
    }
    
    // Update state
    favoritesModalState.isClearing = true;
    
    // Disable clear button while clearing
    const clearButton = document.getElementById('clearFavoritesButton');
    if (clearButton) {
        clearButton.disabled = true;
        clearButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';
    }
    
    try {
        await window.MetFavorites.clearAllFavorites();
        
        // Update the modal if it's open
        if (favoritesModalState.isOpen) {
            // Refresh the modal content
            const favoritesGrid = document.getElementById('favoritesGrid');
            const favoritesCount = document.getElementById('favoritesCount');
            
            if (favoritesGrid) {
                favoritesGrid.innerHTML = `
                    <div class="favorites-empty">
                        <i class="fas fa-heart-broken"></i>
                        <p>All favorites have been cleared</p>
                    </div>
                `;
            }
            
            if (favoritesCount) {
                favoritesCount.textContent = 'No favorites';
            }
        }
        
        // Update status
        updateStatus('All favorites cleared', 'info');
    } catch (error) {
        console.error('Error clearing favorites:', error);
        updateStatus('Error clearing favorites', 'error');
    } finally {
        // Reset state and button
        favoritesModalState.isClearing = false;
        
        if (clearButton) {
            clearButton.disabled = false;
            clearButton.innerHTML = '<i class="fas fa-trash"></i> Clear All';
        }
    }
}

// FIXED: Removed DOMContentLoaded listener - initialization now handled by init.js
// The init.js module will call these functions in the proper order

// REMOVED: Search mode functions
/*
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
*/

// REMOVED: Search trigger function
/*
function triggerSearch(query, searchType = 'quick') {
    if (!query || !window.MetSearch) return;
    
    // Get current filters
    const filters = window.MetFilters ? window.MetFilters.getCurrentFilters() : {};
    
    // FIXED: Ensure filters are properly passed to search
    // For advanced search, the query might be in the title field
    if (searchType === 'advanced' && filters.title) {
        filters.searchQuery = filters.title;
    } else if (query !== '*') {
        filters.searchQuery = query;
    }
    
    // Show search mode
    showSearchMode(true);
    
    // Perform search with type
    window.MetSearch.performSearch(query, filters, searchType);
}
*/

// REMOVED: Clear search function
/*
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    showSearchMode(false);
    
    if (window.MetSearch) {
        window.MetSearch.clearSearch();
    }
}
*/

// REMOVED: Search loading state
/*
function showSearchLoading() {
    const searchResultsGrid = document.getElementById('searchResultsGrid');
    if (searchResultsGrid) {
        searchResultsGrid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p class="loading-text">Searching...</p></div>';
    }
    updateStatus('Searching...', 'loading');
}
*/

// REMOVED: Show search results
/*
function showSearchResults(count, query) {
    const searchResultsCount = document.getElementById('searchResultsCount');
    if (searchResultsCount) {
        searchResultsCount.textContent = count === 0 ? 'No results' : 
                                        count === 1 ? `1 result for "${query}"` : 
                                        `${count} results for "${query}"`;
    }
    updateStatus(`Found ${count} results`, 'success');
}
*/

// REMOVED: Empty search state
/*
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
*/

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

// REMOVED: Search UI initialization
/*
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
*/

// Make functions available globally
window.MetUI = {
    showLoading,
    updateLoadingMessage,
    hideLoading,
    showError,
    updateStatus,
    showConnectionStatus,
    showFavoritesModal,
    hideFavoritesModal
    // REMOVED: Search functions
    // showSearchMode,
    // triggerSearch,
    // clearSearch,
    // showSearchLoading,
    // showSearchResults,
    // showSearchEmpty,
    // showSearchError
};

// FIXED: Also expose initialization functions globally for init.js
window.initUI = initUI;
window.initOfflineDetection = initOfflineDetection;
window.initFavoritesView = initFavoritesView;
// REMOVED: window.initSearchUI = initSearchUI;