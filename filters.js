// filters.js - Functions related to handling artwork filters

// Initialize the filters with appropriate ranges
async function initFilters() {
    await populateDepartmentDropdown();
    setupDateFilters();
    setupTextSearch();
    setupAdvancedSearch();
    setupFilterChangeHandlers();
    
    // Subscribe to state changes
    subscribeToStateChanges();
    
    // More filter initialization can go here as we add new features
}

// Populate the department dropdown with options from the API
async function populateDepartmentDropdown() {
    const departmentSelect = document.getElementById('departmentSelect');
    
    if (!departmentSelect) {
        if (window.MetLogger) {
            window.MetLogger.error('Department select element not found');
        }
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
        
        if (window.MetLogger) {
            window.MetLogger.log(`Populated department dropdown with ${departments.length} departments`);
        }
    } catch (error) {
        if (window.MetLogger) {
            window.MetLogger.error('Error populating department dropdown:', error);
        }
    }
}

// Set up date range filters with appropriate defaults
function setupDateFilters() {
    const dateBeginInput = document.getElementById('dateBegin');
    const dateEndInput = document.getElementById('dateEnd');
    
    if (!dateBeginInput || !dateEndInput) {
        if (window.MetLogger) {
            window.MetLogger.error('Date input elements not found');
        }
        return;
    }
    
    // The Met's collection spans approximately 5,000 years
    // Set reasonable defaults for the date range
    dateBeginInput.placeholder = "(e.g. -3000)";
    dateEndInput.placeholder = "(e.g. 2025)";
    
    // Add validation for the date range
    const beginChangeHandler = () => {
        validateDateRange(dateBeginInput, dateEndInput);
        updateStateFromFilters();
    };
    const endChangeHandler = () => {
        validateDateRange(dateBeginInput, dateEndInput);
        updateStateFromFilters();
    };
    
    if (window.MetEventManager) {
        window.MetEventManager.addEventListener(dateBeginInput, 'change', beginChangeHandler);
        window.MetEventManager.addEventListener(dateEndInput, 'change', endChangeHandler);
    } else {
        dateBeginInput.addEventListener('change', beginChangeHandler);
        dateEndInput.addEventListener('change', endChangeHandler);
    }
    
    // Set up time period buttons
    setupTimePeriodButtons(dateBeginInput, dateEndInput);
}

// Set up predefined time period buttons
function setupTimePeriodButtons(dateBeginInput, dateEndInput) {
    const timePeriodButtons = document.querySelectorAll('.time-period-btn');
    
    timePeriodButtons.forEach(button => {
        const clickHandler = () => {
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
            
            // Update state
            updateStateFromFilters();
        };
        
        if (window.MetEventManager) {
            window.MetEventManager.addEventListener(button, 'click', clickHandler);
        } else {
            button.addEventListener('click', clickHandler);
        }
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
        if (window.MetLogger) {
            window.MetLogger.warn('Invalid date range: begin year must be before end year');
        }
    }
}

// Set up text search functionality
function setupTextSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    if (!searchInput || !searchButton) {
        if (window.MetLogger) {
            window.MetLogger.error('Search elements not found');
        }
        return;
    }
    
    // Create debounced search function using utils
    const debouncedSearch = window.MetUtils ? 
        window.MetUtils.debounce((query) => {
            if (query) {
                performSearch(query);
            }
        }, 500) : 
        // Fallback if utils not loaded
        (() => {
            let timer;
            return (query) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    if (query) performSearch(query);
                }, 500);
            };
        })();
    
    // Handle search button click - immediate search
    const searchButtonHandler = () => {
        const value = searchInput.value.trim();
        if (value) {
            // Cancel any pending debounced search
            debouncedSearch.cancel?.();
            performSearch(value);
        }
    };
    
    if (window.MetEventManager) {
        window.MetEventManager.addEventListener(searchButton, 'click', searchButtonHandler);
    } else {
        searchButton.addEventListener('click', searchButtonHandler);
    }
    
    // Handle Enter key in search input - immediate search
    const searchKeypressHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission
            const value = searchInput.value.trim();
            if (value) {
                // Cancel any pending debounced search
                debouncedSearch.cancel?.();
                performSearch(value);
            }
        }
    };
    
    if (window.MetEventManager) {
        window.MetEventManager.addEventListener(searchInput, 'keypress', searchKeypressHandler);
    } else {
        searchInput.addEventListener('keypress', searchKeypressHandler);
    }
    
    // Handle input changes with debouncing
    const searchInputHandler = (e) => {
        const value = e.target.value.trim();
        
        if (!value) {
            // Clear search when input is empty
            debouncedSearch.cancel?.();
            if (window.MetUI && window.MetUI.clearSearch) {
                window.MetUI.clearSearch();
            }
        } else {
            // Trigger debounced search
            debouncedSearch(value);
        }
    };
    
    if (window.MetEventManager) {
        window.MetEventManager.addEventListener(searchInput, 'input', searchInputHandler);
    } else {
        searchInput.addEventListener('input', searchInputHandler);
    }
    
    // Store reference for cleanup if needed
    searchInput._debouncedSearch = debouncedSearch;
}

