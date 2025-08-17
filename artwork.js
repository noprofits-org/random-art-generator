// artwork.js - Functions for displaying artwork

// Display the artwork in the UI
async function displayArtwork(artwork) {
    if (!artwork) {
        window.MetLogger?.error('No artwork data provided');
        return;
    }
    
    // Get container elements
    const artworkContainer = document.getElementById('artworkContainer');
    const artworkInfo = document.getElementById('artworkInfo');
    
    // Clear previous content
    artworkContainer.innerHTML = '';
    artworkInfo.innerHTML = '';
    
    // Check if the artwork has an image
    if (artwork.primaryImage) {
        // Create the image container
        const imgContainer = document.createElement('div');
        imgContainer.className = 'artwork-image-container';
        
        // Create loading indicator with progress
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-progress" style="display: none;">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="progress-text">0%</div>
            </div>
        `;
        imgContainer.appendChild(loadingIndicator);
        
        // Create the image element
        const img = document.createElement('img');
        img.className = 'artwork-image hidden';
        img.alt = artwork.title || 'Artwork from The Metropolitan Museum of Art';
        
        // Create blurred placeholder
        const placeholderCanvas = document.createElement('canvas');
        placeholderCanvas.className = 'image-placeholder';
        imgContainer.appendChild(placeholderCanvas);
        
        // Use progressive image loading
        const lowResImg = artwork.primaryImageSmall || artwork.primaryImage;
        const highResImg = artwork.primaryImage;
        
        // Function to create blur placeholder from small image
        const createBlurPlaceholder = async (imageUrl) => {
            return new Promise((resolve) => {
                const tempImg = new Image();
                tempImg.crossOrigin = 'anonymous';
                tempImg.onload = () => {
                    const ctx = placeholderCanvas.getContext('2d');
                    placeholderCanvas.width = 32; // Very small for blur effect
                    placeholderCanvas.height = 32;
                    ctx.filter = 'blur(3px)';
                    ctx.drawImage(tempImg, 0, 0, 32, 32);
                    placeholderCanvas.style.filter = 'blur(20px) brightness(1.1)';
                    placeholderCanvas.classList.add('visible');
                    resolve();
                };
                tempImg.onerror = () => resolve();
                tempImg.src = imageUrl;
            });
        };
        
        // Load low-res first if available
        if (lowResImg !== highResImg && artwork.primaryImageSmall) {
            const lowResUrl = window.MetAPI.loadArtworkImage(lowResImg);
            await createBlurPlaceholder(lowResUrl);
            
            // Also load small image for intermediate quality
            const placeholder = new Image();
            placeholder.src = lowResUrl;
            placeholder.onload = () => {
                img.style.filter = 'blur(8px) brightness(1.05)';
                img.style.transition = 'filter 0.6s ease-out';
                img.src = placeholder.src;
                img.classList.remove('hidden');
                placeholderCanvas.style.opacity = '0';
            };
        }
        
        // Function to track download progress
        const loadImageWithProgress = (url) => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'blob';
                
                xhr.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        const progressEl = loadingIndicator.querySelector('.loading-progress');
                        const progressFill = loadingIndicator.querySelector('.progress-fill');
                        const progressText = loadingIndicator.querySelector('.progress-text');
                        
                        if (progressEl && event.total > 1048576) { // Show progress for images > 1MB
                            progressEl.style.display = 'block';
                            loadingIndicator.querySelector('.loading-spinner').style.display = 'none';
                            progressFill.style.width = percentComplete + '%';
                            progressText.textContent = percentComplete + '%';
                        }
                    }
                };
                
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const blob = xhr.response;
                        const blobUrl = URL.createObjectURL(blob);
                        resolve(blobUrl);
                    } else {
                        reject(new Error('Failed to load image'));
                    }
                };
                
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.ontimeout = () => reject(new Error('Request timeout'));
                xhr.timeout = 30000; // 30 second timeout
                
                xhr.send();
            });
        };
        
        // Handle high-res image loading
        img.onload = function() {
            loadingIndicator.remove();
            placeholderCanvas.remove();
            img.classList.remove('hidden');
            // Smooth transition from blur
            if (img.style.filter) {
                requestAnimationFrame(() => {
                    img.style.filter = 'none';
                });
            }
            // Clean up blob URL if used
            if (img.src.startsWith('blob:')) {
                setTimeout(() => URL.revokeObjectURL(img.src), 1000);
            }
        };
        
        img.onerror = function() {
            loadingIndicator.remove();
            placeholderCanvas.remove();
            
            // Determine error type
            const errorType = img.dataset.errorType || 'unknown';
            let errorMessage = 'We couldn\'t load the image for this artwork.';
            let errorDetails = '';
            
            if (errorType === 'timeout') {
                errorMessage = 'Image loading timed out';
                errorDetails = 'The image is taking too long to load. This might be due to a slow connection.';
            } else if (errorType === 'proxy') {
                errorDetails = 'Our image proxy service is having issues. Please try again in a moment.';
            } else if (!navigator.onLine) {
                errorMessage = 'You appear to be offline';
                errorDetails = 'Please check your internet connection and try again.';
            } else {
                errorDetails = 'This may be due to network issues or the image being temporarily unavailable.';
            }
            
            // Check if we have a small image as fallback
            if (artwork.primaryImageSmall && artwork.primaryImageSmall !== highResImg && !img.dataset.smallImageTried) {
                window.MetLogger?.log('High-res proxy failed, trying small image through proxy');
                img.dataset.smallImageTried = 'true';
                const smallProxyUrl = window.MetAPI.loadArtworkImage(artwork.primaryImageSmall);
                img.src = smallProxyUrl;
                return;
            }
            
            // All image loading attempts failed - show enhanced error state
            imgContainer.innerHTML = `
                <div class="artwork-placeholder artwork-placeholder-error">
                    <div class="placeholder-icon">
                        <i class="fas fa-image"></i>
                        <i class="fas fa-exclamation-circle error-badge"></i>
                    </div>
                    <h3>${errorMessage}</h3>
                    <p class="error-details">${errorDetails}</p>
                    <div class="placeholder-actions">
                        <button class="retry-button primary" id="retryImageBtn">
                            <i class="fas fa-redo"></i> Try Again
                        </button>
                        <button class="retry-button secondary" id="retryDifferentBtn">
                            <i class="fas fa-server"></i> Try Different Server
                        </button>
                        <a href="${artwork.objectURL}" target="_blank" class="view-met-link">
                            <i class="fas fa-external-link-alt"></i> View on Met Website
                        </a>
                    </div>
                </div>
            `;
            
            // Add retry button functionality
            const retryBtn = imgContainer.querySelector('#retryImageBtn');
            const retryDifferentBtn = imgContainer.querySelector('#retryDifferentBtn');
            
            if (retryBtn) {
                let retryCount = 0;
                retryBtn.addEventListener('click', async function() {
                    retryCount++;
                    retryBtn.disabled = true;
                    retryDifferentBtn.disabled = true;
                    retryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retrying...';
                    
                    // Wait with exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    displayArtwork(artwork);
                });
            }
            
            if (retryDifferentBtn) {
                retryDifferentBtn.addEventListener('click', async function() {
                    retryBtn.disabled = true;
                    retryDifferentBtn.disabled = true;
                    retryDifferentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Switching...';
                    
                    // Force proxy rotation
                    if (window.MetAPI && window.MetAPI.rotateProxy) {
                        await window.MetAPI.rotateProxy();
                    }
                    
                    displayArtwork(artwork);
                });
            }
            
            window.MetLogger?.error(`Failed to load image through proxy: ${artwork.primaryImage}`);
            
            // Report to analytics if available
            if (window.MetAnalytics && window.MetAnalytics.trackImageLoadError) {
                window.MetAnalytics.trackImageLoadError(artwork.objectID, artwork.primaryImage);
            }
        };
        
        // Set loading attribute for lazy loading
        img.loading = 'lazy';
        img.decoding = 'async';
        
        // Smart proxy selection for image loading with progress tracking
        const loadImageWithProxy = async () => {
            try {
                const proxyUrl = window.MetAPI.loadArtworkImage(highResImg);
                window.MetLogger?.log(`Loading image via proxy: ${proxyUrl}`);
                
                // Try to load with progress tracking for large images
                if (artwork.primaryImage && !artwork.primaryImageSmall) {
                    // No small image, might be large - use XHR for progress
                    try {
                        const blobUrl = await loadImageWithProgress(proxyUrl);
                        img.src = blobUrl;
                        return;
                    } catch (xhrError) {
                        window.MetLogger?.warn('Progress loading failed, falling back to regular load:', xhrError);
                    }
                }
                
                // Regular loading
                img.src = proxyUrl;
                
                // Set a timeout for initial load attempt
                const loadTimeout = setTimeout(() => {
                    if (!img.complete || img.naturalWidth === 0) {
                        window.MetLogger?.log('Image loading timeout, trying fallback...');
                        img.dataset.errorType = 'timeout';
                        tryFallbackProxy();
                    }
                }, 15000); // 15 second timeout
                
                // Clear timeout if image loads successfully
                img.addEventListener('load', () => clearTimeout(loadTimeout), { once: true });
                img.addEventListener('error', () => {
                    clearTimeout(loadTimeout);
                    img.dataset.errorType = 'proxy';
                }, { once: true });
            } catch (error) {
                window.MetLogger?.error('Error setting up image load:', error);
                img.dataset.errorType = 'proxy';
                tryFallbackProxy();
            }
        };
        
        const tryFallbackProxy = async () => {
            if (window.MetAPI.loadArtworkImageWithFallback) {
                const fallbackUrl = await window.MetAPI.loadArtworkImageWithFallback(highResImg);
                if (fallbackUrl) {
                    img.src = fallbackUrl;
                    window.MetLogger?.log('Using fallback proxy URL:', fallbackUrl);
                }
            }
        };
        
        // Add intersection observer for better performance
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Load high-res image when in viewport
                        loadImageWithProxy();
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px' // Start loading 50px before entering viewport
            });
            
            imgContainer.appendChild(img);
            artworkContainer.appendChild(imgContainer);
            imageObserver.observe(img);
        } else {
            // Fallback for browsers without IntersectionObserver
            imgContainer.appendChild(img);
            artworkContainer.appendChild(imgContainer);
            loadImageWithProxy();
        }
    } else {
        // Display placeholder if no image available
        const placeholder = document.createElement('div');
        placeholder.className = 'artwork-placeholder';
        placeholder.innerHTML = `
            <i class="fas fa-paint-brush"></i>
            <p>No image available for this artwork</p>
        `;
        artworkContainer.appendChild(placeholder);
    }
    
    // Check if artwork is favorited
    let isFavorited = false;
    if (window.MetFavorites) {
        try {
            isFavorited = await window.MetFavorites.isFavorited(artwork.objectID);
        } catch (error) {
            window.MetLogger?.error('Error checking favorite status:', error);
        }
    }
    
    // Create artwork info content with favorite button
    const infoHTML = `
        <div class="artwork-info-header">
            <h2 class="artwork-title">${artwork.title || 'Untitled'}</h2>
            <button class="favorite-button ${isFavorited ? 'favorited' : ''}" 
                    id="favoriteBtn" 
                    data-object-id="${artwork.objectID}"
                    title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
                <i class="fas fa-heart"></i>
                <span class="favorite-button-text">${isFavorited ? 'Favorited' : 'Favorite'}</span>
            </button>
        </div>
        ${artwork.artistDisplayName ? `<p class="artwork-artist">${artwork.artistDisplayName}</p>` : ''}
        ${artwork.objectDate ? `<p class="artwork-date">${artwork.objectDate}</p>` : ''}
        ${artwork.medium ? `<p class="artwork-medium">${artwork.medium}</p>` : ''}
        ${artwork.dimensions ? `<p class="artwork-dimensions">${artwork.dimensions}</p>` : ''}
        ${artwork.department ? `<p class="artwork-department">${artwork.department}</p>` : ''}
        ${artwork.creditLine ? `<p class="artwork-credit">${artwork.creditLine}</p>` : ''}
        <p class="artwork-link"><a href="${artwork.objectURL}" target="_blank">View on The Met website</a></p>
    `;
    
    // Add info to container
    artworkInfo.innerHTML = infoHTML;
    
    // Add favorite button functionality
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn && window.MetFavorites) {
        favoriteBtn.addEventListener('click', async () => {
            try {
                // Disable button during operation
                favoriteBtn.disabled = true;
                
                // Toggle favorite status
                const newStatus = await window.MetFavorites.toggleFavorite(artwork);
                
                // Update button appearance
                if (newStatus) {
                    favoriteBtn.classList.add('favorited');
                    favoriteBtn.title = 'Remove from favorites';
                    favoriteBtn.querySelector('.favorite-button-text').textContent = 'Favorited';
                    
                    // Add animation
                    favoriteBtn.classList.add('favorite-animation');
                    setTimeout(() => {
                        favoriteBtn.classList.remove('favorite-animation');
                    }, 600);
                    
                    // Show success message
                    if (window.MetUI && window.MetUI.updateStatus) {
                        window.MetUI.updateStatus('Added to favorites', 'success');
                    }
                } else {
                    favoriteBtn.classList.remove('favorited');
                    favoriteBtn.title = 'Add to favorites';
                    favoriteBtn.querySelector('.favorite-button-text').textContent = 'Favorite';
                    
                    // Show removal message
                    if (window.MetUI && window.MetUI.updateStatus) {
                        window.MetUI.updateStatus('Removed from favorites', 'info');
                    }
                }
                
                // Re-enable button
                favoriteBtn.disabled = false;
            } catch (error) {
                window.MetLogger?.error('Error toggling favorite:', error);
                favoriteBtn.disabled = false;
                
                if (window.MetUI && window.MetUI.updateStatus) {
                    window.MetUI.updateStatus('Error updating favorites', 'error');
                }
            }
        });
    }
    
    // Log the displayed artwork
    window.MetLogger?.log('Displayed artwork:', artwork);
}

// Display favorite artwork from stored data
function displayFavoriteArtwork(favorite) {
    // Convert favorite data back to artwork format
    const artwork = {
        objectID: favorite.objectID,
        title: favorite.title,
        artistDisplayName: favorite.artistDisplayName,
        objectDate: favorite.objectDate,
        department: favorite.department,
        medium: favorite.medium,
        primaryImage: favorite.primaryImage,
        primaryImageSmall: favorite.primaryImageSmall,
        objectURL: favorite.objectURL,
        dimensions: favorite.dimensions,
        creditLine: favorite.creditLine,
        artistNationality: favorite.artistNationality,
        artistBeginDate: favorite.artistBeginDate,
        artistEndDate: favorite.artistEndDate,
        objectBeginDate: favorite.objectBeginDate,
        objectEndDate: favorite.objectEndDate,
        repository: favorite.repository,
        isHighlight: favorite.isHighlight,
        isPublicDomain: favorite.isPublicDomain
    };
    
    displayArtwork(artwork);
}

// Make functions available globally
window.MetArtwork = {
    displayArtwork,
    displayFavoriteArtwork
};