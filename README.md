# Met Art Generator (Simplified)

A minimal web page that displays a random artwork from the Metropolitan Museum of Art collection using the public API. Single HTML + JS, no build, no frameworks.

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

2. **Open in a browser**
   - Double‑click `index.html`, or
   - Serve locally (optional):
     - Python: `python3 -m http.server 8000` → open http://localhost:8000
     - Node: `npx http-server -p 8000` → open http://localhost:8000

## What’s Included

- `index.html` – Minimal UI with a button to load a random artwork
- `main.js` – Fetch logic with a simple CORS-proxy fallback
- `icons/` – App icons (for favicons or future PWA use)
- `tools/icon-resizer/` – A standalone, browser‑only icon generator

## Project Structure

```
random-art-generator/
├── index.html
├── main.js
├── icons/
└── tools/
    └── icon-resizer/
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

### API Integration

- Base URL: `https://collectionapi.metmuseum.org/public/collection/v1`
- No API key required
- If a fetch fails due to CORS/network, a simple proxy fallback is used:
  - Primary: `https://cors-proxy-xi-ten.vercel.app/api/proxy?url=`
  - Fallback: `https://corsproxy.io/?` (path mode)

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

PWA features and other complexity have been intentionally removed to keep the app focused and minimal.

## Browser Support

- Modern browsers with fetch and ES6 support

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

- If loading fails, try again — the app retries with a CORS proxy fallback.

---

Made with ❤️ for art lovers everywhere

## Tools

- Icon Resizer: open `tools/icon-resizer/index.html` to generate PWA icon sizes from a single image.
