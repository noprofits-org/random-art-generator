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
    RETRY_DELAY: 1000
};

// Make configuration available globally
window.MetConfig = CONFIG;