// search-results.js - Handle search results display and interactions

// Search state
let currentSearchQuery = '';
let currentSearchResults = [];
let currentPage = 1;
const RESULTS_PER_PAGE = 20;

// Initialize search results functionality
function initSearchResults() {
    setupSearchResultsEvents();
}

// Set up event handlers for search results
function setupSearchResultsEvents() {
    // Pagination buttons
    const prevButton = document.getElementById('searchPrevPage');
    const nextButton = document.getElementById('searchNextPage');
    
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displaySearchResults();
            }
        });
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(currentSearchResults.length / RESULTS_PER_PAGE);
            if (currentPage < totalPages) {
                currentPage++;
                displaySearchResults();
            }
        });
    }
}

// Perform a search
async function performSearch(query, filters = {}) {
    if (!query || query === currentSearchQuery) {
        return;
    }
    
    currentSearchQuery = query;
    currentPage = 1;
    
    // Show loading state
    window.MetUI.showSearchLoading();
    
    try {
        // Get search results (object IDs)
        const searchFilters = { ...filters, searchQuery: query };
        const objectIds = await window.MetAPI.searchArtworks(searchFilters);
        
        if (!objectIds || objectIds.length === 0) {
            window.MetUI.showSearchEmpty(query);
            currentSearchResults = [];
            return;
        }
        
        // Limit to first 100 results for performance
        const limitedIds = objectIds.slice(0, 100);
        
        // Fetch details for the first page immediately
        const firstPageIds = limitedIds.slice(0, RESULTS_PER_PAGE);
        const firstPageDetails = await window.MetAPI.getObjectDetailsMultiple(firstPageIds);
        
        // Store all IDs but only the first page of details
        currentSearchResults = limitedIds.map((id, index) => {
            if (index < RESULTS_PER_PAGE) {
                return firstPageDetails.find(detail => detail.objectID === id) || { objectID: id };
            }
            return { objectID: id };
        });
        
        // Add search to history
        addToSearchHistory(query);
        
        // Display results
        displaySearchResults();
        
        // Fetch remaining details in the background
        if (limitedIds.length > RESULTS_PER_PAGE) {
            fetchRemainingDetails(limitedIds.slice(RESULTS_PER_PAGE));
        }
    } catch (error) {
        console.error('Search error:', error);
        window.MetUI.showSearchError();
    }
}

// Fetch remaining details in the background
async function fetchRemainingDetails(remainingIds) {
    try {
        const details = await window.MetAPI.getObjectDetailsMultiple(remainingIds);
        
        // Update the results array with the fetched details
        details.forEach(detail => {
            const index = currentSearchResults.findIndex(r => r.objectID === detail.objectID);
            if (index !== -1) {
                currentSearchResults[index] = detail;
            }
        });
    } catch (error) {
        console.error('Error fetching remaining details:', error);
    }
}

// Display search results for the current page
function displaySearchResults() {
    const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
    const endIndex = startIndex + RESULTS_PER_PAGE;
    const pageResults = currentSearchResults.slice(startIndex, endIndex);
    
    // Check if we need to fetch details for this page
    const needsDetails = pageResults.filter(r => !r.title).map(r => r.objectID);
    
    if (needsDetails.length > 0) {
        // Fetch details for this page
        window.MetAPI.getObjectDetailsMultiple(needsDetails).then(details => {
            details.forEach(detail => {
                const index = currentSearchResults.findIndex(r => r.objectID === detail.objectID);
                if (index !== -1) {
                    currentSearchResults[index] = detail;
                }
            });
            
            // Re-display with the updated details
            renderSearchResults();
        });
    } else {
        renderSearchResults();
    }
}

// Render the search results
function renderSearchResults() {
    const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
    const endIndex = startIndex + RESULTS_PER_PAGE;
    const pageResults = currentSearchResults.slice(startIndex, endIndex);
    
    const resultsGrid = document.getElementById('searchResultsGrid');
    if (!resultsGrid) return;
    
    // Clear existing results
    resultsGrid.innerHTML = '';
    
    // Create result items
    pageResults.forEach(artwork => {
        const resultItem = createSearchResultItem(artwork);
        resultsGrid.appendChild(resultItem);
    });
    
    // Update UI
    window.MetUI.showSearchResults(currentSearchResults.length, currentSearchQuery);
    updatePagination();
}

