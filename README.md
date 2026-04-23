# Met Art Generator (Simplified)

A minimal web page that displays a random artwork from the Metropolitan Museum of Art collection using the public API. Single HTML + JS, no build, no frameworks.

## Features

- **Random Artwork Discovery** - Explore random pieces from the Met's collection
- **Favorites** - Save favorite artworks to local storage
- **Filter by Department** - Narrow results to a specific Met department
- **Deep Linking** - Share a specific artwork via `?id=` in the URL
- **Responsive Layout** - Immersive mobile drawer; side-by-side panel on desktop
- **Touch Gestures** - Tap for a new random artwork, swipe ← / → to navigate history
- **Keyboard Shortcuts** - `R` random, `←` / `→` history, `F` favorite, `Esc` close drawer
- **Progressive Image Loading** - Small thumbnail loads first, full-res swaps in

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

There is no build step — edit `index.html` / `main.js` and reload. Serve over `http://` during development if you need `fetch` to hit the Met API without CORS-proxy fallback.

### API Integration

- Base URL: `https://collectionapi.metmuseum.org/public/collection/v1`
- No API key required
- If a fetch fails due to CORS/network, a simple proxy fallback is used:
  - Primary: `https://cors-proxy-xi-ten.vercel.app/api/proxy?url=`
  - Fallback: `https://corsproxy.io/?` (path mode)

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
