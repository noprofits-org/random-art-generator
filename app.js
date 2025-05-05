// Main application entry point

// Initialize the application
async function initApp() {
    console.log('Met Art Generator application initialized');

    // Define the proxy URL
    const PROXY_URL = 'https://cors-proxy-xi-ten.vercel.app/api/proxy';
    
    // Test if the proxy is working at all
    fetch(`${PROXY_URL}?url=${encodeURIComponent('https://collectionapi.metmuseum.org/public/collection/v1/departments')}`)
        .then(response => response.json())
        .then(data => console.log('Proxy test successful:', data))
        .catch(error => console.error('Proxy test failed:', error));

    // Test API connection on startup
    if (window.MetAPI) {
        try {
            window.MetUI.showLoading();
            window.MetUI.updateLoadingMessage('Connecting to Met API...');

            const apiResult = await window.MetAPI.testApiConnection();

            if (apiResult) {
                console.log('Connected to Met API successfully!');
                // Check if showConnectionStatus exists, fallback to updateStatus
                if (window.MetUI.showConnectionStatus) {
                    window.MetUI.showConnectionStatus(true);
                } else {
                    window.MetUI.updateStatus('Connected to Met API', 'success');
                }

                // Initialize filters after confirming API connection
                if (window.MetFilters) {
                    await window.MetFilters.initFilters();
                }

                window.MetUI.hideLoading();

                // Display departments in the console if available
                if (apiResult.departments && apiResult.departments.length > 0) {
                    console.log('Available departments:', apiResult.departments);
                }
            } else {
                console.error('Failed to connect to Met API');
                // Check if showConnectionStatus exists, fallback to updateStatus
                if (window.MetUI.showConnectionStatus) {
                    window.MetUI.showConnectionStatus(false);
                } else {
                    window.MetUI.updateStatus('Disconnected from Met API', 'error');
                }
                window.MetUI.hideLoading();
                window.MetUI.showError('Unable to connect to the Metropolitan Museum API. Please try again later.');
            }
        } catch (error) {
            console.error('Error during initialization:', error);
            // Check if showConnectionStatus exists, fallback to updateStatus
            if (window.MetUI.showConnectionStatus) {
                window.MetUI.showConnectionStatus(false);
            } else {
                window.MetUI.updateStatus('Disconnected from Met API', 'error');
            }
            window.MetUI.hideLoading();
            window.MetUI.showError('Error connecting to the Metropolitan Museum API: ' + error.message);
        }
    }

    // Set up the random artwork button
    const randomArtButton = document.getElementById('randomArtButton');
    if (randomArtButton) {
        randomArtButton.addEventListener('click', async () => {
            console.log('Random artwork button clicked');

            // Get current filters
            const filters = window.MetFilters ? window.MetFilters.getCurrentFilters() : {};
            console.log('Current filters:', filters);

            // Get random artwork with the selected filters
            if (window.MetAPI) {
                // Show loading message
                window.MetUI.showLoading();
                window.MetUI.updateLoadingMessage('Finding the perfect artwork for you...');

                // Add a slight delay so user can see the loading state
                setTimeout(async () => {
                    try {
                        const artwork = await window.MetAPI.getRandomArtwork(filters);

                        // Display the artwork if we got one
                        if (artwork && window.MetArtwork) {
                            window.MetArtwork.displayArtwork(artwork);
                        }
                    } catch (error) {
                        console.error('Error getting random artwork:', error);
                        window.MetUI.hideLoading();
                        window.MetUI.showError('Error fetching artwork: ' + error.message);
                    }
                }, 500);
            }
        });
    }

    // Add keyboard shortcut for random artwork (press spacebar)
    document.addEventListener('keydown', (event) => {
        // Check if spacebar was pressed and we're not in an input field
        if (event.code === 'Space' &&
            document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'TEXTAREA' &&
            document.activeElement.tagName !== 'SELECT') {

            // Prevent default spacebar action (like scrolling)
            event.preventDefault();

            // Trigger the random artwork button click
            randomArtButton.click();
        }
    });
}

// Initialize the app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);