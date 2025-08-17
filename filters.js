// filters.js - Functions related to handling artwork filters

// Debounce timer for search input
let searchDebounceTimer = null;

// Initialize the filters with appropriate ranges
async function initFilters() {
    await populateDepartmentDropdown();
    setupDateFilters();
    setupTextSearch();
    
    // More filter initialization can go here as we add new features
}

// Populate the department dropdown with options from the API
async function populateDepartmentDropdown() {
    const departmentSelect = document.getElementById('departmentSelect');
    
    if (!departmentSelect) {
        console.error('Department select element not found');
        return;
    }
    
    try {
        const departments = await window.MetAPI.getDepartments();
        
        // Sort departments alphabetically by display name
        departments.sort((a, b) => a.displayName.localeCompare(b.displayName));
        
        // Add the departments to the dropdown
        departments.forEach(department => {
            const option = document.createElement('option');
            option.value = department.departmentId;
            option.textContent = department.displayName;
            departmentSelect.appendChild(option);
        });
        
        console.log(`Populated department dropdown with ${departments.length} departments`);
    } catch (error) {
        console.error('Error populating department dropdown:', error);
    }
}

// Set up date range filters with appropriate defaults
function setupDateFilters() {
    const dateBeginInput = document.getElementById('dateBegin');
    const dateEndInput = document.getElementById('dateEnd');
    
    if (!dateBeginInput || !dateEndInput) {
        console.error('Date input elements not found');
        return;
    }
    
    // The Met's collection spans approximately 5,000 years
    // Set reasonable defaults for the date range
    dateBeginInput.placeholder = "(e.g. -3000)";
    dateEndInput.placeholder = "(e.g. 2025)";
    
    // Add validation for the date range
    dateBeginInput.addEventListener('change', () => validateDateRange(dateBeginInput, dateEndInput));
    dateEndInput.addEventListener('change', () => validateDateRange(dateBeginInput, dateEndInput));
}

// Validate that the date range is logical
function validateDateRange(beginInput, endInput) {
    const beginYear = parseInt(beginInput.value);
    const endYear = parseInt(endInput.value);
    
    // Clear any previous error styling
    beginInput.classList.remove('error');
    endInput.classList.remove('error');
    
    // If both fields have values, check that begin date is before end date
    if (!isNaN(beginYear) && !isNaN(endYear) && beginYear > endYear) {
        beginInput.classList.add('error');
        endInput.classList.add('error');
        console.warn('Invalid date range: begin year must be before end year');
    }
}

// Set up text search functionality with debouncing
function setupTextSearch() {
    setupSearchTabs();
    setupSearchInput('searchInput', 'clearSearchButton', 'quick');
    setupSearchInput('artistSearchInput', 'clearArtistSearchButton', 'artist');
    setupSearchInput('titleSearchInput', 'clearTitleSearchButton', 'title');
    setupSearchInput('advancedSearchInput', 'clearAdvancedSearchButton', 'advanced');
    setupArtistSuggestions();
}

