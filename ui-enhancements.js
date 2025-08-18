// ui-enhancements.js - Enhanced UI with skeleton screens and smooth transitions

(function() {
    'use strict';
    
    // Skeleton screen templates
    const skeletonTemplates = {
        artwork: `
            <div class="skeleton-artwork-container">
                <div class="skeleton skeleton-artwork"></div>
                <div class="skeleton-info-container">
                    <div class="skeleton skeleton-text title"></div>
                    <div class="skeleton skeleton-text subtitle"></div>
                    <div class="skeleton skeleton-text description"></div>
                </div>
            </div>
        `,
        searchResult: `
            <div class="skeleton-search-result">
                <div class="skeleton skeleton-image"></div>
                <div class="skeleton-content">
                    <div class="skeleton skeleton-text title"></div>
                    <div class="skeleton skeleton-text subtitle"></div>
                </div>
            </div>
        `,
        favoriteItem: `
            <div class="skeleton-favorite-item">
                <div class="skeleton skeleton-image"></div>
                <div class="skeleton-content">
                    <div class="skeleton skeleton-text title"></div>
                    <div class="skeleton skeleton-text subtitle"></div>
                </div>
            </div>
        `
    };
    
    // Enhanced loading with skeleton screens
    function showSkeletonLoading(type = 'artwork') {
        const container = document.getElementById('artworkContainer');
        if (!container) return;
        
        // Add transitioning class for smooth fade
        container.classList.add('transitioning');
        
        // Use skeleton template based on type
        setTimeout(() => {
            container.innerHTML = skeletonTemplates[type] || skeletonTemplates.artwork;
            container.classList.remove('transitioning');
        }, 200);
        
        updateStatus('Loading artwork...', 'loading');
    }
    
    // Enhanced image loading with blur effect
    function loadImageWithBlur(img, src, thumbnail = null) {
        return new Promise((resolve, reject) => {
            // Create a container for the image
            const container = img.parentElement || document.createElement('div');
            container.classList.add('image-loading-container');
            
            // If we have a thumbnail, show it blurred first
            if (thumbnail) {
                const placeholder = document.createElement('img');
                placeholder.src = thumbnail;
                placeholder.className = 'image-loading-placeholder';
                container.appendChild(placeholder);
            }
            
            // Set initial state
            img.classList.add('loading');
            
            // Create new image to preload
            const tempImg = new Image();
            
            tempImg.onload = () => {
                // Set the source
                img.src = src;
                
                // Remove loading state and add loaded state
                requestAnimationFrame(() => {
                    img.classList.remove('loading');
                    img.classList.add('loaded');
                    
                    // Remove placeholder after transition
                    setTimeout(() => {
                        const placeholder = container.querySelector('.image-loading-placeholder');
                        if (placeholder) {
                            placeholder.remove();
                        }
                    }, 600);
                });
                
                resolve(img);
            };
            
            tempImg.onerror = () => {
                img.classList.remove('loading');
                reject(new Error('Failed to load image'));
            };
            
            // Start loading
            tempImg.src = src;
        });
    }
    
    // Create skeleton grid for search results
    function createSkeletonGrid(count = 6) {
        const items = [];
        for (let i = 0; i < count; i++) {
            items.push(`
                <div class="search-result-item skeleton-loader">
                    ${skeletonTemplates.searchResult}
                </div>
            `);
        }
        return items.join('');
    }
    
    // Contextual tips system
    const contextualTips = {
        firstTime: {
            message: 'Tap the heart icon to save your favorite artworks!',
            trigger: 'artwork-displayed',
            shown: false
        },
        noFavorites: {
            message: 'Start building your collection by tapping the heart on artworks you love',
            trigger: 'favorites-empty',
            shown: false
        },
        offlineMode: {
            message: 'You can view saved artworks even when offline',
            trigger: 'offline-detected',
            shown: false
        },
        swipeHint: {
            message: 'Swipe up to see artwork details',
            trigger: 'mobile-artwork-view',
            shown: false
        }
    };
    
    // Show contextual tip
    function showContextualTip(tipKey) {
        const tip = contextualTips[tipKey];
        if (!tip || tip.shown) return;
        
        // Check if tips are enabled in localStorage
        const tipsEnabled = localStorage.getItem('tipsEnabled') !== 'false';
        if (!tipsEnabled) return;
        
        // Create tip element
        const tipElement = document.createElement('div');
        tipElement.className = 'onboarding-tip';
        tipElement.innerHTML = `
            <span>${tip.message}</span>
            <span class="close-tip" aria-label="Dismiss tip">×</span>
        `;
        
        document.body.appendChild(tipElement);
        
        // Mark as shown
        tip.shown = true;
        localStorage.setItem(`tip_${tipKey}_shown`, 'true');
        
        // Handle close
        tipElement.querySelector('.close-tip').addEventListener('click', () => {
            tipElement.style.opacity = '0';
            setTimeout(() => tipElement.remove(), 300);
        });
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (tipElement.parentNode) {
                tipElement.style.opacity = '0';
                setTimeout(() => tipElement.remove(), 300);
            }
        }, 5000);
    }
    
    // Add ripple effect to buttons
    function addRippleEffect(button) {
        button.addEventListener('click', function(e) {
            // Remove any existing ripples
            const existingRipple = this.querySelector('.ripple');
            if (existingRipple) {
                existingRipple.remove();
            }
            
            // Create ripple
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            
            // Calculate position
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            this.appendChild(ripple);
            
            // Remove ripple after animation
            setTimeout(() => ripple.remove(), 600);
        });
    }
    
    // Enhanced status messages
    function showStatusMessage(message, type = 'info', duration = 3000) {
        // Remove any existing status message
        const existing = document.querySelector('.status-message');
        if (existing) {
            existing.classList.remove('show');
            setTimeout(() => existing.remove(), 300);
        }
        
        // Create new status message
        const statusMsg = document.createElement('div');
        statusMsg.className = `status-message ${type}`;
        statusMsg.textContent = message;
        
        document.body.appendChild(statusMsg);
        
        // Trigger animation
        requestAnimationFrame(() => {
            statusMsg.classList.add('show');
        });
        
        // Auto-hide
        if (duration > 0) {
            setTimeout(() => {
                statusMsg.classList.remove('show');
                setTimeout(() => statusMsg.remove(), 300);
            }, duration);
        }
        
        return statusMsg;
    }
    
    // Smooth scroll to element
    function smoothScrollTo(element, offset = 0) {
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - offset;
        
        window.scrollTo({
            top: targetY,
            behavior: 'smooth'
        });
    }
    
    // Initialize enhancements
    function initEnhancements() {
        // Add ripple effects to all buttons
        document.querySelectorAll('button').forEach(addRippleEffect);
        
        // Check for first-time user
        if (!localStorage.getItem('hasVisited')) {
            localStorage.setItem('hasVisited', 'true');
            setTimeout(() => {
                showContextualTip('firstTime');
            }, 2000);
        }
        
        // Load contextual tip states
        Object.keys(contextualTips).forEach(key => {
            if (localStorage.getItem(`tip_${key}_shown`) === 'true') {
                contextualTips[key].shown = true;
            }
        });
        
        // Add smooth focus indicators
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('button, a, input, select, textarea')) {
                e.target.classList.add('focus-visible');
            }
        });
        
        document.addEventListener('focusout', (e) => {
            e.target.classList.remove('focus-visible');
        });
        
        // Detect reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            document.documentElement.classList.add('reduce-motion');
        }
    }
    
    // Override existing UI methods with enhanced versions
    if (window.MetUI) {
        const originalShowLoading = window.MetUI.showLoading;
        const originalHideLoading = window.MetUI.hideLoading;
        const originalUpdateStatus = window.MetUI.updateStatus;
        
        // Enhanced show loading
        window.MetUI.showLoading = function(type = 'artwork') {
            showSkeletonLoading(type);
        };
        
        // Enhanced hide loading with smooth transition
        window.MetUI.hideLoading = function() {
            const container = document.getElementById('artworkContainer');
            if (container) {
                container.classList.add('transitioning');
                setTimeout(() => {
                    originalHideLoading();
                    container.classList.remove('transitioning');
                }, 200);
            } else {
                originalHideLoading();
            }
        };
        
        // Enhanced status updates
        window.MetUI.updateStatus = function(message, type = 'info') {
            originalUpdateStatus(message, type);
            
            // Show enhanced status message for important updates
            if (type === 'error' || type === 'success') {
                showStatusMessage(message, type);
            }
        };
        
        // Add new methods
        window.MetUI.loadImageWithBlur = loadImageWithBlur;
        window.MetUI.showContextualTip = showContextualTip;
        window.MetUI.showStatusMessage = showStatusMessage;
        window.MetUI.smoothScrollTo = smoothScrollTo;
        window.MetUI.createSkeletonGrid = createSkeletonGrid;
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEnhancements);
    } else {
        initEnhancements();
    }
    
})();