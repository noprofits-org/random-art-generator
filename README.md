# Met Art Generator

A professional Progressive Web App (PWA) that displays random artworks from the Metropolitan Museum of Art collection. Built with vanilla JavaScript, featuring offline support, accessibility, and a polished user experience.

## Features

- 🎨 **Random Artwork Discovery** - Explore random pieces from the Met's vast collection
- ❤️ **Favorites System** - Save your favorite artworks for later viewing
- 📱 **Mobile-First Design** - Responsive design that works beautifully on all devices
- 🌐 **Offline Support** - View cached artworks even without internet connection
- ♿ **Accessibility** - Full keyboard navigation, screen reader support, and ARIA labels
- 🎯 **PWA Features** - Install as app, splash screens, share target, and more
- 🚀 **Performance** - Progressive image loading, skeleton screens, and optimized caching
- 🎨 **Polished UX** - Smooth animations, contextual tips, and professional design

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/random-art-generator.git
   cd random-art-generator
   ```

2. **Serve the files**
   
   You can use any static file server. Here are a few options:
   
   Using Python:
   ```bash
   python3 -m http.server 8000
   ```
   
   Using Node.js (http-server):
   ```bash
   npx http-server -p 8000
   ```
   
   Using Live Server in VS Code:
   - Install the Live Server extension
   - Right-click on `index.html` and select "Open with Live Server"

3. **Open in browser**
   
   Navigate to `http://localhost:8000`

## Installation as PWA

The app can be installed as a Progressive Web App on supported devices:

1. **Desktop (Chrome/Edge)**
   - Look for the install icon in the address bar
   - Or use the menu: ⋮ → "Install Met Art Generator"

2. **iOS**
   - Open in Safari
   - Tap the Share button
   - Select "Add to Home Screen"

3. **Android**
   - Chrome will show an install banner
   - Or use menu: ⋮ → "Add to Home Screen"

## Project Structure

```
random-art-generator/
├── index.html              # Main HTML file
├── offline.html            # Offline fallback page
├── manifest.json           # PWA manifest
├── service-worker.js       # Service worker for offline support
├── app.js                  # Main application bundle
├── styles-mobile.css       # Mobile-first styles
├── styles-enhancements.css # Animation and transition enhancements
├── config.js               # Configuration and logging
├── api.js                  # Met Museum API integration
├── artwork.js              # Artwork display logic
├── ui.js                   # UI components and interactions
├── favorites.js            # Favorites management
├── init.js                 # App initialization
├── ui-enhancements.js      # Enhanced UI features
├── accessibility-enhancements.js  # Accessibility features
├── pwa-enhancements.js     # PWA-specific features
├── icons/                  # App icons for various devices
└── splash/                 # Splash screens for iOS devices
```

## Development

### Debug Mode

Enable debug logging by setting `DEBUG_MODE: true` in `config.js`:

```javascript
DEBUG_MODE: true, // Set to false for production
```

### Building for Production

1. Run the build script:
   ```bash
   ./build.sh
   ```

2. The production files will be in the `build/` directory

### Key Technologies

- **Vanilla JavaScript** - No framework dependencies
- **IndexedDB** - For storing favorites
- **Service Workers** - For offline functionality
- **CORS Proxies** - To access Met Museum images
- **Progressive Enhancement** - Works without JavaScript, enhanced with it

### API Integration

The app uses the Metropolitan Museum of Art Collection API:
- Base URL: `https://collectionapi.metmuseum.org/public/collection/v1`
- No API key required
- CORS proxy used for images

## Features in Detail

### Accessibility

- **Keyboard Navigation**: All features accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and live regions
- **High Contrast Mode**: Automatic detection and support
- **Reduced Motion**: Respects user's motion preferences
- **Focus Management**: Clear focus indicators

### Performance Optimizations

- **Progressive Image Loading**: Blur-up technique with thumbnails
- **Skeleton Screens**: Instead of spinners for better perceived performance
- **Lazy Loading**: Images in favorites grid load as needed
- **Smart Caching**: Intelligent cache management with size limits

### PWA Features

- **Offline Support**: View previously loaded artworks offline
- **Install Prompts**: Custom install UI
- **Share Target**: Share Met Museum links to the app
- **Periodic Sync**: Background content refresh
- **Standalone Mode**: Custom navigation for installed app

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support (except share target)
- Safari: Full support (limited PWA features)
- Mobile browsers: Optimized for iOS Safari and Chrome

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Metropolitan Museum of Art for their open API
- Font Awesome for icons
- The open source community for inspiration

## Troubleshooting

### Images not loading
- Check your internet connection
- The app uses CORS proxies which may occasionally be slow
- Try refreshing the page

### Favorites not saving
- Ensure your browser supports IndexedDB
- Check if you're in private/incognito mode
- Clear browser data and try again

### Installation issues
- Ensure you're using a supported browser
- The site must be served over HTTPS for PWA features
- Check that service worker is registered

---

Made with ❤️ for art lovers everywhere