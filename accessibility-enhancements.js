// accessibility-enhancements.js - Comprehensive accessibility improvements

(function() {
    'use strict';
    
    // Keyboard navigation state
    let currentFocusIndex = 0;
    let focusableElements = [];
    let isKeyboardUser = false;
    
    // Keyboard shortcuts
    const keyboardShortcuts = {
        'r': () => document.getElementById('randomArtButton')?.click(),
        'f': () => document.getElementById('viewFavoritesButton')?.click(),
        'i': () => toggleInfoPanel(),
        'h': () => toggleHeart(),
        '?': () => showKeyboardHelp(),
        'Escape': () => closeAllModals()
    };
    
    // ARIA live region for announcements
    function createAriaLiveRegion() {
        if (document.getElementById('ariaLive')) return;
        
        const liveRegion = document.createElement('div');
        liveRegion.id = 'ariaLive';
        liveRegion.className = 'visually-hidden';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.setAttribute('role', 'status');
        
        document.body.appendChild(liveRegion);
    }
    
    // Announce to screen readers
    function announce(message, priority = 'polite') {
        const liveRegion = document.getElementById('ariaLive');
        if (!liveRegion) return;
        
        // Set priority
        liveRegion.setAttribute('aria-live', priority);
        
        // Clear previous announcement
        liveRegion.textContent = '';
        
        // Announce after a brief delay to ensure it's picked up
        setTimeout(() => {
            liveRegion.textContent = message;
        }, 100);
    }
    
    // Add comprehensive ARIA labels
    function enhanceAriaLabels() {
        // Main containers
        const artworkContainer = document.getElementById('artworkContainer');
        if (artworkContainer) {
            artworkContainer.setAttribute('role', 'main');
            artworkContainer.setAttribute('aria-label', 'Artwork display area');
        }
        
        // Navigation
        const mobileNav = document.getElementById('mobileNav');
        if (mobileNav) {
            mobileNav.setAttribute('role', 'navigation');
            mobileNav.setAttribute('aria-label', 'Main navigation');
        }
        
        // Modals
        const favoritesModal = document.getElementById('favoritesModal');
        if (favoritesModal) {
            favoritesModal.setAttribute('role', 'dialog');
            favoritesModal.setAttribute('aria-modal', 'true');
            favoritesModal.setAttribute('aria-labelledby', 'favoritesModalTitle');
        }
        
        // Buttons with dynamic states
        updateButtonLabels();
    }
    
    // Update button labels based on state
    function updateButtonLabels() {
        // Favorite button
        const favoriteBtn = document.querySelector('.favorite-button');
        if (favoriteBtn) {
            const isFavorited = favoriteBtn.classList.contains('favorited');
            favoriteBtn.setAttribute('aria-label', 
                isFavorited ? 'Remove from favorites' : 'Add to favorites'
            );
            favoriteBtn.setAttribute('aria-pressed', isFavorited.toString());
        }
        
        // Loading states
        document.querySelectorAll('.loading').forEach(loading => {
            loading.setAttribute('role', 'status');
            loading.setAttribute('aria-label', 'Loading content');
        });
    }
    
    // Enhance keyboard navigation
    function setupKeyboardNavigation() {
        // Detect keyboard user
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                isKeyboardUser = true;
                document.body.classList.add('keyboard-user');
            }
        });
        
        document.addEventListener('mousedown', () => {
            isKeyboardUser = false;
            document.body.classList.remove('keyboard-user');
        });
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Skip if user is typing in an input
            if (e.target.matches('input, textarea, select')) return;
            
            const handler = keyboardShortcuts[e.key];
            if (handler) {
                e.preventDefault();
                handler();
            }
        });
        
        // Focus trap for modals
        setupModalFocusTrap();
    }
    
    // Focus trap for modals
    function setupModalFocusTrap() {
        const modals = document.querySelectorAll('.favorites-modal, .search-modal');
        
        modals.forEach(modal => {
            modal.addEventListener('keydown', (e) => {
                if (!modal.classList.contains('show')) return;
                
                if (e.key === 'Tab') {
                    const focusable = modal.querySelectorAll(
                        'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            });
        });
    }
    
    // Skip links
    function addSkipLinks() {
        const skipNav = document.createElement('a');
        skipNav.href = '#artworkContainer';
        skipNav.className = 'skip-link';
        skipNav.textContent = 'Skip to main content';
        skipNav.setAttribute('aria-label', 'Skip navigation and go to main content');
        
        document.body.insertBefore(skipNav, document.body.firstChild);
        
        // Handle skip link click
        skipNav.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(skipNav.getAttribute('href'));
            if (target) {
                target.tabIndex = -1;
                target.focus();
                announce('Skipped to main content');
            }
        });
    }
    
    // Enhance image accessibility
    function enhanceImageAccessibility() {
        // Add alt text to all images
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        const images = node.querySelectorAll ? 
                            node.querySelectorAll('img') : [];
                        
                        images.forEach(img => {
                            if (!img.alt) {
                                // Try to derive alt text from context
                                const title = img.closest('[data-title]')?.dataset.title ||
                                            img.closest('.artwork-info')?.querySelector('.artwork-title')?.textContent ||
                                            'Artwork image';
                                img.alt = title;
                            }
                        });
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Add landmarks
    function addLandmarks() {
        // Header
        const header = document.querySelector('.desktop-header, .simplified-controls');
        if (header) {
            header.setAttribute('role', 'banner');
        }
        
        // Search region
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.setAttribute('role', 'search');
            searchContainer.setAttribute('aria-label', 'Search artworks');
        }
        
        // Sidebar
        const sidebar = document.querySelector('.controls-drawer, .desktop-sidebar');
        if (sidebar) {
            sidebar.setAttribute('role', 'complementary');
            sidebar.setAttribute('aria-label', 'Artwork information and filters');
        }
    }
    
    // High contrast mode support
    function setupHighContrastMode() {
        // Check for system preference
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
        
        if (prefersHighContrast) {
            document.documentElement.classList.add('high-contrast');
        }
        
        // Listen for changes
        window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
            document.documentElement.classList.toggle('high-contrast', e.matches);
        });
    }
    
    // Screen reader announcements for state changes
    function setupStateChangeAnnouncements() {
        // Override existing methods to add announcements
        if (window.MetUI) {
            const originalShowLoading = window.MetUI.showLoading;
            const originalHideLoading = window.MetUI.hideLoading;
            const originalUpdateStatus = window.MetUI.updateStatus;
            
            window.MetUI.showLoading = function(type = 'artwork') {
                originalShowLoading(type);
                announce('Loading new artwork, please wait');
            };
            
            window.MetUI.hideLoading = function() {
                originalHideLoading();
                announce('Content loaded');
            };
            
            window.MetUI.updateStatus = function(message, type = 'info') {
                originalUpdateStatus(message, type);
                
                // Announce important status changes
                if (type === 'error' || type === 'success' || type === 'warning') {
                    announce(message, type === 'error' ? 'assertive' : 'polite');
                }
            };
        }
        
        // Artwork display announcements
        if (window.MetArtwork) {
            const originalDisplayArtwork = window.MetArtwork.displayArtwork;
            
            window.MetArtwork.displayArtwork = async function(artwork) {
                const result = await originalDisplayArtwork(artwork);
                
                if (artwork) {
                    const announcement = `Now showing: ${artwork.title || 'Untitled'} by ${artwork.artistDisplayName || 'Unknown Artist'}`;
                    announce(announcement);
                }
                
                return result;
            };
        }
    }
    
    // Toggle info panel (mobile)
    function toggleInfoPanel() {
        const panel = document.getElementById('mobileInfoPanel');
        if (panel) {
            const isExpanded = panel.classList.contains('expanded');
            panel.classList.toggle('expanded');
            announce(isExpanded ? 'Info panel closed' : 'Info panel opened');
        }
    }
    
    // Toggle heart/favorite
    function toggleHeart() {
        const favoriteBtn = document.querySelector('.favorite-button');
        if (favoriteBtn) {
            favoriteBtn.click();
        }
    }
    
    // Show keyboard help
    function showKeyboardHelp() {
        const helpModal = document.createElement('div');
        helpModal.className = 'keyboard-help-modal';
        helpModal.setAttribute('role', 'dialog');
        helpModal.setAttribute('aria-modal', 'true');
        helpModal.setAttribute('aria-labelledby', 'keyboardHelpTitle');
        
        helpModal.innerHTML = `
            <div class="keyboard-help-content">
                <h2 id="keyboardHelpTitle">Keyboard Shortcuts</h2>
                <button class="close-help" aria-label="Close help">×</button>
                <dl class="shortcuts-list">
                    <dt><kbd>R</kbd></dt>
                    <dd>Load random artwork</dd>
                    <dt><kbd>F</kbd></dt>
                    <dd>Open favorites</dd>
                    <dt><kbd>I</kbd></dt>
                    <dd>Toggle info panel</dd>
                    <dt><kbd>H</kbd></dt>
                    <dd>Toggle favorite (heart)</dd>
                    <dt><kbd>?</kbd></dt>
                    <dd>Show this help</dd>
                    <dt><kbd>Esc</kbd></dt>
                    <dd>Close modals</dd>
                </dl>
            </div>
        `;
        
        document.body.appendChild(helpModal);
        
        // Focus on close button
        const closeBtn = helpModal.querySelector('.close-help');
        closeBtn.focus();
        
        // Close handlers
        closeBtn.addEventListener('click', () => helpModal.remove());
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) helpModal.remove();
        });
        
        announce('Keyboard shortcuts help opened');
    }
    
    // Close all modals
    function closeAllModals() {
        document.querySelectorAll('.modal.show, .favorites-modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
        
        const helpModal = document.querySelector('.keyboard-help-modal');
        if (helpModal) helpModal.remove();
        
        announce('Modal closed');
    }
    
    // Add CSS for accessibility features
    function addAccessibilityStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Skip link */
            .skip-link {
                position: absolute;
                top: -40px;
                left: 0;
                background: var(--primary-color);
                color: white;
                padding: 8px;
                text-decoration: none;
                border-radius: 0 0 4px 0;
                z-index: 10000;
            }
            
            .skip-link:focus {
                top: 0;
            }
            
            /* Focus indicators for keyboard users */
            .keyboard-user *:focus {
                outline: 3px solid var(--primary-color);
                outline-offset: 2px;
            }
            
            /* High contrast mode */
            .high-contrast {
                --primary-color: #0066ff;
                --border-color: #000;
            }
            
            .high-contrast * {
                border-width: 2px !important;
            }
            
            .high-contrast button:not(:disabled) {
                border: 2px solid currentColor !important;
            }
            
            /* Keyboard help modal */
            .keyboard-help-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            
            .keyboard-help-content {
                background: white;
                padding: 2rem;
                border-radius: 8px;
                max-width: 400px;
                position: relative;
            }
            
            .keyboard-help-content h2 {
                margin-bottom: 1rem;
            }
            
            .close-help {
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                width: 40px;
                height: 40px;
            }
            
            .shortcuts-list {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 0.5rem;
            }
            
            .shortcuts-list dt {
                text-align: right;
            }
            
            .shortcuts-list kbd {
                background: #f0f0f0;
                border: 1px solid #ccc;
                border-radius: 3px;
                padding: 0.2rem 0.5rem;
                font-family: monospace;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Initialize accessibility enhancements
    function initAccessibility() {
        createAriaLiveRegion();
        enhanceAriaLabels();
        setupKeyboardNavigation();
        addSkipLinks();
        enhanceImageAccessibility();
        addLandmarks();
        setupHighContrastMode();
        setupStateChangeAnnouncements();
        addAccessibilityStyles();
        
        // Announce app ready
        announce('Random Art Generator ready');
        
        // Update labels on DOM changes
        const observer = new MutationObserver(() => {
            updateButtonLabels();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAccessibility);
    } else {
        initAccessibility();
    }
    
})();