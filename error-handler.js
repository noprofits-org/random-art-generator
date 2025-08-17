// error-handler.js - Global error handling system
// FIXED: Comprehensive error handling for better stability

class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxErrors = 100;
        this.errorReportEndpoint = null;
        this.setupHandlers();
    }

    setupHandlers() {
        // Handle regular JavaScript errors
        window.onerror = (message, source, lineno, colno, error) => {
            this.handleError({
                type: 'javascript-error',
                message,
                source,
                lineno,
                colno,
                error,
                stack: error?.stack,
                timestamp: new Date().toISOString()
            });
            
            // Prevent default browser error handling
            return true;
        };

        // Handle Promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'unhandled-promise-rejection',
                reason: event.reason,
                promise: event.promise,
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack,
                timestamp: new Date().toISOString()
            });
            
            // Prevent default browser error handling
            event.preventDefault();
        });

        // Handle image loading errors globally
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                // This is a resource loading error
                if (event.target.tagName === 'IMG') {
                    this.handleResourceError({
                        type: 'image-load-error',
                        src: event.target.src,
                        message: 'Failed to load image',
                        timestamp: new Date().toISOString()
                    });
                } else if (event.target.tagName === 'SCRIPT') {
                    this.handleResourceError({
                        type: 'script-load-error',
                        src: event.target.src,
                        message: 'Failed to load script',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }, true);
    }

    handleError(errorInfo) {
        // Log to console in development
        if (this.isDevelopment()) {
            console.error('Global Error Handler:', errorInfo);
        }

        // Add to error log
        this.errorLog.push(errorInfo);
        
        // Trim log if too large
        if (this.errorLog.length > this.maxErrors) {
            this.errorLog = this.errorLog.slice(-this.maxErrors);
        }

        // Store in localStorage for debugging
        try {
            localStorage.setItem('metArtErrorLog', JSON.stringify(this.errorLog));
        } catch (e) {
            // Ignore storage errors
        }

        // Determine if this is a critical error
        const isCritical = this.isCriticalError(errorInfo);

        // Show user-friendly error message for critical errors
        if (isCritical) {
            this.showUserError(errorInfo);
        }

        // Report to analytics if available
        if (window.MetAnalytics?.trackError) {
            window.MetAnalytics.trackError(errorInfo);
        }

        // Send to error reporting service in production
        if (!this.isDevelopment() && this.errorReportEndpoint) {
            this.reportError(errorInfo);
        }
    }

    handleResourceError(errorInfo) {
        // Log resource errors separately
        console.warn('Resource Error:', errorInfo);

        // Don't show UI for resource errors unless critical
        if (errorInfo.type === 'script-load-error') {
            // Critical script failed to load
            this.showUserError({
                ...errorInfo,
                userMessage: 'Some features may not work properly. Please refresh the page.'
            });
        }

        // Track resource errors
        if (window.MetAnalytics?.trackResourceError) {
            window.MetAnalytics.trackResourceError(errorInfo);
        }
    }

    isCriticalError(errorInfo) {
        // Define what constitutes a critical error
        const criticalPatterns = [
            /Cannot read prop/i,
            /undefined is not/i,
            /null is not/i,
            /Failed to fetch/i,
            /Network request failed/i,
            /IndexedDB/i,
            /QuotaExceededError/i
        ];

        const message = errorInfo.message || '';
        return criticalPatterns.some(pattern => pattern.test(message));
    }

    showUserError(errorInfo) {
        // Don't show multiple error messages
        if (document.querySelector('.global-error-toast')) {
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'global-error-toast';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-exclamation-triangle';
        
        const message = document.createElement('span');
        message.textContent = errorInfo.userMessage || this.getUserFriendlyMessage(errorInfo);
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'error-toast-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => toast.remove();
        
        toast.appendChild(icon);
        toast.appendChild(message);
        toast.appendChild(closeBtn);
        
        document.body.appendChild(toast);
        
        // Auto-remove after 10 seconds
        setTimeout(() => toast.remove(), 10000);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
    }

    getUserFriendlyMessage(errorInfo) {
        const message = errorInfo.message || '';
        
        if (message.includes('fetch') || message.includes('Network')) {
            return 'Network connection issue. Please check your internet connection.';
        }
        
        if (message.includes('IndexedDB') || message.includes('QuotaExceeded')) {
            return 'Storage error. Try clearing some browser data.';
        }
        
        if (message.includes('Cannot read') || message.includes('undefined')) {
            return 'Something went wrong. Please refresh the page.';
        }
        
        return 'An unexpected error occurred. Please try again.';
    }

    isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.protocol === 'file:';
    }

    async reportError(errorInfo) {
        if (!this.errorReportEndpoint) return;

        try {
            await fetch(this.errorReportEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...errorInfo,
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (e) {
            // Silently fail - don't want to create error loop
            console.warn('Failed to report error:', e);
        }
    }

    getErrorLog() {
        return [...this.errorLog];
    }

    clearErrorLog() {
        this.errorLog = [];
        try {
            localStorage.removeItem('metArtErrorLog');
        } catch (e) {
            // Ignore
        }
    }

    // Get stored error log from previous sessions
    getStoredErrorLog() {
        try {
            const stored = localStorage.getItem('metArtErrorLog');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }
}

// Create global error handler instance
window.MetErrorHandler = new ErrorHandler();

// Add CSS for error toast
const style = document.createElement('style');
style.textContent = `
.global-error-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #dc3545;
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 400px;
    opacity: 0;
    transform: translateY(100%);
    transition: all 0.3s ease;
    z-index: 10000;
}

.global-error-toast.show {
    opacity: 1;
    transform: translateY(0);
}

.global-error-toast i {
    font-size: 20px;
}

.global-error-toast span {
    flex: 1;
    font-size: 14px;
    line-height: 1.4;
}

.error-toast-close {
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.8;
    transition: opacity 0.2s;
}

.error-toast-close:hover {
    opacity: 1;
}

@media (max-width: 768px) {
    .global-error-toast {
        left: 20px;
        right: 20px;
        bottom: 80px;
        max-width: none;
    }
}
`;
document.head.appendChild(style);