// Perform search
function performSearch(query) {
    if (window.MetLogger) {
        window.MetLogger.log('Search query:', query);
    }
    // FIXED: Get current filters for quick search to include basic filters
    const filters = {
        departmentId: document.getElementById('departmentSelect')?.value || '',
        dateBegin: document.getElementById('dateBegin')?.value || '',
        dateEnd: document.getElementById('dateEnd')?.value || '',
        medium: document.getElementById('mediumSelect')?.value || ''
    };
    
    // Remove empty filters
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });
    
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
        if (window.MetLogger) {
            window.MetLogger.error('Advanced search elements not found');
        }
        return;
    }
    
    const toggleHandler = () => {
        const isVisible = advancedFields.style.display !== 'none';
        advancedFields.style.display = isVisible ? 'none' : 'block';
        toggleButton.innerHTML = isVisible 
            ? '<i class="fas fa-cog"></i> Advanced Search'
            : '<i class="fas fa-cog"></i> Hide Advanced Search';
            
        // Store state in localStorage
        if (window.localStorage) {
            localStorage.setItem('advancedSearchVisible', !isVisible);
        }
    };
    
    if (window.MetEventManager) {
        window.MetEventManager.addEventListener(toggleButton, 'click', toggleHandler);
    } else {
        toggleButton.addEventListener('click', toggleHandler);
    }
    
    // Restore advanced search visibility from localStorage
    if (window.localStorage) {
        const wasVisible = localStorage.getItem('advancedSearchVisible') === 'true';
        if (wasVisible) {
            advancedFields.style.display = 'block';
            toggleButton.innerHTML = '<i class="fas fa-cog"></i> Hide Advanced Search';
        }
    }
    
    // Connect advanced search field events
    connectAdvancedSearchFields();
}

// Connect event listeners to advanced search fields
function connectAdvancedSearchFields() {
    // Text input fields that should trigger search on change
    const advancedTextFields = [
        'geoLocationInput',
        'excavationInput',
        'titleInput'
    ];
    
    // Add debounced search to advanced text fields
    advancedTextFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            // Create individual debounced handler for each field
            const debouncedHandler = window.MetUtils ? 
                window.MetUtils.debounce(() => {
                    const value = field.value.trim();
                    if (value) {
                        if (window.MetLogger) {
                            window.MetLogger.log(`Advanced search field ${fieldId} changed:`, value);
                        }
                        triggerAdvancedSearch();
                    }
                }, 750) : // Slightly longer delay for advanced fields
                null;
                
            if (debouncedHandler) {
                field.addEventListener('input', debouncedHandler);
                field._debouncedHandler = debouncedHandler;
            }
            
            // Handle Enter key for immediate search
            const keypressHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (field._debouncedHandler) {
                        field._debouncedHandler.cancel();
                    }
                    triggerAdvancedSearch();
                }
            };
            
            if (window.MetEventManager) {
                window.MetEventManager.addEventListener(field, 'keypress', keypressHandler);
            } else {
                field.addEventListener('keypress', keypressHandler);
            }
        }
    });
    
    // FIXED: Add debounced event handlers for input fields
    if (window.MetEventManager) {
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && debouncedHandler) {
                window.MetEventManager.addEventListener(field, 'input', debouncedHandler);
            }
        });
    }
    
    // Checkbox fields that should trigger search immediately
    const checkboxFields = [
        'artistOrCultureCheckbox',
        'isHighlightCheckbox',
        'isPublicDomainCheckbox'
    ];
    
    checkboxFields.forEach(fieldId => {
        const checkbox = document.getElementById(fieldId);
        if (checkbox) {
            const changeHandler = () => {
                if (window.MetLogger) {
                    window.MetLogger.log(`Checkbox ${fieldId} changed:`, checkbox.checked);
                }
                updateStateFromFilters();
                triggerAdvancedSearch();
            };
            
            if (window.MetEventManager) {
                window.MetEventManager.addEventListener(checkbox, 'change', changeHandler);
            } else {
                checkbox.addEventListener('change', changeHandler);
            }
        }
    });
}

