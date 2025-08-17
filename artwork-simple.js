// artwork-simple.js - Simplified artwork display functionality

(function() {
    'use strict';
    
    // Display artwork in the UI
    async function displayArtwork(artwork) {
        if (!artwork) {
            window.MetLogger?.error('No artwork data provided');
            return;
        }
        
        // Get container elements
        const artworkContainer = document.getElementById('artworkContainer');
        const artworkInfo = document.getElementById('artworkInfo');
        
        if (!artworkContainer || !artworkInfo) {
            window.MetLogger?.error('Artwork container elements not found');
            return;
        }
        
        // Clear previous content
        artworkContainer.innerHTML = '';
        artworkInfo.innerHTML = '';
        
        // Display the image
        if (artwork.primaryImage || artwork.primaryImageSmall) {
            displayArtworkImage(artworkContainer, artwork);
        } else {
            showNoImagePlaceholder(artworkContainer);
        }
        
        // Display the metadata
        displayArtworkInfo(artworkInfo, artwork);
        
        // Update favorite button state
        updateFavoriteButton(artwork);
        
        window.MetLogger?.log('Artwork displayed:', artwork.title || 'Untitled');
    }
    
    // Display artwork image
    function displayArtworkImage(container, artwork) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'artwork-image-container';
        
        // Loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-spinner';
        imgContainer.appendChild(loadingIndicator);
        
        // Create image
        const img = document.createElement('img');
        img.className = 'artwork-image hidden';
        img.alt = artwork.title || 'Artwork from The Metropolitan Museum of Art';
        
        // Load image
        const imageUrl = artwork.primaryImage || artwork.primaryImageSmall;
        const proxiedUrl = window.MetAPI.loadArtworkImage(imageUrl);
        
        img.onload = () => {
            loadingIndicator.remove();
            img.classList.remove('hidden');
        };
        
        img.onerror = () => {
            window.MetLogger?.error('Failed to load artwork image');
            showNoImagePlaceholder(container);
        };
        
        img.src = proxiedUrl;
        imgContainer.appendChild(img);
        container.appendChild(imgContainer);
    }
    
    // Show placeholder when no image
    function showNoImagePlaceholder(container) {
        container.innerHTML = `
            <div class="no-image-placeholder">
                <i class="fas fa-image"></i>
                <p>No image available</p>
            </div>
        `;
    }
    
    // Display artwork metadata
    function displayArtworkInfo(container, artwork) {
        const info = document.createElement('div');
        info.className = 'artwork-details';
        
        // Title
        const title = document.createElement('h2');
        title.className = 'artwork-title';
        title.textContent = artwork.title || 'Untitled';
        info.appendChild(title);
        
        // Artist
        if (artwork.artistDisplayName) {
            const artist = document.createElement('p');
            artist.className = 'artwork-artist';
            artist.innerHTML = `<strong>Artist:</strong> ${artwork.artistDisplayName}`;
            if (artwork.artistDisplayBio) {
                artist.innerHTML += `<br><span class="artist-bio">${artwork.artistDisplayBio}</span>`;
            }
            info.appendChild(artist);
        }
        
        // Date
        if (artwork.objectDate) {
            const date = document.createElement('p');
            date.className = 'artwork-date';
            date.innerHTML = `<strong>Date:</strong> ${artwork.objectDate}`;
            info.appendChild(date);
        }
        
        // Medium
        if (artwork.medium) {
            const medium = document.createElement('p');
            medium.className = 'artwork-medium';
            medium.innerHTML = `<strong>Medium:</strong> ${artwork.medium}`;
            info.appendChild(medium);
        }
        
        // Department
        if (artwork.department) {
            const dept = document.createElement('p');
            dept.className = 'artwork-department';
            dept.innerHTML = `<strong>Department:</strong> ${artwork.department}`;
            info.appendChild(dept);
        }
        
        // Favorite button
        const favoriteBtn = document.createElement('button');
        favoriteBtn.id = 'favoriteButton';
        favoriteBtn.className = 'favorite-button';
        favoriteBtn.setAttribute('data-object-id', artwork.objectID);
        favoriteBtn.innerHTML = '<i class="far fa-heart"></i> Add to Favorites';
        favoriteBtn.onclick = () => toggleFavorite(artwork);
        info.appendChild(favoriteBtn);
        
        // Museum link
        if (artwork.objectURL) {
            const link = document.createElement('a');
            link.href = artwork.objectURL;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'museum-link';
            link.innerHTML = '<i class="fas fa-external-link-alt"></i> View on Met Museum website';
            info.appendChild(link);
        }
        
        container.appendChild(info);
    }
    
    // Update favorite button state
    async function updateFavoriteButton(artwork) {
        if (!window.MetFavorites) return;
        
        try {
            const isFavorited = await window.MetFavorites.isFavorited(artwork.objectID);
            const button = document.getElementById('favoriteButton');
            
            if (button) {
                if (isFavorited) {
                    button.innerHTML = '<i class="fas fa-heart"></i> Remove from Favorites';
                    button.classList.add('favorited');
                } else {
                    button.innerHTML = '<i class="far fa-heart"></i> Add to Favorites';
                    button.classList.remove('favorited');
                }
            }
        } catch (error) {
            window.MetLogger?.error('Error checking favorite status:', error);
        }
    }
    
    // Toggle favorite status
    async function toggleFavorite(artwork) {
        if (!window.MetFavorites) return;
        
        try {
            const result = await window.MetFavorites.toggleFavorite(artwork);
            
            if (result.added) {
                window.MetUI?.updateStatus?.('Added to favorites', 'success');
            } else {
                window.MetUI?.updateStatus?.('Removed from favorites', 'info');
            }
            
            updateFavoriteButton(artwork);
        } catch (error) {
            window.MetLogger?.error('Error toggling favorite:', error);
            window.MetUI?.updateStatus?.('Error updating favorites', 'error');
        }
    }
    
    // Public API
    window.MetArtwork = {
        displayArtwork
    };
    
})();