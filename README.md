# Salon · Met Art

A polished mobile-first app for exploring the Metropolitan Museum of Art's open-access
collection. React rendered through in-browser Babel — **still no build step, just static
files** — so it deploys to GitHub Pages exactly like a plain HTML page.

## Screens

- **Discover** - A swipeable card stack: swipe right (or tap the heart) to save, swipe left to pass, tap to open details.
- **Search** - Search the collection and filter by Met department, shown as a masonry grid.
- **Today** - A date-deterministic "Artwork of the Day" plus a daily visit streak.
- **Saved** - Your favorites collection, persisted in local storage.
- **Detail** - Full artwork view with zoom/pan lightbox, metadata, public-domain badge, share, and a *Curator's Note*.

> **Curator's Note:** the AI-written note only works inside Claude's design environment
> (it calls `window.claude.complete`). On the deployed site it gracefully shows a
> "not available right now" message. Wiring it to a real AI backend is future work.

## The classic version

The previous single-file version is preserved at [`classic.html`](./classic.html)
(powered by [`main.js`](./main.js)) so you can compare the two experiences live.

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

- `index.html` – Salon app shell: styles, fonts, and the React/Babel script tags
- `js/` – The app, split into focused files:
  - `met.jsx` – Met API service (direct fetch → CORS-proxy fallback)
  - `store.jsx` – Favorites + daily-streak persistence (local storage)
  - `icons.jsx` – Line-icon set
  - `discover.jsx` · `search.jsx` · `daily.jsx` · `saved.jsx` – the four tab screens
  - `detail.jsx` – Detail overlay, lightbox, and curator's note
  - `app.jsx` – Tab routing, detail overlay host, and toasts
- `classic.html` + `main.js` – The previous single-file version, kept for reference
- `icons/` – App icons (favicons / PWA)
- `tools/icon-resizer/` – A standalone, browser‑only icon generator

## Project Structure

```
random-art-generator/
├── index.html        # Salon app
├── js/               # Salon app components (.jsx, transpiled in-browser)
├── classic.html      # previous version
├── main.js           # powers classic.html
├── manifest.json
├── icons/
└── tools/
    └── icon-resizer/
```

## Development

There is no build step. The `.jsx` files are transpiled in the browser by Babel
Standalone, so you just edit and reload. **Serve over `http://`** during development
(e.g. `python3 -m http.server 8000`) — opening `index.html` from `file://` won't work,
because the browser blocks Babel from loading the `.jsx` files over the `file:` protocol.

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
