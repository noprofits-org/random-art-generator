// UI related functions

// Initialize UI elements and event listeners
function initUI() {
    // Get references to DOM elements
    const toggleDrawerButton = document.getElementById('toggleDrawer');
    const controlsDrawer = document.getElementById('controlsDrawer');
    const contentArea = document.getElementById('contentArea');

    // Toggle drawer state when the button is clicked
    toggleDrawerButton.addEventListener('click', () => {
        controlsDrawer.classList.toggle('collapsed');
        
        // Check if drawer is now collapsed
        const isCollapsed = controlsDrawer.classList.contains('collapsed');
        
        // Update the button icon
        const iconElement = toggleDrawerButton.querySelector('i');
        if (isCollapsed) {
            iconElement.classList.remove('fa-chevron-left');
            iconElement.classList.add('fa-chevron-right');
        } else {
            iconElement.classList.remove('fa-chevron-right');
            iconElement.classList.add('fa-chevron-left');
        }
        
        // Adjust content area on mobile if needed
        if (window.innerWidth <= 768) {
            contentArea.style.marginLeft = isCollapsed ? '0' : `${controlsDrawer.offsetWidth}px`;
        }
    });

    // Handle window resize for responsive behavior
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            if (controlsDrawer.classList.contains('collapsed')) {
                contentArea.style.marginLeft = '0';
            } else {
                contentArea.style.marginLeft = `${controlsDrawer.offsetWidth}px`;
            }
        } else {
            contentArea.style.marginLeft = '0'; // Reset margin on larger screens
        }
    });
    
    // Add a status indicator to the UI
    addStatusIndicator();
}

// Add a status indicator to the bottom of the screen
function addStatusIndicator() {
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'statusIndicator';
    statusIndicator.className = 'status-indicator';
    statusIndicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Ready</span>';
    document.body.appendChild(statusIndicator);
}

// Update the status indicator
function updateStatus(message, type = 'info') {
    const statusIndicator = document.getElementById('statusIndicator');
    if (!statusIndicator) return;
    
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');
    
    // Update status text
    statusText.textContent = message;
    
    // Update status type
    statusIndicator.className = `status-indicator ${type}`;
    
    // Make the status visible
    statusIndicator.style.opacity = '1';
    
    // Auto-hide info messages after 5 seconds
    if (type === 'info') {
        setTimeout(() => {
            statusIndicator.style.opacity = '0';
        }, 5000);
    }
}

// Show API connection status
function showConnectionStatus(isConnected) {
    const statusIndicator = document.getElementById('statusIndicator');
    if (!statusIndicator) return;

    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');

    // Update status text and dot based on connection
    statusText.textContent = isConnected ? 'Connected to Met API' : 'Disconnected from Met API';
    statusIndicator.className = `status-indicator ${isConnected ? 'success' : 'error'}`;
    statusDot.style.backgroundColor = isConnected ? '#28a745' : '#dc3545';

    // Make the status visible
    statusIndicator.style.opacity = '1';

    // Auto-hide after 5 seconds if connected
    if (isConnected) {
        setTimeout(() => {
            statusIndicator.style.opacity = '0';
        }, 5000);
    }
}

// Show loading state
function showLoading() {
    const artworkContainer = document.getElementById('artworkContainer');
    
    // Create loading element if it doesn't exist
    let loadingElement = document.querySelector('.loading');
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.className = 'loading';
        loadingElement.innerHTML = '<div class="loading-spinner"></div><p class="loading-text">Fetching artwork...</p>';
        artworkContainer.appendChild(loadingElement);
    } else {
        // Update loading message
        const loadingText = loadingElement.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Fetching artwork...';
        }
    }
    
    // Show the loading element
    loadingElement.style.display = 'flex';
    
    // Update status
    updateStatus('Loading...', 'loading');
}

// Update loading message
function updateLoadingMessage(message) {
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        const loadingText = loadingElement.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        } else {
            const newLoadingText = document.createElement('p');
            newLoadingText.className = 'loading-text';
            newLoadingText.textContent = message;
            loadingElement.appendChild(newLoadingText);
        }
    }
    
    // Update status
    updateStatus(message, 'loading');
}

// Hide loading state
function hideLoading() {
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    // Update status
    updateStatus('Ready', 'info');
}

// Show error message
function showError(message) {
    const artworkContainer = document.getElementById('artworkContainer');
    
    // Create error element
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    
    // Add error message
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    errorElement.appendChild(messageElement);
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.textContent = 'Try Again';
    retryButton.addEventListener('click', () => {
        // Get current filters and try again
        const filters = window.MetFilters ? window.MetFilters.getCurrentFilters() : {};
        
        if (window.MetAPI) {
            // Clear error message
            artworkContainer.innerHTML = '';
            
            // Add placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'artwork-placeholder';
            placeholder.innerHTML = `
                <i class="fas fa-paint-brush"></i>
                <p>Retrying...</p>
            `;
            artworkContainer.appendChild(placeholder);
            
            // Get random artwork with the selected filters
            setTimeout(async () => {
                const artwork = await window.MetAPI.getRandomArtwork(filters);
                
                // Display the artwork if we got one
                if (artwork && window.MetArtwork) {
                    window.MetArtwork.displayArtwork(artwork);
                }
            }, 500);
        }
    });
    errorElement.appendChild(retryButton);
    
    // Add button to try without filters
    const noFiltersButton = document.createElement('button');
    noFiltersButton.className = 'retry-button no-filters';
    noFiltersButton.textContent = 'Try Without Filters';
    noFiltersButton.addEventListener('click', () => {
        if (window.MetAPI) {
            // Clear error message
            artworkContainer.innerHTML = '';
            
            // Add placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'artwork-placeholder';
            placeholder.innerHTML = `
                <i class="fas fa-paint-brush"></i>
                <p>Fetching any artwork...</p>
            `;
            artworkContainer.appendChild(placeholder);
            
            // Get random artwork without filters
            setTimeout(async () => {
                // Reset department dropdown to "Any Department"
                const departmentSelect = document.getElementById('departmentSelect');
                if (departmentSelect) {
                    departmentSelect.value = '';
                }
                
                // Reset date inputs
                const dateBeginInput = document.getElementById('dateBegin');
                const dateEndInput = document.getElementById('dateEnd');
                if (dateBeginInput) dateBeginInput.value = '';
                if (dateEndInput) dateEndInput.value = '';
                
                // Reset medium dropdown to "Any Medium"
                const mediumSelect = document.getElementById('mediumSelect');
                if (mediumSelect) {
                    mediumSelect.value = '';
                }
                
                // Get random artwork with no filters
                const artwork = await window.MetAPI.getRandomArtwork({});
                
                // Display the artwork if we got one
                if (artwork && window.MetArtwork) {
                    window.MetArtwork.displayArtwork(artwork);
                }
            }, 500);
        }
    });
    errorElement.appendChild(noFiltersButton);
    
    // Clear container and add error
    artworkContainer.innerHTML = '';
    artworkContainer.appendChild(errorElement);
    
    // Update status
    updateStatus(message, 'error');
}

// Wait for DOM to be fully loaded before initializing UI
document.addEventListener('DOMContentLoaded', initUI);

// Make functions available globally
window.MetUI = {
    showLoading,
    updateLoadingMessage,
    hideLoading,
    showError,
    updateStatus,
    showConnectionStatus
};