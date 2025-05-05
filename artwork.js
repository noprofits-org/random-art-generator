// artwork.js - Functions for displaying artwork

// Display the artwork in the UI
function displayArtwork(artwork) {
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
        
        // Handle image loading
        img.onload = function() {
            // Remove loading indicator and show image when loaded
            loadingIndicator.remove();
            img.classList.remove('hidden');
        };
        
        img.onerror = function() {
            // Handle image loading error
            loadingIndicator.remove();
            imgContainer.innerHTML = `
                <div class="artwork-placeholder">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Image failed to load</p>
                    <button class="retry-button" id="retryImageBtn">Retry Image</button>
                </div>
            `;
            
            // Add retry button functionality
            const retryBtn = imgContainer.querySelector('#retryImageBtn');
            if (retryBtn) {
                retryBtn.addEventListener('click', function() {
                    displayArtwork(artwork);
                });
            }
            
            console.error(`Failed to load image: ${artwork.primaryImage}`);
        };
        
        // Create direct URL and proxy URL for failover
        const directUrl = artwork.primaryImage;
        const proxyUrl = window.MetAPI.loadArtworkImage(artwork.primaryImage);
        
        // Try loading with proxy URL first
        img.src = proxyUrl;
        console.log(`Loading image via proxy: ${proxyUrl}`);
        
        // Add image to container
        imgContainer.appendChild(img);
        artworkContainer.appendChild(imgContainer);
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
    
    // Create artwork info content
    const infoHTML = `
        <h2 class="artwork-title">${artwork.title || 'Untitled'}</h2>
        ${artwork.artistDisplayName ? `<p class="artwork-artist">${artwork.artistDisplayName}</p>` : ''}
        ${artwork.objectDate ? `<p class="artwork-date">${artwork.objectDate}</p>` : ''}
        ${artwork.medium ? `<p class="artwork-medium">${artwork.medium}</p>` : ''}
        ${artwork.department ? `<p class="artwork-department">${artwork.department}</p>` : ''}
        <p class="artwork-link"><a href="${artwork.objectURL}" target="_blank">View on The Met website</a></p>
    `;
    
    // Add info to container
    artworkInfo.innerHTML = infoHTML;
    
    // Log the displayed artwork
    console.log('Displayed artwork:', artwork);
}

// Make functions available globally
window.MetArtwork = {
    displayArtwork
};