// Create a search result item element
function createSearchResultItem(artwork) {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.dataset.objectId = artwork.objectID;
    
    // Create image
    const imageDiv = document.createElement('div');
    imageDiv.className = 'search-result-image-container';
    
    if (artwork.primaryImageSmall) {
        const img = document.createElement('img');
        img.className = 'search-result-image';
        img.src = window.MetAPI.loadArtworkImage(artwork.primaryImageSmall);
        img.alt = artwork.title || 'Artwork';
        img.loading = 'lazy';
        imageDiv.appendChild(img);
    } else {
        imageDiv.innerHTML = '<div class="search-result-placeholder"><i class="fas fa-image"></i></div>';
    }
    
    item.appendChild(imageDiv);
    
    // Create info section
    const info = document.createElement('div');
    info.className = 'search-result-info';
    
    const title = document.createElement('div');
    title.className = 'search-result-title';
    title.textContent = artwork.title || 'Untitled';
    info.appendChild(title);
    
    if (artwork.artistDisplayName) {
        const artist = document.createElement('div');
        artist.className = 'search-result-artist';
        artist.textContent = artwork.artistDisplayName;
        info.appendChild(artist);
    }
    
    if (artwork.objectDate) {
        const date = document.createElement('div');
        date.className = 'search-result-date';
        date.textContent = artwork.objectDate;
        info.appendChild(date);
    }
    
    item.appendChild(info);
    
    // Add click handler
    item.addEventListener('click', () => {
        viewArtworkFromSearch(artwork.objectID);
    });
    
    return item;
}

// View an artwork from search results
async function viewArtworkFromSearch(objectId) {
    // Find the artwork in our results
    const artwork = currentSearchResults.find(r => r.objectID === objectId);
    
    if (artwork && artwork.title) {
        // We already have the details
        window.MetUI.showSearchMode(false);
        window.MetArtwork.displayArtwork(artwork);
    } else {
        // Need to fetch details
        window.MetUI.showLoading();
        try {
            const details = await window.MetAPI.getObjectDetails(objectId);
            if (details) {
                window.MetUI.showSearchMode(false);
                window.MetArtwork.displayArtwork(details);
            }
        } catch (error) {
            console.error('Error loading artwork:', error);
            window.MetUI.showError('Failed to load artwork details');
        }
        window.MetUI.hideLoading();
    }
}

// Update pagination controls
function updatePagination() {
    const totalPages = Math.ceil(currentSearchResults.length / RESULTS_PER_PAGE);
    const prevButton = document.getElementById('searchPrevPage');
    const nextButton = document.getElementById('searchNextPage');
    const pageInfo = document.getElementById('searchPageInfo');
    
    if (prevButton) {
        prevButton.disabled = currentPage === 1;
    }
    
    if (nextButton) {
        nextButton.disabled = currentPage === totalPages;
    }
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
}

// Search history management
const SEARCH_HISTORY_KEY = 'metArtSearchHistory';
const MAX_SEARCH_HISTORY = 10;

function getSearchHistory() {
    try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error('Error reading search history:', error);
        return [];
    }
}

function addToSearchHistory(query) {
    try {
        let history = getSearchHistory();
        
        // Remove duplicate if exists
        history = history.filter(item => item !== query);
        
        // Add to beginning
        history.unshift(query);
        
        // Limit to max items
        if (history.length > MAX_SEARCH_HISTORY) {
            history = history.slice(0, MAX_SEARCH_HISTORY);
        }
        
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
        
        // Update UI
        displaySearchHistory();
    } catch (error) {
        console.error('Error saving search history:', error);
    }
}

function clearSearchHistory() {
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
        displaySearchHistory();
    } catch (error) {
        console.error('Error clearing search history:', error);
    }
}

function displaySearchHistory() {
    const historyContainer = document.getElementById('searchHistoryItems');
    if (!historyContainer) return;
    
    const history = getSearchHistory();
    
    if (history.length === 0) {
        historyContainer.innerHTML = '<div class="search-history-empty">No recent searches</div>';
        return;
    }
    
    historyContainer.innerHTML = '';
    
    history.forEach(query => {
        const item = document.createElement('div');
        item.className = 'search-history-item';
        item.textContent = query;
        item.addEventListener('click', () => {
            document.getElementById('searchInput').value = query;
            performSearch(query, window.MetFilters.getCurrentFilters());
        });
        historyContainer.appendChild(item);
    });
}

// Clear current search
function clearSearch() {
    currentSearchQuery = '';
    currentSearchResults = [];
    currentPage = 1;
    window.MetUI.showSearchMode(false);
}

// Make functions available globally
window.MetSearch = {
    initSearchResults,
    performSearch,
    clearSearch,
    displaySearchHistory,
    clearSearchHistory,
    viewArtworkFromSearch
};