// Set up search tabs
function setupSearchTabs() {
    const tabs = document.querySelectorAll('.search-tab');
    const contents = document.querySelectorAll('.search-tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update active states
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${targetTab}SearchTab`).classList.add('active');
            
            // Focus the appropriate input
            const inputId = targetTab === 'quick' ? 'searchInput' : `${targetTab}SearchInput`;
            const input = document.getElementById(inputId);
            if (input) {
                input.focus();
            }
        });
    });
}

// Set up individual search input
function setupSearchInput(inputId, clearButtonId, searchType) {
    const searchInput = document.getElementById(inputId);
    const clearSearchButton = document.getElementById(clearButtonId);
    
    if (!searchInput) {
        console.error(`Search input element ${inputId} not found`);
        return;
    }
    
    // Add debounced input handler
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        
        // Show/hide clear button based on input
        if (clearSearchButton) {
            clearSearchButton.style.display = value ? 'block' : 'none';
        }
        
        // Clear existing timer
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        
        // Set new timer for 500ms
        searchDebounceTimer = setTimeout(() => {
            if (value) {
                console.log(`${searchType} search query:`, value);
                // Trigger search through UI
                if (window.UI && window.UI.triggerSearch) {
                    window.UI.triggerSearch(value, searchType);
                }
            }
        }, 500);
    });
    
    // Add clear button handler
    if (clearSearchButton) {
        clearSearchButton.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchButton.style.display = 'none';
            // Clear search results
            if (window.UI && window.UI.clearSearch) {
                window.UI.clearSearch();
            }
        });
    }
}

// Set up artist suggestions
function setupArtistSuggestions() {
    const artistInput = document.getElementById('artistSearchInput');
    const suggestionsDiv = document.getElementById('artistSuggestions');
    
    if (!artistInput || !suggestionsDiv) return;
    
    let suggestionTimer = null;
    
    artistInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        
        if (suggestionTimer) {
            clearTimeout(suggestionTimer);
        }
        
        if (value.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        suggestionTimer = setTimeout(() => {
            if (window.MetAPI && window.MetAPI.getArtistSuggestions) {
                window.MetAPI.getArtistSuggestions(value).then(suggestions => {
                    displayArtistSuggestions(suggestions, suggestionsDiv, artistInput);
                });
            }
        }, 300);
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!artistInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.style.display = 'none';
        }
    });
}

// Display artist suggestions
function displayArtistSuggestions(suggestions, suggestionsDiv, input) {
    if (!suggestions || suggestions.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    suggestionsDiv.innerHTML = suggestions.map(artist => `
        <div class="artist-suggestion" data-artist="${artist.name}">
            <div class="artist-name">${artist.name}</div>
            ${artist.nationality || artist.dates ? `
                <div class="artist-info">
                    ${artist.nationality || ''} ${artist.dates || ''}
                </div>
            ` : ''}
        </div>
    `).join('');
    
    suggestionsDiv.style.display = 'block';
    
    // Add click handlers
    const suggestionItems = suggestionsDiv.querySelectorAll('.artist-suggestion');
    suggestionItems.forEach(item => {
        item.addEventListener('click', () => {
            const artistName = item.dataset.artist;
            input.value = artistName;
            suggestionsDiv.style.display = 'none';
            
            // Trigger search
            if (window.UI && window.UI.triggerSearch) {
                window.UI.triggerSearch(artistName, 'artist');
            }
        });
    });
}

// Get the current filters from the UI
function getCurrentFilters() {
    const departmentId = document.getElementById('departmentSelect')?.value || '';
    const dateBegin = document.getElementById('dateBegin')?.value || '';
    const dateEnd = document.getElementById('dateEnd')?.value || '';
    const medium = document.getElementById('mediumSelect')?.value || '';
    const searchQuery = document.getElementById('searchInput')?.value.trim() || '';
    
    // Get object type filters
    const includeTypes = [];
    document.querySelectorAll('input[name="includeType"]:checked').forEach(checkbox => {
        includeTypes.push(checkbox.value);
    });
    
    const excludeTypes = [];
    document.querySelectorAll('input[name="excludeType"]:checked').forEach(checkbox => {
        excludeTypes.push(checkbox.value);
    });
    
    // Build the filters object
    const filters = {};
    
    if (departmentId) filters.departmentId = departmentId;
    if (dateBegin) filters.dateBegin = dateBegin;
    if (dateEnd) filters.dateEnd = dateEnd;
    if (medium) filters.medium = medium;
    if (searchQuery) filters.searchQuery = searchQuery;
    if (includeTypes.length > 0) filters.includeTypes = includeTypes;
    if (excludeTypes.length > 0) filters.excludeTypes = excludeTypes;
    
    return filters;
}

// Make functions available globally
window.MetFilters = {
    initFilters,
    getCurrentFilters
};