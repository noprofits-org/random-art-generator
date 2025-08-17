// init-simple.js - Simplified initialization for core functionality only
// Focuses on: random artwork display, favorites, and basic offline support

(function() {
    'use strict';
    
    let initialized = false;
    
    // Simple sequential initialization
    async function initializeApp() {
        if (initialized) return;
        
        try {
            window.MetLogger?.log('[Init] Starting simplified app initialization...');
            
            // 1. Initialize core API functionality
            if (window.MetAPI && window.MetAPI.testAPIConnection) {
                await window.MetAPI.testAPIConnection();
                window.MetLogger?.log('[Init] API connection verified');
            }
            
            // 2. Initialize favorites database
            if (window.MetFavorites && window.MetFavorites.initFavoritesDB) {
                await window.MetFavorites.initFavoritesDB();
                window.MetLogger?.log('[Init] Favorites database ready');
            }
            
            // 3. Initialize basic UI
            if (window.initUI) {
                window.initUI();
                window.MetLogger?.log('[Init] UI initialized');
            }
            
            // 4. Setup offline detection
            if (window.initOfflineDetection) {
                window.initOfflineDetection();
                window.MetLogger?.log('[Init] Offline detection ready');
            }
            
            // 5. Setup favorites view
            if (window.initFavoritesView) {
                window.initFavoritesView();
                window.MetLogger?.log('[Init] Favorites view ready');
            }
            
            // 6. Register service worker for offline support
            if ('serviceWorker' in navigator) {
                try {
                    await navigator.serviceWorker.register('./service-worker.js');
                    window.MetLogger?.log('[Init] Service Worker registered');
                } catch (error) {
                    window.MetLogger?.error('[Init] Service Worker registration failed:', error);
                }
            }
            
            // 7. Setup main button handlers
            setupMainButtons();
            
            // 8. Check for PWA launch
            checkPWALaunch();
            
            initialized = true;
            window.MetLogger?.log('[Init] App initialization complete');
            
        } catch (error) {
            console.error('Failed to initialize app:', error.message);
            showInitError();
        }
    }
    
    // Setup handlers for main buttons
    function setupMainButtons() {
        // Random artwork button
        const randomButton = document.getElementById('randomArtButton');
        if (randomButton && window.MetEventManager) {
            window.MetEventManager.addEventListener(randomButton, 'click', async () => {
                window.MetLogger?.log('[Init] Random artwork button clicked');
                
                if (window.MetAPI && window.MetAPI.getRandomArtwork) {
                    const artwork = await window.MetAPI.getRandomArtwork();
                    if (artwork && window.MetArtwork) {
                        window.MetArtwork.displayArtwork(artwork);
                    }
                }
            });
        }
        
        // View favorites button
        const favButton = document.getElementById('viewFavoritesButton');
        if (favButton && window.MetEventManager) {
            window.MetEventManager.addEventListener(favButton, 'click', () => {
                window.MetLogger?.log('[Init] View favorites button clicked');
                if (window.MetUI && window.MetUI.showFavoritesModal) {
                    window.MetUI.showFavoritesModal();
                }
            });
        }
    }
    
    // Check if launched from PWA shortcut
    function checkPWALaunch() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'random') {
            window.MetLogger?.log('[Init] Auto-loading random artwork from PWA');
            setTimeout(() => {
                const randomButton = document.getElementById('randomArtButton');
                if (randomButton) randomButton.click();
            }, 500);
        }
    }
    
    // Show initialization error
    function showInitError() {
        const container = document.getElementById('artworkContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <p>Unable to initialize the application</p>
                    <p>Please check your internet connection and refresh the page</p>
                    <button onclick="location.reload()" class="primary-button">Refresh</button>
                </div>
            `;
        }
    }
    
    // Simple cleanup function
    function cleanup() {
        window.MetLogger?.log('[Init] Cleaning up...');
        
        // Clean up UI
        if (window.MetUI && window.MetUI.destroy) {
            window.MetUI.destroy();
        }
        
        // Clean up event manager
        if (window.MetEventManager && window.MetEventManager.cleanup) {
            window.MetEventManager.cleanup();
        }
        
        // Clean up favorites
        if (window.MetFavorites && window.MetFavorites.cleanup) {
            window.MetFavorites.cleanup();
        }
        
        initialized = false;
        window.MetLogger?.log('[Init] Cleanup complete');
    }
    
    // Public API
    window.SimpleInit = {
        initialize: initializeApp,
        cleanup: cleanup,
        isReady: () => initialized
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
    
})();