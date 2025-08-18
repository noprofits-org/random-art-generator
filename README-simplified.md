# Met Art Generator - Simplified Version

A streamlined random art discovery app using the Metropolitan Museum API.

## Structure

The app has been simplified to just 3 core files:

- `index.html` - Minimal HTML structure
- `app.js` - All JavaScript consolidated into one file
- `styles.css` - All styles in one file

## Features

- Random artwork discovery from the Met Museum collection
- Favorites system with IndexedDB storage
- Progressive Web App (PWA) with offline support
- Enhanced image loading with blur placeholders and progress indicators
- Responsive design for all devices

## Building for Production

### Option 1: Using the build script
```bash
chmod +x build.sh
./build.sh
```

### Option 2: Using npm
```bash
npm install
npm run build
```

The build process will:
- Create a `build/` directory with production files
- Minify CSS and JavaScript (if tools are installed)
- Copy all necessary assets

## Deployment

1. Upload all files from the `build/` directory to your web server
2. Ensure HTTPS is enabled (required for PWA features)
3. Test service worker registration and offline functionality

## Development

To run locally:
```bash
# Using Python
python3 -m http.server 8000

# Or using npm
npm run serve
```

Then visit http://localhost:8000

## Architecture

The consolidated `app.js` contains:
- Configuration and logging utilities
- API module for Met Museum integration
- Favorites module with IndexedDB
- Artwork display module
- UI module
- Initialization logic

All modules are self-contained within an IIFE (Immediately Invoked Function Expression) to avoid global namespace pollution.

## Browser Support

- Modern browsers with ES6+ support
- IndexedDB for favorites storage
- Service Worker for offline functionality
- IntersectionObserver for lazy loading (with fallback)