// Trigger advanced search with current filters
function triggerAdvancedSearch() {
    const filters = getCurrentFilters();
    
    // Check if we have any search criteria
    const hasSearchCriteria = filters.searchQuery || filters.title || 
                             filters.geoLocation || filters.excavation ||
                             filters.departmentId || filters.medium ||
                             (filters.dateBegin && filters.dateEnd) ||
                             filters.isHighlight || filters.artistOrCulture;
    
    if (hasSearchCriteria) {
        if (window.MetLogger) {
            window.MetLogger.log('Triggering advanced search with filters:', filters);
        }
        // FIXED: Pass filters to triggerSearch and ensure search uses them
        if (window.MetUI && window.MetUI.triggerSearch) {
            // Use title as the main query if provided, otherwise use searchQuery
            const query = filters.title || filters.searchQuery || '*';
            window.MetUI.triggerSearch(query, 'advanced');
        }
    } else {
        if (window.MetLogger) {
            window.MetLogger.log('No search criteria provided for advanced search');
        }
    }
}


// FIXED: Get the current filters from state if available, otherwise from UI
function getCurrentFilters() {
    // Try to get from state first
    if (window.MetState) {
        const stateFilters = window.MetState.getState('filters');
        if (stateFilters) {
            return { ...stateFilters };
        }
    }
    
    // Fallback to reading from UI
    const departmentId = document.getElementById('departmentSelect')?.value || '';
    const dateBegin = document.getElementById('dateBegin')?.value || '';
    const dateEnd = document.getElementById('dateEnd')?.value || '';
    const medium = document.getElementById('mediumSelect')?.value || '';
    const searchQuery = document.getElementById('searchInput')?.value.trim() || '';
    
    // Advanced search fields
    const geoLocation = document.getElementById('geoLocationInput')?.value.trim() || '';
    const excavation = document.getElementById('excavationInput')?.value.trim() || '';
    const title = document.getElementById('titleInput')?.value.trim() || '';
    const artistOrCulture = document.getElementById('artistOrCultureCheckbox')?.checked || false;
    const isHighlight = document.getElementById('isHighlightCheckbox')?.checked || false;
    const isPublicDomain = document.getElementById('isPublicDomainCheckbox')?.checked || false;
    
    // Build the filters object
    const filters = {};
    
    if (departmentId) filters.departmentId = departmentId;
    if (dateBegin) filters.dateBegin = dateBegin;
    if (dateEnd) filters.dateEnd = dateEnd;
    if (medium) filters.medium = medium;
    if (searchQuery) filters.searchQuery = searchQuery;
    if (geoLocation) filters.geoLocation = geoLocation;
    if (excavation) filters.excavation = excavation;
    if (title) filters.title = title;
    if (artistOrCulture) filters.artistOrCulture = artistOrCulture;
    if (isHighlight) filters.isHighlight = isHighlight;
    if (isPublicDomain !== undefined) filters.isPublicDomain = isPublicDomain;
    
    return filters;
}

// FIXED: Update state when filters change
function updateStateFromFilters() {
    if (!window.MetState) return;
    
    const filters = getCurrentFilters();
    window.MetState.setState('filters', filters);
}

// FIXED: Set up change handlers for filter dropdowns
function setupFilterChangeHandlers() {
    const departmentSelect = document.getElementById('departmentSelect');
    const mediumSelect = document.getElementById('mediumSelect');
    
    if (departmentSelect) {
        const departmentHandler = () => {
            updateStateFromFilters();
            triggerAdvancedSearch();
        };
        
        if (window.MetEventManager) {
            window.MetEventManager.addEventListener(departmentSelect, 'change', departmentHandler);
        } else {
            departmentSelect.addEventListener('change', departmentHandler);
        }
    }
    
    if (mediumSelect) {
        const mediumHandler = () => {
            updateStateFromFilters();
            triggerAdvancedSearch();
        };
        
        if (window.MetEventManager) {
            window.MetEventManager.addEventListener(mediumSelect, 'change', mediumHandler);
        } else {
            mediumSelect.addEventListener('change', mediumHandler);
        }
    }
}

// Subscribe to state changes
function subscribeToStateChanges() {
    if (!window.MetState) return;
    
    // Subscribe to filter changes
    window.MetState.subscribe('filters', (newFilters) => {
        updateUIFromState(newFilters);
    });
}

// Update UI from state
function updateUIFromState(filters) {
    if (!filters) return;
    
    // Update form fields
    const fields = {
        departmentSelect: filters.departmentId,
        dateBegin: filters.dateBegin,
        dateEnd: filters.dateEnd,
        mediumSelect: filters.medium,
        searchInput: filters.searchQuery,
        geoLocationInput: filters.geoLocation,
        excavationInput: filters.excavation,
        titleInput: filters.title,
        artistOrCultureCheckbox: filters.artistOrCulture,
        isHighlightCheckbox: filters.isHighlight,
        isPublicDomainCheckbox: filters.isPublicDomain
    };
    
    for (const [id, value] of Object.entries(fields)) {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = !!value;
            } else {
                element.value = value || '';
            }
        }
    }
}

// Make functions available globally
window.MetFilters = {
    initFilters,
    getCurrentFilters,
    triggerAdvancedSearch,
    connectAdvancedSearchFields,
    updateStateFromFilters,
    subscribeToStateChanges
};