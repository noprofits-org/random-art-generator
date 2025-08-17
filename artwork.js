// artwork.js - Functions for displaying artwork

// Display the artwork in the UI
async function displayArtwork(artwork) {
    if (!artwork) {
        console.error('No artwork data provided');
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
        
        // Create loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-spinner';
        imgContainer.appendChild(loadingIndicator);
        
        // Create the image element
        const img = document.createElement('img');
        img.className = 'artwork-image hidden';
        img.alt = artwork.title || 'Artwork from The Metropolitan Museum of Art';
        
        // Use progressive image loading
        const lowResImg = artwork.primaryImageSmall || artwork.primaryImage;
        const highResImg = artwork.primaryImage;
        
        // Load low-res first if available
        if (lowResImg !== highResImg && artwork.primaryImageSmall) {
            const placeholder = new Image();
            placeholder.src = window.MetAPI.loadArtworkImage(lowResImg);
            placeholder.onload = () => {
                img.style.filter = 'blur(5px)';
                img.style.transition = 'filter 0.3s';
                img.src = placeholder.src;
                img.classList.remove('hidden');
            };
        }
        
        // Handle high-res image loading
        img.onload = function() {
            loadingIndicator.remove();
            img.classList.remove('hidden');
            // Remove blur when high-res loads
            if (img.style.filter) {
                setTimeout(() => {
                    img.style.filter = '';
                }, 100);
            }
        };
        
        img.onerror = function() {
            // FIXED: Removed direct URL fallback that won't work due to CORS
            // Instead, try alternative proxy or show better placeholder
            loadingIndicator.remove();
            
            // Check if we have a small image as fallback
            if (artwork.primaryImageSmall && artwork.primaryImageSmall !== highResImg && !img.dataset.smallImageTried) {
                console.log('High-res proxy failed, trying small image through proxy');
                img.dataset.smallImageTried = 'true';
                const smallProxyUrl = window.MetAPI.loadArtworkImage(artwork.primaryImageSmall);
                img.src = smallProxyUrl;
                return;
            }
            
            // All image loading attempts failed - show enhanced placeholder
            imgContainer.innerHTML = `
                <div class="artwork-placeholder artwork-placeholder-error">
                    <div class="placeholder-icon">
                        <i class="fas fa-image"></i>
                        <i class="fas fa-exclamation-circle error-badge"></i>
                    </div>
                    <h3>Image Unavailable</h3>
                    <p>We couldn't load the image for this artwork.</p>
                    <p class="error-details">This may be due to network issues or proxy limitations.</p>
                    <div class="placeholder-actions">
                        <button class="retry-button" id="retryImageBtn">
                            <i class="fas fa-redo"></i> Try Again
                        </button>
                        <a href="${artwork.objectURL}" target="_blank" class="view-met-link">
                            <i class="fas fa-external-link-alt"></i> View on Met Website
                        </a>
                    </div>
                </div>
            `;
            
            // Add retry button functionality with exponential backoff
            const retryBtn = imgContainer.querySelector('#retryImageBtn');
            if (retryBtn) {
                let retryCount = 0;
                retryBtn.addEventListener('click', async function() {
                    retryCount++;
                    retryBtn.disabled = true;
                    retryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retrying...';
                    
                    // Wait with exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    displayArtwork(artwork);
                });
            }
            
            console.error(`Failed to load image through proxy: ${artwork.primaryImage}`);
            
            // Report to analytics if available
            if (window.MetAnalytics && window.MetAnalytics.trackImageLoadError) {
                window.MetAnalytics.trackImageLoadError(artwork.objectID, artwork.primaryImage);
            }
        };
        
        // Set loading attribute for lazy loading
        img.loading = 'lazy';
        img.decoding = 'async';
        
        // FIXED: Add smart proxy selection for image loading
        const loadImageWithProxy = async () => {
            try {
                // First try with current proxy
                const proxyUrl = window.MetAPI.loadArtworkImage(highResImg);
                img.src = proxyUrl;
                console.log(`Loading image via proxy: ${proxyUrl}`);
                
                // Set a timeout for initial load attempt
                const loadTimeout = setTimeout(() => {
                    // If image hasn't loaded in 10 seconds, try fallback
                    if (!img.complete || img.naturalWidth === 0) {
                        console.log('Initial proxy slow, trying fallback...');
                        tryFallbackProxy();
                    }
                }, 10000);
                
                // Clear timeout if image loads successfully
                img.addEventListener('load', () => clearTimeout(loadTimeout), { once: true });
            } catch (error) {
                console.error('Error setting up image load:', error);
                tryFallbackProxy();
            }
        };
        
        const tryFallbackProxy = async () => {
            if (window.MetAPI.loadArtworkImageWithFallback) {
                const fallbackUrl = await window.MetAPI.loadArtworkImageWithFallback(highResImg);
                if (fallbackUrl) {
                    img.src = fallbackUrl;
                    console.log('Using fallback proxy URL:', fallbackUrl);
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
            console.error('Error checking favorite status:', error);
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
                console.error('Error toggling favorite:', error);
                favoriteBtn.disabled = false;
                
                if (window.MetUI && window.MetUI.updateStatus) {
                    window.MetUI.updateStatus('Error updating favorites', 'error');
                }
            }
        });
    }
    
    // Log the displayed artwork
    console.log('Displayed artwork:', artwork);
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