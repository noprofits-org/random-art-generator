// state-manager.js - Centralized state management
// FIXED: Implement pub/sub pattern for state consistency

class StateManager {
    constructor() {
        this.state = {
            // Application state
            app: {
                initialized: false,
                online: navigator.onLine,
                debugMode: false,
                loading: false,
                error: null
            },
            
            // Search state
            search: {
                query: '',
                type: 'quick',
                filters: {},
                results: [],
                currentPage: 1,
                totalResults: 0,
                loading: false
            },
            
            // Current artwork state
            artwork: {
                current: null,
                loading: false,
                error: null
            },
            
            // UI state
            ui: {
                drawerOpen: false,
                favoritesModalOpen: false,
                searchMode: false,
                isMobile: window.innerWidth <= 768,
                statusMessage: '',
                statusType: 'info'
            },
            
            // Filters state
            filters: {
                departmentId: '',
                dateBegin: '',
                dateEnd: '',
                medium: '',
                searchQuery: '',
                geoLocation: '',
                excavation: '',
                title: '',
                artistOrCulture: false,
                isHighlight: false,
                isPublicDomain: true
            },
            
            // Favorites state
            favorites: {
                items: [],
                loading: false,
                count: 0
            },
            
            // Cache state
            cache: {
                apiCacheSize: 0,
                imageCacheSize: 0,
                lastCleanup: null
            }
        };
        
        // Subscribers
        this.subscribers = new Map();
        
        // State history for debugging
        this.history = [];
        this.maxHistory = 50;
        
        // Initialize
        this.init();
    }
    
    init() {
        // Load persisted state
        this.loadPersistedState();
        
        // Set up auto-save
        this.setupAutoSave();
        
        // Log initial state
        if (window.MetLogger) {
            window.MetLogger.log('StateManager initialized with state:', this.state);
        }
    }
    
    // Get state or specific path
    getState(path = null) {
        if (!path) return { ...this.state };
        
        const keys = path.split('.');
        let value = this.state;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }
    
    // Set state with immutability
    setState(path, value) {
        const keys = path.split('.');
        const newState = this.deepClone(this.state);
        
        let target = newState;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in target)) {
                target[key] = {};
            }
            target = target[key];
        }
        
        const lastKey = keys[keys.length - 1];
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        // Record history
        if (this.state.app.debugMode) {
            this.recordHistory({
                path,
                oldValue,
                newValue: value,
                timestamp: Date.now()
            });
        }
        
        // Update state
        this.state = newState;
        
        // Notify subscribers
        this.notifySubscribers(path, value, oldValue);
        
        // Save to storage
        this.saveStateDebounced();
        
        return newState;
    }
    
    // Subscribe to state changes
    subscribe(path, callback) {
        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Set());
        }
        
        this.subscribers.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(path);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.subscribers.delete(path);
                }
            }
        };
    }
    
    // Notify subscribers
    notifySubscribers(path, newValue, oldValue) {
        // Notify exact path subscribers
        const exactCallbacks = this.subscribers.get(path);
        if (exactCallbacks) {
            exactCallbacks.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error('Subscriber error:', error);
                }
            });
        }
        
        // Notify parent path subscribers
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentCallbacks = this.subscribers.get(parentPath);
            
            if (parentCallbacks) {
                parentCallbacks.forEach(callback => {
                    try {
                        callback(this.getState(parentPath), null, parentPath);
                    } catch (error) {
                        console.error('Parent subscriber error:', error);
                    }
                });
            }
        }
        
        // Notify wildcard subscribers
        const wildcardCallbacks = this.subscribers.get('*');
        if (wildcardCallbacks) {
            wildcardCallbacks.forEach(callback => {
                try {
                    callback(this.state, null, path);
                } catch (error) {
                    console.error('Wildcard subscriber error:', error);
                }
            });
        }
    }
    
    // Batch update multiple state values
    batchUpdate(updates) {
        const changes = [];
        
        // FIXED: Create a deep clone of state to maintain immutability
        const newState = this.deepClone(this.state);
        
        // Apply all updates to the cloned state
        for (const [path, value] of Object.entries(updates)) {
            const keys = path.split('.');
            let target = newState;
            
            // Navigate to the parent of the target property
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!(key in target)) {
                    target[key] = {};
                }
                target = target[key];
            }
            
            const lastKey = keys[keys.length - 1];
            const oldValue = this.getState(path);  // Get old value from current state
            target[lastKey] = value;
            
            changes.push({ path, oldValue, newValue: value });
        }
        
        // Update the state with the new immutable state
        this.state = newState;
        
        // Notify all subscribers
        changes.forEach(({ path, newValue, oldValue }) => {
            this.notifySubscribers(path, newValue, oldValue);
        });
        
        // Save once
        this.saveStateDebounced();
    }
    
    // Deep clone helper
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
    }
    
    // Record state history
    recordHistory(change) {
        this.history.push(change);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    
    // Get state history
    getHistory() {
        return [...this.history];
    }
    
    // Load persisted state
    loadPersistedState() {
        try {
            const saved = localStorage.getItem('metArtState');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Only load specific persisted values
                if (parsed.filters) {
                    this.state.filters = { ...this.state.filters, ...parsed.filters };
                }
                if (parsed.ui) {
                    this.state.ui.drawerOpen = parsed.ui.drawerOpen || false;
                }
            }
        } catch (error) {
            console.error('Error loading persisted state:', error);
        }
    }
    
    // Save state to storage
    saveState() {
        try {
            // Only persist specific state values
            const toSave = {
                filters: this.state.filters,
                ui: {
                    drawerOpen: this.state.ui.drawerOpen
                }
            };
            
            localStorage.setItem('metArtState', JSON.stringify(toSave));
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }
    
    // Debounced save
    saveStateDebounced = window.MetUtils?.debounce(() => {
        this.saveState();
    }, 1000) || this.saveState.bind(this);
    
    // Set up auto-save
    setupAutoSave() {
        // Save on page unload
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
    }
    
    // Reset state
    reset() {
        this.state = this.deepClone(this.constructor.prototype.state);
        this.history = [];
        this.notifySubscribers('*', this.state, null);
        localStorage.removeItem('metArtState');
    }
}

// Create global instance
window.MetState = new StateManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
}