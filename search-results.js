// search-results.js - Handle search results display and interactions

// Search state
let currentSearchQuery = '';
let currentSearchType = 'quick';
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
async function performSearch(query, filters = {}, searchType = 'quick') {
    if (!query || (query === currentSearchQuery && searchType === currentSearchType)) {
        return;
    }
    
    currentSearchQuery = query;
    currentSearchType = searchType;
    currentPage = 1;
    
    // Show loading state
    window.MetUI.showSearchLoading();
    
    try {
        let objectIds = [];
        
        // Get search results based on type
        if (searchType === 'artist') {
            objectIds = await window.MetAPI.searchByArtist(query, filters);
        } else if (searchType === 'title') {
            objectIds = await window.MetAPI.searchByTitle(query, filters);
        } else {
            // Quick or advanced search
            const searchFilters = { ...filters, searchQuery: query };
            objectIds = await window.MetAPI.searchArtworks(searchFilters);
        }
        
        if (!objectIds || objectIds.length === 0) {
            window.MetUI.showSearchEmpty(query);
            currentSearchResults = [];
            return;
        }
        
        // Limit to first 100 results for performance
        const limitedIds = objectIds.slice(0, 100);
        
        // Fetch details for the first page immediately with relevance scoring
        const firstPageIds = limitedIds.slice(0, RESULTS_PER_PAGE);
        const firstPageDetails = await fetchDetailsWithRelevance(firstPageIds, query, searchType);
        
        // Store all IDs but only the first page of details
        currentSearchResults = limitedIds.map((id, index) => {
            if (index < RESULTS_PER_PAGE) {
                return firstPageDetails.find(detail => detail.objectID === id) || { objectID: id };
            }
            return { objectID: id };
        });
        
        // Sort by relevance score
        currentSearchResults.sort((a, b) => {
            const scoreA = a.relevanceInfo ? a.relevanceInfo.score : 0;
            const scoreB = b.relevanceInfo ? b.relevanceInfo.score : 0;
            return scoreB - scoreA;
        });
        
        // Add search to history with type
        addToSearchHistory(`${query} (${searchType})`);
        
        // Display results
        displaySearchResults();
        
        // Fetch remaining details in the background
        if (limitedIds.length > RESULTS_PER_PAGE) {
            fetchRemainingDetailsWithRelevance(limitedIds.slice(RESULTS_PER_PAGE), query, searchType);
        }
    } catch (error) {
        console.error('Search error:', error);
        window.MetUI.showSearchError();
    }
}

// Fetch details with relevance scoring
async function fetchDetailsWithRelevance(objectIds, searchQuery, searchType = 'quick') {
    const details = await window.MetAPI.getObjectDetailsMultiple(objectIds);
    
    // Add relevance info to each detail
    return details.map(artwork => {
        if (!artwork) return null;
        const relevanceInfo = calculateRelevance(artwork, searchQuery, searchType);
        return { ...artwork, relevanceInfo };
    }).filter(item => item !== null);
}

// Calculate relevance score for an artwork
function calculateRelevance(artwork, searchQuery, searchType = 'quick') {
    const query = searchQuery.toLowerCase();
    let score = 0;
    const matches = [];
    let searchContext = null;
    
    // For artist search, prioritize artist matches
    if (searchType === 'artist') {
        if (artwork.artistDisplayName) {
            const artist = artwork.artistDisplayName.toLowerCase();
            if (artist === query) {
                score += 100;
                matches.push({ field: 'artist', type: 'exact' });
            } else if (artist.includes(query)) {
                score += 80;
                matches.push({ field: 'artist', type: 'partial' });
            }
            searchContext = { type: 'artist', field: 'Artist name' };
        }
    }
    // For title search, prioritize title matches
    else if (searchType === 'title') {
        if (artwork.title) {
            const title = artwork.title.toLowerCase();
            if (title === query) {
                score += 100;
                matches.push({ field: 'title', type: 'exact' });
            } else if (title.includes(query)) {
                score += 80;
                matches.push({ field: 'title', type: 'partial' });
            }
            searchContext = { type: 'title', field: 'Artwork title' };
        }
    }
    // For quick/advanced search, check all fields
    else {
        // Check title (highest priority)
        if (artwork.title) {
            const title = artwork.title.toLowerCase();
            if (title === query) {
                score += 100;
                matches.push({ field: 'title', type: 'exact' });
            } else if (title.includes(query)) {
                score += 50;
                matches.push({ field: 'title', type: 'partial' });
            }
        }
        
        // Check artist name (high priority)
        if (artwork.artistDisplayName) {
            const artist = artwork.artistDisplayName.toLowerCase();
            if (artist === query) {
                score += 80;
                matches.push({ field: 'artist', type: 'exact' });
            } else if (artist.includes(query)) {
                score += 40;
                matches.push({ field: 'artist', type: 'partial' });
            }
        }
        
        // Check classification/medium (medium priority)
        if (artwork.classification) {
            const classification = artwork.classification.toLowerCase();
            if (classification.includes(query)) {
                score += 20;
                matches.push({ field: 'classification', type: 'partial' });
            }
        }
        
        if (artwork.medium) {
            const medium = artwork.medium.toLowerCase();
            if (medium.includes(query)) {
                score += 15;
                matches.push({ field: 'medium', type: 'partial' });
            }
        }
        
        // Check department (low priority)
        if (artwork.department) {
            const department = artwork.department.toLowerCase();
            if (department.includes(query)) {
                score += 10;
                matches.push({ field: 'department', type: 'partial' });
            }
        }
        
        // Check culture (low priority)
        if (artwork.culture) {
            const culture = artwork.culture.toLowerCase();
            if (culture.includes(query)) {
                score += 10;
                matches.push({ field: 'culture', type: 'partial' });
            }
        }
        
        // Check tags (lowest priority)
        if (artwork.tags && Array.isArray(artwork.tags)) {
            const tagMatch = artwork.tags.some(tag => 
                tag.term && tag.term.toLowerCase().includes(query)
            );
            if (tagMatch) {
                score += 5;
                matches.push({ field: 'tags', type: 'partial' });
            }
        }
    }
    
    return {
        score,
        matches,
        primaryMatch: matches.length > 0 ? matches[0].field : null,
        searchContext
    };
}

