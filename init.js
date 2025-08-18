// init.js - Simple initialization for Met Museum app
// Loads modules in sequence without complex state checking

(function() {
    'use strict';
    
    // Simple initialization function
    async function initialize() {
        try {
            window.MetLogger?.log('Starting app initialization...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Initialize modules in order
            // 1. Initialize favorites database
            if (window.MetFavorites?.initFavoritesDB) {
                await window.MetFavorites.initFavoritesDB();
                window.MetLogger?.log('Favorites database initialized');
            }
            
            // 2. Initialize UI
            if (window.MetUI?.initUI) {
                window.MetUI.initUI();
                window.MetLogger?.log('UI initialized');
            }
            
            // 3. Register service worker
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.register('./service-worker.js');
                    window.MetLogger?.log('Service Worker registered:', registration.scope);
                    
                    // Listen for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                window.MetUI?.updateStatus?.('App update available - refresh to update', 'info');
                            }
                        });
                    });
                } catch (error) {
                    window.MetLogger?.error('Service Worker registration failed:', error);
                }
            }
            
            // 4. Test API connection
            if (window.MetAPI?.testConnection) {
                try {
                    window.MetUI?.showLoading?.();
                    window.MetUI?.updateLoadingMessage?.('Connecting to Met Museum API...');
                    
                    const connected = await window.MetAPI.testConnection();
                    
                    if (connected) {
                        window.MetLogger?.log('Connected to Met API successfully');
                        window.MetUI?.updateStatus?.('Connected to Met API', 'success');
                    } else {
                        throw new Error('Failed to connect to Met API');
                    }
                    
                    window.MetUI?.hideLoading?.();
                } catch (error) {
                    window.MetLogger?.error('API connection failed:', error);
                    window.MetUI?.hideLoading?.();
                    window.MetUI?.showError?.('Unable to connect to the Met Museum API. Please check your connection.');
                }
            }
            
            // 5. Test proxy health in background
            if (window.MetAPI?.testProxyHealth) {
                window.MetAPI.testProxyHealth().catch(err => {
                    window.MetLogger?.warn('Proxy health check failed:', err);
                });
            }
            
            // 6. Check for PWA launch with action
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('action') === 'random') {
                window.MetLogger?.log('Auto-loading random artwork from PWA');
                setTimeout(() => {
                    document.getElementById('randomArtButton')?.click();
                }, 1000);
            }
            
            window.MetLogger?.log('App initialization complete');
            
        } catch (error) {
            window.MetLogger?.error('App initialization failed:', error);
            window.MetUI?.showError?.('Application failed to initialize. Please refresh the page.');
        }
    }
    
    // Start initialization
    initialize();
    
})();