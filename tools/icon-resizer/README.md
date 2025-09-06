# Icon Resizer Tool

A self‑contained, browser‑only tool to generate PWA icons at common sizes from a single source image.

## Features

- Drag & drop or file picker upload
- Preset sizes (48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512)
- Add custom sizes (16–1024)
- Quality scaling with high image smoothing
- Square crop when the source isn’t square
- Per‑icon download and fallback "download all" (individual downloads)
- Export manifest icon JSON snippet

## Usage

- Open `tools/icon-resizer/index.html` in your browser.
- Upload a 512×512 PNG with transparency (recommended). Non‑square images are center‑cropped to a square.
- Select sizes or add custom ones, click "Generate Selected Icons".
- Download individual icons or click "Download All" to save them one‑by‑one.
- Use "Copy Manifest Snippet" to paste into your `manifest.json`.

## Notes

- ZIP packaging is not bundled to avoid external dependencies. If you need a single ZIP, you can include JSZip via CDN and wire the `downloadAllAsZip` placeholder (see comments in source).
- This tool runs fully client‑side and does not require any build step.

## Recommended Manifest Snippet

```
{
  "icons": [
    { "src": "./icons/icon-48x48.png",  "sizes": "48x48",   "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-72x72.png",  "sizes": "72x72",   "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-96x96.png",  "sizes": "96x96",   "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-128x128.png","sizes": "128x128", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-144x144.png","sizes": "144x144", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-152x152.png","sizes": "152x152", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-167x167.png","sizes": "167x167", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-180x180.png","sizes": "180x180", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-192x192.png","sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-256x256.png","sizes": "256x256", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-384x384.png","sizes": "384x384", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-512x512.png","sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

