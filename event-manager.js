// event-manager.js - Centralized event handler management to prevent memory leaks
// FIXED: Created comprehensive event cleanup system

class EventManager {
    constructor() {
        this.listeners = new Map();
        this.observers = new Map();
        this.timeouts = new Set();
        this.intervals = new Set();
        this.animationFrames = new Set();
        this.abortControllers = new Map();
    }

    // Add event listener with automatic cleanup tracking
    addEventListener(element, event, handler, options = {}) {
        if (!element || !event || !handler) {
            console.warn('EventManager: Invalid addEventListener parameters');
            return null;
        }

        // Create a unique key for this listener
        const key = `${element.id || 'unnamed'}_${event}_${Date.now()}_${Math.random()}`;
        
        // Store the listener info
        this.listeners.set(key, {
            element,
            event,
            handler,
            options
        });

        // Add the event listener
        try {
            element.addEventListener(event, handler, options);
        } catch (error) {
            console.error('EventManager: Error adding event listener:', error);
            this.listeners.delete(key);
            return null;
        }

        // Return the key for manual removal if needed
        return key;
    }

    // Remove specific event listener
    removeEventListener(key) {
        const listener = this.listeners.get(key);
        if (listener) {
            const { element, event, handler, options } = listener;
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                console.error('EventManager: Error removing event listener:', error);
            }
            this.listeners.delete(key);
        }
    }

    // Add observer with cleanup tracking
    observe(observer, target, options = {}) {
        if (!observer || !target) {
            console.warn('EventManager: Invalid observe parameters');
            return null;
        }

        const key = `observer_${Date.now()}_${Math.random()}`;
        
        this.observers.set(key, {
            observer,
            target
        });

        try {
            observer.observe(target, options);
        } catch (error) {
            console.error('EventManager: Error starting observer:', error);
            this.observers.delete(key);
            return null;
        }

        return key;
    }

    // Remove observer
    unobserve(key) {
        const observerInfo = this.observers.get(key);
        if (observerInfo) {
            const { observer, target } = observerInfo;
            try {
                observer.unobserve(target);
                observer.disconnect();
            } catch (error) {
                console.error('EventManager: Error removing observer:', error);
            }
            this.observers.delete(key);
        }
    }

    // Add timeout with tracking
    setTimeout(callback, delay) {
        const timeoutId = setTimeout(() => {
            this.timeouts.delete(timeoutId);
            callback();
        }, delay);
        
        this.timeouts.add(timeoutId);
        return timeoutId;
    }

    // Clear timeout
    clearTimeout(timeoutId) {
        if (this.timeouts.has(timeoutId)) {
            clearTimeout(timeoutId);
            this.timeouts.delete(timeoutId);
        }
    }

    // Add interval with tracking
    setInterval(callback, delay) {
        const intervalId = setInterval(callback, delay);
        this.intervals.add(intervalId);
        return intervalId;
    }

    // Clear interval
    clearInterval(intervalId) {
        if (this.intervals.has(intervalId)) {
            clearInterval(intervalId);
            this.intervals.delete(intervalId);
        }
    }

    // Add animation frame with tracking
    requestAnimationFrame(callback) {
        const frameId = requestAnimationFrame((timestamp) => {
            this.animationFrames.delete(frameId);
            callback(timestamp);
        });
        
        this.animationFrames.add(frameId);
        return frameId;
    }

    // Cancel animation frame
    cancelAnimationFrame(frameId) {
        if (this.animationFrames.has(frameId)) {
            cancelAnimationFrame(frameId);
            this.animationFrames.delete(frameId);
        }
    }

    // Create abort controller with tracking
    createAbortController(key) {
        const controller = new AbortController();
        this.abortControllers.set(key, controller);
        return controller;
    }

    // Abort and remove controller
    abortController(key) {
        const controller = this.abortControllers.get(key);
        if (controller) {
            controller.abort();
            this.abortControllers.delete(key);
        }
    }

    // Clean up all event listeners for a specific element
    cleanupElement(element) {
        if (!element) return;

        let cleaned = 0;
        
        // Remove all listeners for this element
        for (const [key, listener] of this.listeners.entries()) {
            if (listener.element === element) {
                this.removeEventListener(key);
                cleaned++;
            }
        }

        // Disconnect observers for this element
        for (const [key, observerInfo] of this.observers.entries()) {
            if (observerInfo.target === element) {
                this.unobserve(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`EventManager: Cleaned up ${cleaned} handlers for element`);
        }
    }

    // Clean up all resources
    cleanup() {
        console.log('EventManager: Starting complete cleanup...');

        // Remove all event listeners
        for (const key of this.listeners.keys()) {
            this.removeEventListener(key);
        }

        // Disconnect all observers
        for (const key of this.observers.keys()) {
            this.unobserve(key);
        }

        // Clear all timeouts
        for (const timeoutId of this.timeouts) {
            clearTimeout(timeoutId);
        }
        this.timeouts.clear();

        // Clear all intervals
        for (const intervalId of this.intervals) {
            clearInterval(intervalId);
        }
        this.intervals.clear();

        // Cancel all animation frames
        for (const frameId of this.animationFrames) {
            cancelAnimationFrame(frameId);
        }
        this.animationFrames.clear();

        // Abort all controllers
        for (const [key, controller] of this.abortControllers) {
            controller.abort();
        }
        this.abortControllers.clear();

        console.log('EventManager: Cleanup complete');
    }

    // Get statistics
    getStats() {
        return {
            listeners: this.listeners.size,
            observers: this.observers.size,
            timeouts: this.timeouts.size,
            intervals: this.intervals.size,
            animationFrames: this.animationFrames.size,
            abortControllers: this.abortControllers.size
        };
    }
}

// Create global instance
window.MetEventManager = new EventManager();

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    window.MetEventManager.cleanup();
}, { once: true });