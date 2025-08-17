// filters.js - Functions related to handling artwork filters

// Debounce timer for search input
let searchDebounceTimer = null;

// Initialize the filters with appropriate ranges
async function initFilters() {
    await populateDepartmentDropdown();
    setupDateFilters();
    setupTextSearch();
    setupAdvancedSearch();
    
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
    
    // Set up time period buttons
    setupTimePeriodButtons(dateBeginInput, dateEndInput);
}

// Set up predefined time period buttons
function setupTimePeriodButtons(dateBeginInput, dateEndInput) {
    const timePeriodButtons = document.querySelectorAll('.time-period-btn');
    
    timePeriodButtons.forEach(button => {
        button.addEventListener('click', () => {
            const begin = button.dataset.begin;
            const end = button.dataset.end;
            
            // Set the date inputs
            dateBeginInput.value = begin;
            dateEndInput.value = end;
            
            // Update button states
            timePeriodButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Clear validation errors
            dateBeginInput.classList.remove('error');
            dateEndInput.classList.remove('error');
            
            // Trigger a change event to update any listeners
            dateBeginInput.dispatchEvent(new Event('change'));
            dateEndInput.dispatchEvent(new Event('change'));
        });
    });
    
    // Check if current values match any time period
    dateBeginInput.addEventListener('input', () => updateTimePeriodButtonStates(timePeriodButtons, dateBeginInput, dateEndInput));
    dateEndInput.addEventListener('input', () => updateTimePeriodButtonStates(timePeriodButtons, dateBeginInput, dateEndInput));
}

// Update time period button states based on current date inputs
function updateTimePeriodButtonStates(buttons, dateBeginInput, dateEndInput) {
    const currentBegin = dateBeginInput.value;
    const currentEnd = dateEndInput.value;
    
    buttons.forEach(button => {
        if (button.dataset.begin === currentBegin && button.dataset.end === currentEnd) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
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
<<<<<<< HEAD
            // Clear any pending debounce
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = null;
            }
=======
>>>>>>> e11e5c042be9f74d6269222c66544f41a7623c22
            performSearch(value);
        }
    });
    
    // Handle Enter key in search input
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const value = searchInput.value.trim();
            if (value) {
<<<<<<< HEAD
                // Clear any pending debounce
                if (searchDebounceTimer) {
                    clearTimeout(searchDebounceTimer);
                    searchDebounceTimer = null;
                }
=======
>>>>>>> e11e5c042be9f74d6269222c66544f41a7623c22
                performSearch(value);
            }
        }
    });
    
<<<<<<< HEAD
    // Handle input changes with debouncing
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        
        // Clear any existing debounce timer
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        
=======
    // Handle input changes (for clearing search)
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
>>>>>>> e11e5c042be9f74d6269222c66544f41a7623c22
        if (!value) {
            // Clear search when input is empty
            if (window.MetUI && window.MetUI.clearSearch) {
                window.MetUI.clearSearch();
            }
<<<<<<< HEAD
            searchDebounceTimer = null;
        } else {
            // Set up debounce timer for automatic search
            searchDebounceTimer = setTimeout(() => {
                performSearch(value);
                searchDebounceTimer = null;
            }, 500); // 500ms delay
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


// Setup advanced search functionality
function setupAdvancedSearch() {
    const toggleButton = document.getElementById('toggleAdvancedSearch');
    const advancedFields = document.getElementById('advancedSearchFields');
    
    if (!toggleButton || !advancedFields) {
        console.error('Advanced search elements not found');
        return;
    }
    
    toggleButton.addEventListener('click', () => {
        const isVisible = advancedFields.style.display !== 'none';
        advancedFields.style.display = isVisible ? 'none' : 'block';
        toggleButton.innerHTML = isVisible 
            ? '<i class="fas fa-cog"></i> Advanced Search'
            : '<i class="fas fa-cog"></i> Hide Advanced Search';
    });
=======
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
>>>>>>> e11e5c042be9f74d6269222c66544f41a7623c22
}


// Get the current filters from the UI
function getCurrentFilters() {
    const departmentId = document.getElementById('departmentSelect')?.value || '';
    const dateBegin = document.getElementById('dateBegin')?.value || '';
    const dateEnd = document.getElementById('dateEnd')?.value || '';
    const medium = document.getElementById('mediumSelect')?.value || '';
    const searchQuery = document.getElementById('searchInput')?.value.trim() || '';
    
<<<<<<< HEAD
    // Advanced search fields
    const geoLocation = document.getElementById('geoLocationInput')?.value.trim() || '';
    const excavation = document.getElementById('excavationInput')?.value.trim() || '';
    const title = document.getElementById('titleInput')?.value.trim() || '';
    const artistOrCulture = document.getElementById('artistOrCultureCheckbox')?.checked || false;
    const isHighlight = document.getElementById('isHighlightCheckbox')?.checked || false;
    const isPublicDomain = document.getElementById('isPublicDomainCheckbox')?.checked || false;
=======
    // No more object type filters in simplified interface
>>>>>>> e11e5c042be9f74d6269222c66544f41a7623c22
    
    // Build the filters object
    const filters = {};
    
    if (departmentId) filters.departmentId = departmentId;
    if (dateBegin) filters.dateBegin = dateBegin;
    if (dateEnd) filters.dateEnd = dateEnd;
    if (medium) filters.medium = medium;
    if (searchQuery) filters.searchQuery = searchQuery;
<<<<<<< HEAD
    if (geoLocation) filters.geoLocation = geoLocation;
    if (excavation) filters.excavation = excavation;
    if (title) filters.title = title;
    if (artistOrCulture) filters.artistOrCulture = artistOrCulture;
    if (isHighlight) filters.isHighlight = isHighlight;
    if (isPublicDomain !== undefined) filters.isPublicDomain = isPublicDomain;
=======
>>>>>>> e11e5c042be9f74d6269222c66544f41a7623c22
    
    return filters;
}

// Make functions available globally
window.MetFilters = {
    initFilters,
    getCurrentFilters
};