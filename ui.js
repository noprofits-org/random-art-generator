// ui.js - Simplified UI module for Met Museum app
// Core features: loading states, error handling, favorites modal, status messages

(function() {
    'use strict';
    
    // UI state
    let favoritesModalOpen = false;
    
    /**
     * Initializes all UI components and event listeners
     * @returns {void}
     */
    function initUI() {
        // Initialize buttons
        initButtons();
        
        // Initialize favorites modal
        initFavoritesModal();
        
        // Initialize offline detection
        initOfflineDetection();
        
        // Add status indicator
        addStatusIndicator();
        
        window.MetLogger?.log('UI initialized');
    }
    
    // Initialize main buttons
    function initButtons() {
        // Random art button
        const randomButton = document.getElementById('randomArtButton');
        if (randomButton) {
            randomButton.addEventListener('click', async () => {
                if (window.MetAPI) {
                    const artwork = await window.MetAPI.getRandomArtwork();
                    if (artwork && window.MetArtwork) {
                        window.MetArtwork.displayArtwork(artwork);
                    }
                }
            });
        }
        
        // View favorites button
        const favoritesButton = document.getElementById('viewFavoritesButton');
        if (favoritesButton) {
            favoritesButton.addEventListener('click', () => {
                showFavoritesModal();
            });
        }
    }
    
    // Initialize favorites modal
    function initFavoritesModal() {
        const modal = document.getElementById('favoritesModal');
        const closeBtn = document.getElementById('closeFavoritesModal');
        const clearBtn = document.getElementById('clearFavoritesButton');
        
        if (!modal) return;
        
        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                hideFavoritesModal();
            });
        }
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideFavoritesModal();
            }
        });
        
        // Clear all button
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to clear all favorites? This cannot be undone.')) {
                    await clearAllFavorites();
                }
            });
        }
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && favoritesModalOpen) {
                hideFavoritesModal();
            }
        });
    }
    
    /**
     * Shows the favorites modal with lazy-loaded content
     * @returns {Promise<void>}
     */
    async function showFavoritesModal() {
        if (favoritesModalOpen || !window.MetFavorites) return;
        
        const modal = document.getElementById('favoritesModal');
        const grid = document.getElementById('favoritesGrid');
        const count = document.getElementById('favoritesCount');
        
        if (!modal || !grid) return;
        
        favoritesModalOpen = true;
        modal.classList.add('show');
        
        // Show loading
        grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        
        try {
            const favorites = await window.MetFavorites.getAllFavorites();
            
            // Update count
            if (count) {
                count.textContent = favorites.length === 0 ? 'No favorites' :
                                   favorites.length === 1 ? '1 favorite' :
                                   `${favorites.length} favorites`;
            }
            
            if (favorites.length === 0) {
                grid.innerHTML = `
                    <div class="favorites-empty">
                        <i class="fas fa-heart-broken"></i>
                        <p>You haven't added any favorites yet!</p>
                        <p>Click the heart icon on any artwork to save it here.</p>
                    </div>
                `;
            } else {
                // Create skeleton loaders first
                grid.innerHTML = favorites.map(() => `
                    <div class="favorite-item skeleton-loader">
                        <div class="skeleton-image"></div>
                        <div class="favorite-item-info">
                            <div class="skeleton-text skeleton-title"></div>
                            <div class="skeleton-text skeleton-artist"></div>
                        </div>
                    </div>
                `).join('');
                
                // Set up intersection observer for lazy loading
                const imageObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const item = entry.target;
                            const index = parseInt(item.dataset.index);
                            const fav = favorites[index];
                            
                            // Replace skeleton with actual content
                            item.classList.remove('skeleton-loader');
                            item.innerHTML = `
                                ${fav.thumbnail ? 
                                    `<img src="${fav.thumbnail}" alt="${fav.title}" class="favorite-item-image lazy-load" data-loaded="false">` :
                                    `<div class="favorite-item-placeholder"><i class="fas fa-image"></i></div>`
                                }
                                <div class="favorite-item-info">
                                    <div class="favorite-item-title">${fav.title || 'Untitled'}</div>
                                    <div class="favorite-item-artist">${fav.artistDisplayName || 'Unknown Artist'}</div>
                                </div>
                            `;
                            
                            // Handle image loading with fade-in effect
                            const img = item.querySelector('.favorite-item-image');
                            if (img) {
                                img.onload = () => {
                                    img.classList.add('loaded');
                                    img.dataset.loaded = 'true';
                                };
                                
                                // If image fails, show placeholder
                                img.onerror = () => {
                                    const placeholder = document.createElement('div');
                                    placeholder.className = 'favorite-item-placeholder';
                                    placeholder.innerHTML = '<i class="fas fa-image"></i>';
                                    img.replaceWith(placeholder);
                                };
                            }
                            
                            // Add click handler
                            item.addEventListener('click', async () => {
                                await displayFavoriteFromModal(fav.objectID);
                            });
                            
                            imageObserver.unobserve(item);
                        }
                    });
                }, {
                    rootMargin: '50px',
                    threshold: 0.01
                });
                
                // Observe all items
                grid.querySelectorAll('.favorite-item').forEach((item, index) => {
                    item.dataset.index = index;
                    item.dataset.objectId = favorites[index].objectID;
                    imageObserver.observe(item);
                });
            }
        } catch (error) {
            window.MetLogger?.error('Error loading favorites:', error);
            grid.innerHTML = `
                <div class="error-message">
                    <p>Error loading favorites</p>
                    <p class="error-details">${error.message || 'Please try again'}</p>
                </div>
            `;
        }
    }
    
    /**
     * Loads and displays a favorite artwork from the modal
     * @param {string} objectId - The Met Museum object ID
     * @returns {Promise<void>}
     */
    async function displayFavoriteFromModal(objectId) {
        if (!window.MetFavorites || !window.MetArtwork) return;
        
        try {
            const favorite = await window.MetFavorites.getFavorite(objectId);
            if (favorite) {
                // Close the modal
                hideFavoritesModal();
                
                // Display the artwork
                window.MetArtwork.displayArtwork(favorite);
                
                // Update status
                updateStatus('Loaded from favorites', 'success');
            }
        } catch (error) {
            window.MetLogger?.error('Error displaying favorite:', error);
            updateStatus('Error loading favorite', 'error');
        }
    }
    
    // Hide favorites modal
    function hideFavoritesModal() {
        const modal = document.getElementById('favoritesModal');
        if (modal) {
            modal.classList.remove('show');
            favoritesModalOpen = false;
        }
    }
    
    // Clear all favorites
    async function clearAllFavorites() {
        if (!window.MetFavorites) return;
        
        const clearBtn = document.getElementById('clearFavoritesButton');
        if (clearBtn) {
            clearBtn.disabled = true;
            clearBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';
        }
        
        try {
            await window.MetFavorites.clearAllFavorites();
            
            // Update modal
            const grid = document.getElementById('favoritesGrid');
            const count = document.getElementById('favoritesCount');
            
            if (grid) {
                grid.innerHTML = `
                    <div class="favorites-empty">
                        <i class="fas fa-heart-broken"></i>
                        <p>All favorites have been cleared</p>
                    </div>
                `;
            }
            
            if (count) {
                count.textContent = 'No favorites';
            }
            
            updateStatus('All favorites cleared', 'info');
        } catch (error) {
            window.MetLogger?.error('Error clearing favorites:', error);
            updateStatus('Error clearing favorites', 'error');
        } finally {
            if (clearBtn) {
                clearBtn.disabled = false;
                clearBtn.innerHTML = '<i class="fas fa-trash"></i> Clear All';
            }
        }
    }
    
    // Add status indicator
    function addStatusIndicator() {
        if (document.getElementById('statusIndicator')) return;
        
        const indicator = document.createElement('div');
        indicator.id = 'statusIndicator';
        indicator.className = 'status-indicator';
        indicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Ready</span>';
        document.body.appendChild(indicator);
    }
    
    /**
     * Updates the status indicator with a message
     * @param {string} message - The status message to display
     * @param {string} [type='info'] - Status type: 'info', 'loading', 'error', 'success', 'warning'
     * @returns {void}
     */
    function updateStatus(message, type = 'info') {
        const indicator = document.getElementById('statusIndicator');
        if (!indicator) return;
        
        const text = indicator.querySelector('.status-text');
        if (text) text.textContent = message;
        
        indicator.className = `status-indicator ${type}`;
        indicator.style.opacity = '1';
        
        // Auto-hide info messages
        if (type === 'info') {
            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 5000);
        }
    }
    
    /**
     * Shows the loading indicator overlay
     * @returns {void}
     */
    function showLoading() {
        const container = document.getElementById('artworkContainer');
        if (!container) return;
        
        let loading = container.querySelector('.loading');
        if (!loading) {
            loading = document.createElement('div');
            loading.className = 'loading';
            loading.innerHTML = '<div class="loading-spinner"></div><p class="loading-text">Fetching artwork...</p>';
            container.appendChild(loading);
        } else {
            const loadingText = loading.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = 'Fetching artwork...';
            }
        }
        
        loading.style.display = 'flex';
        updateStatus('Loading...', 'loading');
    }
    
    // Update loading message
    function updateLoadingMessage(message) {
        const loading = document.querySelector('.loading-text');
        if (loading) {
            loading.textContent = message;
        }
        updateStatus(message, 'loading');
    }
    
    // Hide loading
    function hideLoading() {
        const loading = document.querySelector('.loading');
        if (loading) {
            loading.style.display = 'none';
        }
        updateStatus('Ready', 'info');
    }
    
    /**
     * Displays an error message with retry button
     * @param {string} message - The error message to display
     * @returns {void}
     */
    function showError(message) {
        const container = document.getElementById('artworkContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="error-message">
                <p>${message}</p>
                <button class="retry-button" onclick="if(window.MetAPI){window.MetAPI.getRandomArtwork().then(a=>{if(a&&window.MetArtwork)window.MetArtwork.displayArtwork(a)})}">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
        
        updateStatus(message, 'error');
    }
    
    // Initialize offline detection
    function initOfflineDetection() {
        // Check initial status
        updateOnlineStatus(navigator.onLine);
        
        // Listen for changes
        window.addEventListener('online', () => updateOnlineStatus(true));
        window.addEventListener('offline', () => updateOnlineStatus(false));
    }
    
    // Update online status
    async function updateOnlineStatus(isOnline) {
        if (isOnline) {
            updateStatus('Back online', 'success');
            setTimeout(() => {
                const indicator = document.getElementById('statusIndicator');
                if (indicator && indicator.querySelector('.status-text').textContent === 'Back online') {
                    indicator.style.opacity = '0';
                }
            }, 3000);
        } else {
            // Check for cached artworks
            let cacheInfo = { cachedArtworks: 0 };
            if (window.MetAPI?.getCachedArtworks) {
                const cached = await window.MetAPI.getCachedArtworks();
                cacheInfo.cachedArtworks = cached.length;
            }
            
            if (cacheInfo.cachedArtworks > 0) {
                updateStatus(`Offline - ${cacheInfo.cachedArtworks} artworks available`, 'warning');
                addOfflineCollectionButton();
            } else {
                updateStatus('Offline - no cached content', 'warning');
            }
            
            const indicator = document.getElementById('statusIndicator');
            if (indicator) indicator.style.opacity = '1';
        }
    }
    
    // Add offline collection button to status indicator
    function addOfflineCollectionButton() {
        const indicator = document.getElementById('statusIndicator');
        if (!indicator || indicator.querySelector('.offline-collection-btn')) return;
        
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
        indicator.appendChild(button);
    }
    
    // Show offline collection
    async function showOfflineCollection() {
        if (!window.MetAPI) return;
        
        showLoading();
        updateLoadingMessage('Loading offline collection...');
        
        try {
            const artwork = await window.MetAPI.getRandomArtwork();
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
    
    // Public API
    window.MetUI = {
        initUI,
        showLoading,
        updateLoadingMessage,
        hideLoading,
        showError,
        updateStatus,
        showFavoritesModal,
        hideFavoritesModal
    };
    
})();