#!/bin/bash

# Build script for Met Art Generator
# Creates production-ready bundled files

echo "Building Met Art Generator for production..."

# Create build directory
mkdir -p build

# Copy HTML file
echo "Copying HTML..."
cp index.html build/

# Copy and minify CSS
echo "Minifying CSS..."
if command -v csso &> /dev/null; then
    csso styles.css -o build/styles.css
else
    # If csso is not installed, just copy the file
    cp styles.css build/
    echo "Note: Install csso-cli for CSS minification (npm install -g csso-cli)"
fi

# Minify JavaScript
echo "Minifying JavaScript..."
if command -v terser &> /dev/null; then
    terser app.js -c -m -o build/app.js
else
    # If terser is not installed, just copy the file
    cp app.js build/
    echo "Note: Install terser for JS minification (npm install -g terser)"
fi

# Copy other necessary files
echo "Copying assets..."
cp -r icons build/
cp manifest.json build/
cp service-worker.js build/

# Create a simple build info file
echo "Creating build info..."
cat > build/build-info.txt << EOF
Met Art Generator Production Build
Built on: $(date)
Files included:
- index.html
- app.js (consolidated)
- styles.css
- manifest.json
- service-worker.js
- icons/
EOF

echo "Build complete! Files are in the 'build' directory."
echo ""
echo "To deploy:"
echo "1. Upload all files from the 'build' directory to your web server"
echo "2. Ensure your server has HTTPS enabled (required for PWA features)"
echo "3. Test the service worker and offline functionality"
echo ""
echo "For optimal performance, consider:"
echo "- Enabling gzip compression on your server"
echo "- Setting appropriate cache headers"
echo "- Using a CDN for static assets"