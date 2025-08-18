// PRODUCTION BUILD: Console logging disabled except for errors
// config.js - Configuration settings for the Met Art Generator

// API configuration
const CONFIG = {
    // Met Museum API base URL
    MET_API_BASE_URL: 'https://collectionapi.metmuseum.org/public/collection/v1',
    
    // CORS Proxy URL
    CORS_PROXY_URL: 'https://cors-proxy-xi-ten.vercel.app/api/proxy',
    
    // Request timeout in milliseconds (15 seconds)
    REQUEST_TIMEOUT: 15000,
    
    // Maximum retries for API calls
    MAX_RETRIES: 3,
    
    // Delay between retries in milliseconds
    RETRY_DELAY: 1000,
    
    // Debug mode configuration (set to false for production)
    DEBUG_MODE: false,
    
    // Performance configuration
    SEARCH_RESULTS_PER_PAGE: 20,
    MAX_SEARCH_RESULTS: 200,
    IMAGE_LAZY_LOAD_OFFSET: '100px',
    
    // Cache configuration
    CACHE_VERSION: '1.3.0',
    MAX_CACHED_IMAGES: 100,
    MAX_CACHE_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
    CACHE_CLEANUP_INTERVAL: 60 * 60 * 1000  // 1 hour
};

// FIXED: Create debug logger wrapper
const MetLogger = {
    log: (...args) => {
        if (CONFIG.DEBUG_MODE) {
            console.log('[Met]', ...args);
        }
    },
    
    info: (...args) => {
        if (CONFIG.DEBUG_MODE) {
            console.info('[Met]', ...args);
        }
    },
    
    warn: (...args) => {
        if (CONFIG.DEBUG_MODE) {
            console.warn('[Met]', ...args);
        }
    },
    
    error: (...args) => {
        // Always show errors but sanitize for production
        const sanitizedArgs = args.map(arg => {
            if (arg instanceof Error) {
                return `Error: ${arg.message}`;
            }
            return arg;
        });
        console.error('[Met]', ...sanitizedArgs);
    },
    
    debug: (...args) => {
        if (CONFIG.DEBUG_MODE) {
            console.debug('[Met]', ...args);
        }
    },
    
    group: (label) => {
        if (CONFIG.DEBUG_MODE) {
            console.group(label);
        }
    },
    
    groupEnd: () => {
        if (CONFIG.DEBUG_MODE) {
            console.groupEnd();
        }
    },
    
    time: (label) => {
        if (CONFIG.DEBUG_MODE) {
            console.time(label);
        }
    },
    
    timeEnd: (label) => {
        if (CONFIG.DEBUG_MODE) {
            console.timeEnd(label);
        }
    }
};

// Make configuration and logger available globally
window.MetConfig = CONFIG;
window.MetLogger = MetLogger;