// Fetch remaining details in the background with relevance
async function fetchRemainingDetailsWithRelevance(remainingIds, searchQuery, searchType = 'quick') {
    try {
        const details = await fetchDetailsWithRelevance(remainingIds, searchQuery, searchType);
        
        // Update the results array with the fetched details
        details.forEach(detail => {
            const index = currentSearchResults.findIndex(r => r.objectID === detail.objectID);
            if (index !== -1) {
                currentSearchResults[index] = detail;
            }
        });
        
        // Re-sort by relevance
        currentSearchResults.sort((a, b) => {
            const scoreA = a.relevanceInfo ? a.relevanceInfo.score : 0;
            const scoreB = b.relevanceInfo ? b.relevanceInfo.score : 0;
            return scoreB - scoreA;
        });
    } catch (error) {
        console.error('Error fetching remaining details:', error);
    }
}

// Original function for backward compatibility
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
    
    // Add relevance indicator if available
    if (artwork.relevanceInfo && artwork.relevanceInfo.score > 0) {
        const relevanceIndicator = document.createElement('div');
        relevanceIndicator.className = 'relevance-indicator';
        
        // Add match badge
        if (artwork.relevanceInfo.primaryMatch || artwork.relevanceInfo.searchContext) {
            const matchBadge = document.createElement('span');
            matchBadge.className = 'match-badge';
            matchBadge.textContent = getMatchLabel(
                artwork.relevanceInfo.primaryMatch, 
                artwork.relevanceInfo.searchContext
            );
            relevanceIndicator.appendChild(matchBadge);
        }
        
        item.appendChild(relevanceIndicator);
    }
    
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
    
    // Highlight matching fields
    const title = document.createElement('div');
    title.className = 'search-result-title';
    if (artwork.relevanceInfo && artwork.relevanceInfo.matches.some(m => m.field === 'title')) {
        title.innerHTML = highlightText(artwork.title || 'Untitled', currentSearchQuery);
    } else {
        title.textContent = artwork.title || 'Untitled';
    }
    info.appendChild(title);
    
    if (artwork.artistDisplayName) {
        const artist = document.createElement('div');
        artist.className = 'search-result-artist';
        if (artwork.relevanceInfo && artwork.relevanceInfo.matches.some(m => m.field === 'artist')) {
            artist.innerHTML = highlightText(artwork.artistDisplayName, currentSearchQuery);
        } else {
            artist.textContent = artwork.artistDisplayName;
        }
        info.appendChild(artist);
    }
    
    if (artwork.objectDate) {
        const date = document.createElement('div');
        date.className = 'search-result-date';
        date.textContent = artwork.objectDate;
        info.appendChild(date);
    }
    
    // Show object type if relevant
    if (artwork.objectName) {
        const type = document.createElement('div');
        type.className = 'search-result-type';
        type.textContent = artwork.objectName;
        info.appendChild(type);
    }
    
    item.appendChild(info);
    
    // Add click handler
    item.addEventListener('click', () => {
        viewArtworkFromSearch(artwork.objectID);
    });
    
    return item;
}

// Get a friendly label for match field
function getMatchLabel(field, searchContext) {
    if (searchContext && searchContext.type) {
        return `Found in: ${searchContext.field}`;
    }
    
    const labels = {
        'title': 'Title match',
        'artist': 'Artist match',
        'classification': 'Type match',
        'medium': 'Medium match',
        'department': 'Department match',
        'culture': 'Culture match',
        'tags': 'Tag match'
    };
    return labels[field] || 'Match';
}

// Highlight search term in text
function highlightText(text, searchTerm) {
    if (!text || !searchTerm) return text;
    
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Escape special regex characters
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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