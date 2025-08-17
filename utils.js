// utils.js - Common utility functions

// Timing Utilities

function debounce(func, delay) {
    let timeoutId;
    const debounced = function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
    
    // Add cancel method
    debounced.cancel = function() {
        clearTimeout(timeoutId);
        timeoutId = null;
    };
    
    return debounced;
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Storage Utilities

function safeLocalStorageGet(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        window.MetLogger?.error(`Error reading from localStorage (${key}):`, error);
        return defaultValue;
    }
}

function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        window.MetLogger?.error(`Error writing to localStorage (${key}):`, error);
        return false;
    }
}

function safeLocalStorageRemove(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        window.MetLogger?.error(`Error removing from localStorage (${key}):`, error);
        return false;
    }
}

// Network Utilities

async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        jitterFactor = 0.3,
        shouldRetry = (error) => true
    } = options;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries || !shouldRetry(error)) {
                throw error;
            }
            
            const baseDelay = initialDelay * Math.pow(2, attempt);
            const jitter = Math.random() * jitterFactor * baseDelay;
            const delay = Math.min(baseDelay + jitter, maxDelay);
            
            window.MetLogger?.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
            await sleep(delay);
        }
    }
}

function isOnline() {
    return navigator.onLine;
}

function onNetworkStatusChange(callback) {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
    // Call immediately with current status
    callback(isOnline());
}

// Array Utilities

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// DOM Utilities

function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('data-')) {
            element.dataset[key.slice(5)] = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            element[key] = value;
        }
    });
    
    children.forEach(child => {
        if (typeof child === 'string' || typeof child === 'number') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Element) {
            element.appendChild(child);
        }
    });
    
    return element;
}

function isMobileDevice() {
    return window.innerWidth <= 768;
}

function getDeviceType() {
    const width = window.innerWidth;
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
}

function onDeviceChange(callback) {
    let currentDevice = getDeviceType();
    const checkDevice = () => {
        const newDevice = getDeviceType();
        if (newDevice !== currentDevice) {
            const oldDevice = currentDevice;
            currentDevice = newDevice;
            callback(newDevice, oldDevice);
        }
    };
    
    window.addEventListener('resize', debounce(checkDevice, 250));
    // Call immediately with current device
    callback(currentDevice, null);
}

// Image Utilities

function loadImage(src, options = {}) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        let timeoutId;
        
        if (options.crossOrigin) {
            img.crossOrigin = options.crossOrigin;
        }
        
        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
        
        img.onload = () => {
            cleanup();
            resolve(img);
        };
        
        img.onerror = () => {
            cleanup();
            reject(new Error(`Failed to load image: ${src}`));
        };
        
        if (options.timeout) {
            timeoutId = setTimeout(() => {
                img.src = ''; // Cancel loading
                reject(new Error(`Image load timeout: ${src}`));
            }, options.timeout);
        }
        
        img.src = src;
    });
}

async function preloadImages(urls, options = {}) {
    const promises = urls.map(url => loadImage(url, options).catch(err => {
        window.MetLogger?.warn(`Failed to preload image: ${url}`, err);
        return null;
    }));
    
    const results = await Promise.all(promises);
    return results.filter(img => img !== null);
}

// Cache Utilities

class LRUCache {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }
    
    get(key) {
        if (!this.cache.has(key)) return undefined;
        
        // Move to end (most recently used)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }
    
    set(key, value) {
        // Remove key if it exists (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }
    
    has(key) {
        return this.cache.has(key);
    }
    
    delete(key) {
        return this.cache.delete(key);
    }
    
    clear() {
        this.cache.clear();
    }
    
    get size() {
        return this.cache.size;
    }
}

// URL Utilities

function getURLParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
}

function getURLParam(key) {
    return new URLSearchParams(window.location.search).get(key);
}

function setURLParam(key, value, options = {}) {
    const url = new URL(window.location);
    url.searchParams.set(key, value);
    
    if (options.replace) {
        window.history.replaceState({}, '', url);
    } else {
        window.history.pushState({}, '', url);
    }
}

