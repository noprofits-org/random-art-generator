// init.js - Centralized initialization system
// FIXED: Created centralized initialization to ensure proper loading order

const MetInit = (() => {
    let initialized = false;
    let initPromise = null;
    const initCallbacks = [];
    const moduleStatus = {
        config: false,
        utils: false,
        api: false,
        favorites: false,
        artwork: false,
        ui: false,
        filters: false,
        search: false
    };

    // Check if a module is ready
    function isModuleReady(moduleName) {
        switch(moduleName) {
            case 'config': return typeof window.MetConfig !== 'undefined';
            case 'utils': return typeof window.MetUtils !== 'undefined';
            case 'api': return typeof window.MetAPI !== 'undefined';
            case 'favorites': return typeof window.MetFavorites !== 'undefined';
            case 'artwork': return typeof window.MetArtwork !== 'undefined';
            case 'ui': return typeof window.MetUI !== 'undefined';
            case 'filters': return typeof window.MetFilters !== 'undefined';
            case 'search': return typeof window.MetSearch !== 'undefined';
            default: return false;
        }
    }

    // Wait for specific modules to be ready
    async function waitForModules(moduleNames) {
        const checkInterval = 50; // Check every 50ms
        const maxWait = 5000; // Maximum 5 seconds wait
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const checkModules = () => {
                const allReady = moduleNames.every(name => isModuleReady(name));
                
                if (allReady) {
                    moduleNames.forEach(name => moduleStatus[name] = true);
                    resolve();
                } else if (Date.now() - startTime > maxWait) {
                    const missingModules = moduleNames.filter(name => !isModuleReady(name));
                    reject(new Error(`Timeout waiting for modules: ${missingModules.join(', ')}`));
                } else {
                    setTimeout(checkModules, checkInterval);
                }
            };
            
            checkModules();
        });
    }

    // Initialize the application
    async function initialize() {
        if (initialized) {
            console.log('[Init] Already initialized');
            return;
        }

        if (initPromise) {
            console.log('[Init] Initialization already in progress');
            return initPromise;
        }

        initPromise = performInitialization();
        return initPromise;
    }

    async function performInitialization() {
        try {
            console.log('[Init] Starting application initialization...');

            // Phase 1: Wait for core utilities
            console.log('[Init] Phase 1: Loading core utilities...');
            await waitForModules(['config', 'utils']);

            // Phase 2: Wait for API and data modules
            console.log('[Init] Phase 2: Loading API and data modules...');
            await waitForModules(['api', 'favorites']);

            // Phase 3: Wait for UI modules
            console.log('[Init] Phase 3: Loading UI modules...');
            await waitForModules(['artwork', 'ui', 'filters', 'search']);

            // Phase 4: Initialize modules in order
            console.log('[Init] Phase 4: Initializing modules...');
            
            // Initialize favorites DB first
            if (window.MetFavorites && window.MetFavorites.initFavoritesDB) {
                await window.MetFavorites.initFavoritesDB();
                console.log('[Init] Favorites database initialized');
            }

            // Initialize UI (includes offline detection)
            if (window.initUI) {
                window.initUI();
                console.log('[Init] UI initialized');
            }

            // Initialize offline detection
            if (window.initOfflineDetection) {
                window.initOfflineDetection();
                console.log('[Init] Offline detection initialized');
            }

            // Initialize favorites view
            if (window.initFavoritesView) {
                window.initFavoritesView();
                console.log('[Init] Favorites view initialized');
            }

            // Initialize search
            if (window.initSearchUI) {
                window.initSearchUI();
                console.log('[Init] Search UI initialized');
            }

            // Register service worker
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.register('./service-worker.js');
                    console.log('[Init] Service Worker registered:', registration.scope);
                    setupServiceWorkerHandlers(registration);
                } catch (error) {
                    console.error('[Init] Service Worker registration failed:', error);
                }
            }

            // FIXED: Test proxy health before API connection
            if (window.MetAPI && window.MetAPI.checkProxyHealthCached) {
                console.log('[Init] Checking proxy health...');
                try {
                    await window.MetAPI.checkProxyHealthCached();
                } catch (error) {
                    console.warn('[Init] Proxy health check failed:', error);
                }
            }
            
            // Test API connection
            await testAPIConnection();

            // Initialize filters after API is confirmed
            if (window.MetFilters && window.MetFilters.initFilters) {
                await window.MetFilters.initFilters();
                console.log('[Init] Filters initialized');
            }

            // Setup main event handlers
            setupEventHandlers();

            // Check for PWA launch parameters
            checkPWALaunch();

            initialized = true;
            console.log('[Init] Application initialization complete');

            // Run any queued callbacks
            initCallbacks.forEach(callback => callback());
            initCallbacks.length = 0;

        } catch (error) {
            console.error('[Init] Initialization failed:', error);
            if (window.MetUI && window.MetUI.showError) {
                window.MetUI.showError('Application failed to initialize properly. Please refresh the page.');
            }
            throw error;
        }
    }

    // Test API connection
    async function testAPIConnection() {
        if (!window.MetAPI) {
            throw new Error('MetAPI not available');
        }

        try {
            if (window.MetUI && window.MetUI.showLoading) {
                window.MetUI.showLoading();
                window.MetUI.updateLoadingMessage && window.MetUI.updateLoadingMessage('Connecting to Met API...');
            }

            const apiResult = await window.MetAPI.testApiConnection();

            if (apiResult) {
                console.log('[Init] Connected to Met API successfully!');
                if (window.MetUI) {
                    if (window.MetUI.showConnectionStatus) {
                        window.MetUI.showConnectionStatus(true);
                    } else if (window.MetUI.updateStatus) {
                        window.MetUI.updateStatus('Connected to Met API', 'success');
                    }
                }

                if (window.MetUI && window.MetUI.hideLoading) {
                    window.MetUI.hideLoading();
                }

                if (apiResult.departments && apiResult.departments.length > 0) {
                    console.log('[Init] Available departments:', apiResult.departments);
                }
            } else {
                throw new Error('Failed to connect to Met API');
            }
        } catch (error) {
            console.error('[Init] API connection failed:', error);
            if (window.MetUI) {
                if (window.MetUI.showConnectionStatus) {
                    window.MetUI.showConnectionStatus(false);
                } else if (window.MetUI.updateStatus) {
                    window.MetUI.updateStatus('Disconnected from Met API', 'error');
                }
                if (window.MetUI.hideLoading) {
                    window.MetUI.hideLoading();
                }
                if (window.MetUI.showError) {
                    window.MetUI.showError('Unable to connect to the Metropolitan Museum API. Please try again later.');
                }
            }
            throw error;
        }
    }

    // Setup service worker handlers
    function setupServiceWorkerHandlers(registration) {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[Init] Service Worker update found');
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[Init] New Service Worker installed, update available');
                    if (window.MetUI && window.MetUI.updateStatus) {
                        window.MetUI.updateStatus('App update available - refresh to update', 'info');
                    }
                }
            });
        });
    }

    // Setup main event handlers
    function setupEventHandlers() {
        const randomArtButton = document.getElementById('randomArtButton');
        if (randomArtButton) {
            randomArtButton.addEventListener('click', handleRandomArtwork);
        }

        // Keyboard shortcut for random artwork
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' &&
                document.activeElement.tagName !== 'INPUT' &&
                document.activeElement.tagName !== 'TEXTAREA' &&
                document.activeElement.tagName !== 'SELECT') {
                event.preventDefault();
                if (randomArtButton) {
                    randomArtButton.click();
                }
            }
        });
    }

    // Handle random artwork button click
    async function handleRandomArtwork() {
        console.log('[Init] Random artwork button clicked');

        const filters = window.MetFilters ? window.MetFilters.getCurrentFilters() : {};
        console.log('[Init] Current filters:', filters);

        if (window.MetAPI) {
            if (window.MetUI && window.MetUI.showLoading) {
                window.MetUI.showLoading();
                window.MetUI.updateLoadingMessage && 
                    window.MetUI.updateLoadingMessage('Finding the perfect artwork for you...');
            }

            setTimeout(async () => {
                try {
                    const artwork = await window.MetAPI.getRandomArtwork(filters);

                    if (artwork && window.MetArtwork) {
                        window.MetArtwork.displayArtwork(artwork);
                    }
                } catch (error) {
                    console.error('[Init] Error getting random artwork:', error);
                    if (window.MetUI) {
                        window.MetUI.hideLoading && window.MetUI.hideLoading();
                        window.MetUI.showError && window.MetUI.showError('Error fetching artwork: ' + error.message);
                    }
                }
            }, 500);
        }
    }

    // Check PWA launch parameters
    function checkPWALaunch() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        
        if (action === 'random') {
            console.log('[Init] Auto-loading random artwork from PWA shortcut');
            setTimeout(() => {
                const randomArtButton = document.getElementById('randomArtButton');
                if (randomArtButton) {
                    randomArtButton.click();
                }
            }, 1000);
        }
    }

    // Queue a callback to run after initialization
    function onReady(callback) {
        if (initialized) {
            callback();
        } else {
            initCallbacks.push(callback);
        }
    }

    // Public API
    return {
        initialize,
        onReady,
        isReady: () => initialized,
        getStatus: () => ({ initialized, moduleStatus })
    };
})();

// Make available globally
window.MetInit = MetInit;

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MetInit.initialize());
} else {
    // DOM already loaded
    MetInit.initialize();
}