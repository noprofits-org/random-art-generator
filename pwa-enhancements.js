// pwa-enhancements.js - PWA enhancements for standalone mode and advanced features

(function() {
    'use strict';
    
    // Check if running in standalone mode
    const isStandalone = () => {
        return (window.matchMedia('(display-mode: standalone)').matches) ||
               (window.navigator.standalone) || 
               document.referrer.includes('android-app://');
    };
    
    // Initialize PWA enhancements
    function initPWAEnhancements() {
        // Handle standalone mode
        if (isStandalone()) {
            handleStandaloneMode();
        }
        
        // Handle display mode changes
        window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
            if (e.matches) {
                handleStandaloneMode();
            }
        });
        
        // Handle app install
        handleAppInstall();
        
        // Handle share target
        handleShareTarget();
        
        // Setup periodic background sync
        setupPeriodicSync();
        
        // Handle deep links
        handleDeepLinks();
        
        // Add navigation gestures for standalone
        if (isStandalone()) {
            addNavigationGestures();
        }
    }
    
    // Handle standalone display mode
    function handleStandaloneMode() {
        document.body.classList.add('standalone-mode');
        
        // Add custom navigation UI for standalone
        if (!document.getElementById('standaloneNav')) {
            createStandaloneNavigation();
        }
        
        // Handle external links
        handleExternalLinks();
        
        // Add pull-to-refresh
        addPullToRefresh();
        
        // Show standalone-specific tips
        if (window.MetUI?.showContextualTip) {
            setTimeout(() => {
                window.MetUI.showContextualTip('offlineMode');
            }, 3000);
        }
    }
    
    // Create standalone navigation
    function createStandaloneNavigation() {
        const nav = document.createElement('div');
        nav.id = 'standaloneNav';
        nav.className = 'standalone-nav';
        nav.innerHTML = `
            <button class="standalone-back" aria-label="Go back">
                <i class="fas fa-arrow-left"></i>
            </button>
            <span class="standalone-title">Met Art Generator</span>
            <button class="standalone-share" aria-label="Share">
                <i class="fas fa-share"></i>
            </button>
        `;
        
        document.body.insertBefore(nav, document.body.firstChild);
        
        // Handle back button
        nav.querySelector('.standalone-back').addEventListener('click', () => {
            if (window.history.length > 1) {
                window.history.back();
            }
        });
        
        // Handle share button
        nav.querySelector('.standalone-share').addEventListener('click', shareApp);
        
        // Add CSS
        addStandaloneStyles();
    }
    
    // Handle external links in standalone mode
    function handleExternalLinks() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && link.hostname !== window.location.hostname) {
                e.preventDefault();
                // Open external links in browser
                window.open(link.href, '_blank');
            }
        });
    }
    
    // Add pull-to-refresh functionality
    function addPullToRefresh() {
        let touchStartY = 0;
        let touchEndY = 0;
        let isPulling = false;
        
        const pullIndicator = document.createElement('div');
        pullIndicator.className = 'pull-to-refresh-indicator';
        pullIndicator.innerHTML = '<i class="fas fa-sync"></i>';
        document.body.appendChild(pullIndicator);
        
        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                touchStartY = e.touches[0].clientY;
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (window.scrollY === 0 && touchStartY > 0) {
                touchEndY = e.touches[0].clientY;
                const pullDistance = touchEndY - touchStartY;
                
                if (pullDistance > 0) {
                    isPulling = true;
                    const opacity = Math.min(pullDistance / 150, 1);
                    const scale = 0.5 + (opacity * 0.5);
                    
                    pullIndicator.style.opacity = opacity;
                    pullIndicator.style.transform = `translateY(${Math.min(pullDistance * 0.5, 60)}px) scale(${scale})`;
                    
                    if (pullDistance > 150) {
                        pullIndicator.classList.add('ready');
                    } else {
                        pullIndicator.classList.remove('ready');
                    }
                }
            }
        });
        
        document.addEventListener('touchend', () => {
            if (isPulling && touchEndY - touchStartY > 150) {
                pullIndicator.classList.add('refreshing');
                
                // Refresh content
                if (window.MetAPI?.getRandomArtwork) {
                    window.MetAPI.getRandomArtwork().then(artwork => {
                        if (artwork && window.MetArtwork) {
                            window.MetArtwork.displayArtwork(artwork);
                        }
                    });
                }
                
                setTimeout(() => {
                    pullIndicator.classList.remove('refreshing', 'ready');
                    pullIndicator.style.opacity = '0';
                    pullIndicator.style.transform = 'translateY(0) scale(0.5)';
                }, 1000);
            } else {
                pullIndicator.style.opacity = '0';
                pullIndicator.style.transform = 'translateY(0) scale(0.5)';
            }
            
            isPulling = false;
            touchStartY = 0;
            touchEndY = 0;
        });
    }
    
    // Handle app install prompt
    function handleAppInstall() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later
            deferredPrompt = e;
            
            // Show custom install UI
            showInstallPrompt(deferredPrompt);
        });
        
        // Handle successful install
        window.addEventListener('appinstalled', () => {
            window.MetLogger?.log('PWA was installed');
            hideInstallPrompt();
            
            if (window.MetUI?.showStatusMessage) {
                window.MetUI.showStatusMessage('App installed successfully!', 'success');
            }
        });
    }
    
    // Show custom install prompt
    function showInstallPrompt(deferredPrompt) {
        const installBanner = document.createElement('div');
        installBanner.className = 'install-banner';
        installBanner.innerHTML = `
            <div class="install-content">
                <i class="fas fa-download"></i>
                <div class="install-text">
                    <strong>Install Met Art Generator</strong>
                    <span>Add to your home screen for the best experience</span>
                </div>
                <button class="install-button">Install</button>
                <button class="install-dismiss" aria-label="Dismiss">×</button>
            </div>
        `;
        
        document.body.appendChild(installBanner);
        
        // Animate in
        requestAnimationFrame(() => {
            installBanner.classList.add('show');
        });
        
        // Handle install
        installBanner.querySelector('.install-button').addEventListener('click', async () => {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            window.MetLogger?.log('User response to install prompt:', outcome);
            
            if (outcome === 'accepted') {
                hideInstallPrompt();
            }
        });
        
        // Handle dismiss
        installBanner.querySelector('.install-dismiss').addEventListener('click', hideInstallPrompt);
    }
    
    // Hide install prompt
    function hideInstallPrompt() {
        const banner = document.querySelector('.install-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
        }
    }
    
    // Handle share target
    function handleShareTarget() {
        // Check if page was opened via share target
        const params = new URLSearchParams(window.location.search);
        if (params.has('share-target')) {
            const title = params.get('title');
            const text = params.get('text');
            const url = params.get('url');
            
            // Handle shared content
            if (url && url.includes('metmuseum.org')) {
                // Extract object ID from Met Museum URL
                const objectId = url.match(/objectID=(\d+)/)?.[1];
                if (objectId) {
                    loadSharedArtwork(objectId);
                }
            }
        }
    }
    
    // Load shared artwork
    async function loadSharedArtwork(objectId) {
        if (window.MetAPI && window.MetArtwork) {
            try {
                window.MetUI?.showLoading();
                const response = await fetch(`${window.MetConfig.MET_API_BASE_URL}/objects/${objectId}`);
                const artwork = await response.json();
                
                if (artwork) {
                    window.MetArtwork.displayArtwork(artwork);
                    
                    if (window.MetUI?.showStatusMessage) {
                        window.MetUI.showStatusMessage('Shared artwork loaded', 'success');
                    }
                }
            } catch (error) {
                window.MetLogger?.error('Error loading shared artwork:', error);
                window.MetUI?.showError('Could not load shared artwork');
            }
        }
    }
    
    // Setup periodic background sync
    async function setupPeriodicSync() {
        if ('periodicSync' in self.registration) {
            try {
                await self.registration.periodicSync.register('refresh-content', {
                    minInterval: 24 * 60 * 60 * 1000 // 24 hours
                });
                window.MetLogger?.log('Periodic sync registered');
            } catch (error) {
                window.MetLogger?.error('Periodic sync registration failed:', error);
            }
        }
    }
    
    // Handle deep links
    function handleDeepLinks() {
        const params = new URLSearchParams(window.location.search);
        
        // Handle action parameter
        if (params.has('action')) {
            const action = params.get('action');
            
            switch (action) {
                case 'random':
                    // Load random artwork
                    setTimeout(() => {
                        document.getElementById('randomArtButton')?.click();
                    }, 500);
                    break;
                    
                case 'favorites':
                    // Open favorites
                    setTimeout(() => {
                        document.getElementById('viewFavoritesButton')?.click();
                    }, 500);
                    break;
            }
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    // Share app functionality
    async function shareApp() {
        const shareData = {
            title: 'Met Art Generator',
            text: 'Discover amazing artworks from the Metropolitan Museum collection!',
            url: window.location.origin
        };
        
        try {
            if (navigator.share) {
                await navigator.share(shareData);
                window.MetLogger?.log('App shared successfully');
            } else {
                // Fallback to copy link
                await navigator.clipboard.writeText(shareData.url);
                if (window.MetUI?.showStatusMessage) {
                    window.MetUI.showStatusMessage('Link copied to clipboard!', 'success');
                }
            }
        } catch (error) {
            window.MetLogger?.error('Error sharing:', error);
        }
    }
    
    // Add navigation gestures
    function addNavigationGestures() {
        let touchStartX = 0;
        let touchEndX = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipeGesture();
        });
        
        function handleSwipeGesture() {
            const swipeThreshold = 50;
            const diff = touchEndX - touchStartX;
            
            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    // Swipe right - go back
                    if (window.history.length > 1) {
                        window.history.back();
                    }
                } else {
                    // Swipe left - load new artwork
                    document.getElementById('randomArtButton')?.click();
                }
            }
        }
    }
    
    // Add CSS for PWA enhancements
    function addStandaloneStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Standalone mode styles */
            .standalone-mode {
                padding-top: 44px; /* Space for custom nav */
            }
            
            .standalone-nav {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 44px;
                background: var(--primary-color);
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 1rem;
                z-index: 1000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .standalone-nav button {
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                padding: 0.5rem;
                cursor: pointer;
                width: 44px;
                height: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .standalone-title {
                font-weight: 600;
                font-size: 1.1rem;
            }
            
            /* Pull to refresh */
            .pull-to-refresh-indicator {
                position: fixed;
                top: -60px;
                left: 50%;
                transform: translateX(-50%) translateY(0) scale(0.5);
                width: 40px;
                height: 40px;
                background: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                opacity: 0;
                transition: none;
                z-index: 999;
            }
            
            .pull-to-refresh-indicator.ready {
                color: var(--primary-color);
            }
            
            .pull-to-refresh-indicator.refreshing i {
                animation: spin 1s linear infinite;
            }
            
            /* Install banner */
            .install-banner {
                position: fixed;
                bottom: -100px;
                left: 0;
                right: 0;
                background: white;
                box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                padding: 1rem;
                transition: transform 0.3s ease;
                z-index: 900;
            }
            
            .install-banner.show {
                transform: translateY(-100px);
            }
            
            .install-content {
                display: flex;
                align-items: center;
                gap: 1rem;
                max-width: 600px;
                margin: 0 auto;
            }
            
            .install-content i {
                font-size: 2rem;
                color: var(--primary-color);
            }
            
            .install-text {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            
            .install-text strong {
                font-size: 1.1rem;
                margin-bottom: 0.25rem;
            }
            
            .install-text span {
                font-size: 0.9rem;
                color: #666;
            }
            
            .install-button {
                background: var(--primary-color);
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
            }
            
            .install-dismiss {
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                background: none;
                border: none;
                font-size: 1.5rem;
                color: #999;
                cursor: pointer;
                width: 40px;
                height: 40px;
            }
            
            /* Safe area adjustments for notched devices */
            @supports (padding: max(0px)) {
                .standalone-nav {
                    padding-top: max(0px, env(safe-area-inset-top));
                    height: calc(44px + max(0px, env(safe-area-inset-top)));
                }
                
                .standalone-mode {
                    padding-top: calc(44px + max(0px, env(safe-area-inset-top)));
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Update manifest for share target
    function updateManifestForShareTarget() {
        // This would typically be done server-side, but showing the configuration
        const shareTargetConfig = {
            "share_target": {
                "action": "/",
                "method": "GET",
                "params": {
                    "title": "title",
                    "text": "text",
                    "url": "url"
                }
            }
        };
        
        window.MetLogger?.log('Share target config:', shareTargetConfig);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPWAEnhancements);
    } else {
        initPWAEnhancements();
    }
    
})();