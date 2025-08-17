// TypeScript definitions for Metropolitan Museum of Art API responses

// Department object from the API
interface MetDepartment {
    departmentId: number;
    displayName: string;
}

// Main artwork object with all possible fields
interface MetArtwork {
    // Core identifiers
    objectID: number;
    isHighlight: boolean;
    accessionNumber: string;
    accessionYear: string;
    isPublicDomain: boolean;
    primaryImage: string;
    primaryImageSmall: string;
    additionalImages: string[];
    
    // Basic information
    department: string;
    objectName: string;
    title: string;
    culture: string;
    period: string;
    dynasty: string;
    reign: string;
    portfolio: string;
    
    // Artist information
    artistRole: string;
    artistPrefix: string;
    artistDisplayName: string;
    artistDisplayBio: string;
    artistSuffix: string;
    artistAlphaSort: string;
    artistNationality: string;
    artistBeginDate: string;
    artistEndDate: string;
    artistGender: string;
    artistWikidata_URL: string;
    artistULAN_URL: string;
    
    // Dating
    objectDate: string;
    objectBeginDate: number;
    objectEndDate: number;
    
    // Physical characteristics
    medium: string;
    dimensions: string;
    measurements: MetMeasurement[];
    
    // Creation and location
    city: string;
    state: string;
    county: string;
    country: string;
    region: string;
    subregion: string;
    locale: string;
    locus: string;
    excavation: string;
    river: string;
    
    // Classification
    classification: string;
    rightsAndReproduction: string;
    linkResource: string;
    
    // Metadata
    metadataDate: string;
    repository: string;
    objectURL: string;
    tags: MetTag[];
    
    // Wikidata and external links
    objectWikidata_URL: string;
    
    // Gallery information
    isTimelineWork: boolean;
    GalleryNumber: string;
    
    // Geographic information
    geographyType: string;
    geoLocation?: string;
    
    // Additional metadata
    constituents: MetConstituent[];
}

// Measurement details
interface MetMeasurement {
    elementName: string;
    elementDescription: string | null;
    elementMeasurements: {
        Height: number;
        Width: number;
        Depth?: number;
        Diameter?: number;
        Length?: number;
        Weight?: number;
    };
}

// Tag information
interface MetTag {
    term: string;
    AAT_URL: string;
    Wikidata_URL: string;
}

// Constituent (related person/organization)
interface MetConstituent {
    constituentID: number;
    role: string;
    name: string;
    constituentULAN_URL: string;
    constituentWikidata_URL: string;
    gender: string;
}

// Search response
interface MetSearchResponse {
    total: number;
    objectIDs: number[] | null;
}

// Departments response
interface MetDepartmentsResponse {
    departments: MetDepartment[];
}

// Objects response (list of all object IDs)
interface MetObjectsResponse {
    total: number;
    objectIDs: number[];
}

// Filter options for searches
interface MetSearchFilters {
    q?: string;                    // Search query
    hasImages?: boolean;           // Only return objects with images
    departmentIds?: number | string; // Department ID(s)
    isHighlight?: boolean;         // Highlighted works only
    isPublicDomain?: boolean;      // Public domain works only
    dateBegin?: number;            // Begin date (negative for BCE)
    dateEnd?: number;              // End date
    medium?: string;               // Medium/material
    geoLocation?: string;          // Geographic location
    excavation?: string;           // Excavation site
    title?: boolean;               // Search in titles only
    artistOrCulture?: boolean;     // Search across artist name and culture
}

// Extended filter options used in the app
interface AppSearchFilters extends MetSearchFilters {
    searchQuery?: string;          // General search query
    departmentId?: string;         // Single department ID
}

// Cache entry structure
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

// Export for use in the app
declare global {
    interface Window {
        MetAPI: {
            testApiConnection(): Promise<MetDepartmentsResponse | null>;
            getDepartments(): Promise<MetDepartment[]>;
            searchObjects(filters?: AppSearchFilters): Promise<number[]>;
            searchArtworks(filters?: AppSearchFilters): Promise<number[]>;
            getObjectDetails(objectId: number): Promise<MetArtwork | null>;
            getObjectDetailsMultiple(objectIds: number[], batchSize?: number): Promise<MetArtwork[]>;
            getRandomArtwork(filters?: AppSearchFilters): Promise<MetArtwork | null>;
            getProxiedUrl(originalUrl: string): string;
            loadArtworkImage(imageUrl: string): string;
            getCachedArtworks(): Promise<MetArtwork[]>;
            hasCachedArtworks(): Promise<boolean>;
            getRandomCachedArtwork(): Promise<MetArtwork | null>;
            clearSearchCache(): void;
            clearObjectCache(): void;
            clearAllCaches(): void;
        };
    }
}