function removeURLParam(key, options = {}) {
    const url = new URL(window.location);
    url.searchParams.delete(key);
    
    if (options.replace) {
        window.history.replaceState({}, '', url);
    } else {
        window.history.pushState({}, '', url);
    }
}

function updateURLParams(params, options = {}) {
    const url = new URL(window.location);
    
    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, value);
        }
    });
    
    if (options.replace) {
        window.history.replaceState({}, '', url);
    } else {
        window.history.pushState({}, '', url);
    }
}

// Promise Utilities

function promiseWithTimeout(promise, timeoutMs, timeoutError = 'Operation timed out') {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
        )
    ]);
}

function createCancellablePromise(promise) {
    let isCancelled = false;
    
    const wrappedPromise = new Promise((resolve, reject) => {
        promise.then(
            value => !isCancelled && resolve(value),
            error => !isCancelled && reject(error)
        );
    });
    
    return {
        promise: wrappedPromise,
        cancel: () => { isCancelled = true; }
    };
}

// Error Handling Utilities

function safeExecute(fn, defaultValue = null, errorHandler = console.error) {
    try {
        const result = fn();
        return result instanceof Promise ? 
            result.catch(error => {
                errorHandler(error);
                return defaultValue;
            }) : result;
    } catch (error) {
        errorHandler(error);
        return defaultValue;
    }
}

async function safeAsyncExecute(fn, defaultValue = null, errorHandler = console.error) {
    try {
        return await fn();
    } catch (error) {
        errorHandler(error);
        return defaultValue;
    }
}

// Date Utilities

function formatDate(date, options = {}) {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    
    return d.toLocaleDateString(undefined, { ...defaultOptions, ...options });
}

function formatRelativeTime(date) {
    const now = new Date();
    const d = new Date(date);
    const diff = now - d;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
}

// String Utilities

function truncateText(text, maxLength, suffix = '...') {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
}

function capitalizeFirst(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function sanitizeHTML(html) {
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
}

// Event Utilities

function once(fn) {
    let called = false;
    let result;
    
    return function(...args) {
        if (!called) {
            called = true;
            result = fn.apply(this, args);
        }
        return result;
    };
}

function createEventEmitter() {
    const events = new Map();
    
    return {
        on(event, handler) {
            if (!events.has(event)) {
                events.set(event, new Set());
            }
            events.get(event).add(handler);
        },
        
        off(event, handler) {
            if (events.has(event)) {
                events.get(event).delete(handler);
            }
        },
        
        emit(event, ...args) {
            if (events.has(event)) {
                events.get(event).forEach(handler => {
                    safeExecute(() => handler(...args));
                });
            }
        },
        
        clear(event) {
            if (event) {
                events.delete(event);
            } else {
                events.clear();
            }
        }
    };
}

// Make utilities available globally
window.MetUtils = {
    // Timing
    debounce,
    throttle,
    sleep,
    
    // Storage
    safeLocalStorageGet,
    safeLocalStorageSet,
    safeLocalStorageRemove,
    
    // Network
    retryWithBackoff,
    isOnline,
    onNetworkStatusChange,
    
    // Arrays
    shuffleArray,
    chunkArray,
    
    // DOM
    createElement,
    isMobileDevice,
    getDeviceType,
    onDeviceChange,
    
    // Images
    loadImage,
    preloadImages,
    
    // Cache
    LRUCache,
    
    // URLs
    getURLParams,
    getURLParam,
    setURLParam,
    removeURLParam,
    updateURLParams,
    
    // Promises
    promiseWithTimeout,
    createCancellablePromise,
    
    // Error Handling
    safeExecute,
    safeAsyncExecute,
    
    // Dates
    formatDate,
    formatRelativeTime,
    
    // Strings
    truncateText,
    capitalizeFirst,
    sanitizeHTML,
    
    // Events
    once,
    createEventEmitter
};