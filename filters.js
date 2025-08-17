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

// Set up text search functionality
function setupTextSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    if (!searchInput || !searchButton) {
        console.error('Search elements not found');
        return;
    }
    
    // Handle search button click
    searchButton.addEventListener('click', () => {
        const value = searchInput.value.trim();
        if (value) {
            performSearch(value);
        }
    });
    
    // Handle Enter key in search input
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const value = searchInput.value.trim();
            if (value) {
                performSearch(value);
            }
        }
    });
    
    // Handle input changes (for clearing search)
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        if (!value) {
            // Clear search when input is empty
            if (window.MetUI && window.MetUI.clearSearch) {
                window.MetUI.clearSearch();
            }
        }
    });
}

// Perform search
function performSearch(query) {
    console.log('Search query:', query);
    // Trigger search through UI
    if (window.MetUI && window.MetUI.triggerSearch) {
        window.MetUI.triggerSearch(query, 'quick');
    }
}


// Get the current filters from the UI
function getCurrentFilters() {
    const departmentId = document.getElementById('departmentSelect')?.value || '';
    const dateBegin = document.getElementById('dateBegin')?.value || '';
    const dateEnd = document.getElementById('dateEnd')?.value || '';
    const medium = document.getElementById('mediumSelect')?.value || '';
    const searchQuery = document.getElementById('searchInput')?.value.trim() || '';
    
    // No more object type filters in simplified interface
    
    // Build the filters object
    const filters = {};
    
    if (departmentId) filters.departmentId = departmentId;
    if (dateBegin) filters.dateBegin = dateBegin;
    if (dateEnd) filters.dateEnd = dateEnd;
    if (medium) filters.medium = medium;
    if (searchQuery) filters.searchQuery = searchQuery;
    
    return filters;
}

// Make functions available globally
window.MetFilters = {
    initFilters,
    getCurrentFilters
};