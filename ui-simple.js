// ui-simple.js - Simplified UI functionality

(function() {
    'use strict';
    
    // UI state
    let favoritesModalOpen = false;
    
    // Initialize UI
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
                if (confirm('Are you sure you want to clear all favorites?')) {
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
    
    // Show favorites modal
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
                // Display favorites
                grid.innerHTML = favorites.map(fav => `
                    <div class="favorite-item" data-object-id="${fav.objectID}">
                        ${fav.thumbnail ? 
                            `<img src="${fav.thumbnail}" alt="${fav.title}" class="favorite-item-image">` :
                            `<div class="favorite-item-placeholder"><i class="fas fa-image"></i></div>`
                        }
                        <div class="favorite-item-info">
                            <div class="favorite-item-title">${fav.title || 'Untitled'}</div>
                            <div class="favorite-item-artist">${fav.artistDisplayName || 'Unknown'}</div>
                        </div>
                    </div>
                `).join('');
                
                // Add click handlers
                grid.querySelectorAll('.favorite-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        const objectId = item.dataset.objectId;
                        const favorite = await window.MetFavorites.getFavorite(objectId);
                        if (favorite) {
                            hideFavoritesModal();
                            window.MetArtwork?.displayArtwork(favorite);
                        }
                    });
                });
            }
        } catch (error) {
            window.MetLogger?.error('Error loading favorites:', error);
            grid.innerHTML = '<div class="error-message">Error loading favorites</div>';
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
    
    // Update status
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
    
    // Show loading
    function showLoading() {
        const container = document.getElementById('artworkContainer');
        if (!container) return;
        
        let loading = container.querySelector('.loading');
        if (!loading) {
            loading = document.createElement('div');
            loading.className = 'loading';
            loading.innerHTML = '<div class="loading-spinner"></div><p class="loading-text">Loading...</p>';
            container.appendChild(loading);
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
    
    // Show error
    function showError(message) {
        const container = document.getElementById('artworkContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="error-message">
                <p>${message}</p>
                <button class="retry-button" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Reload Page
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
    function updateOnlineStatus(isOnline) {
        if (isOnline) {
            updateStatus('Back online', 'success');
            setTimeout(() => {
                const indicator = document.getElementById('statusIndicator');
                if (indicator) indicator.style.opacity = '0';
            }, 3000);
        } else {
            updateStatus('Offline - Limited functionality', 'warning');
            const indicator = document.getElementById('statusIndicator');
            if (indicator) indicator.style.opacity = '1';
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