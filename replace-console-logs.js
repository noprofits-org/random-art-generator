// Utility script to replace console.log with MetLogger.log
// Run this in browser console to update all logging

const replaceConsoleLogs = () => {
    const scripts = [
        'api.js', 'app.js', 'artwork.js', 'favorites.js', 
        'filters.js', 'search-results.js', 'ui.js', 'init.js'
    ];
    
    scripts.forEach(script => {
        fetch(script)
            .then(r => r.text())
            .then(content => {
                // Replace console.log with MetLogger.log
                let updated = content.replace(/console\.log\(/g, 'window.MetLogger.log(');
                
                // Keep console.error and console.warn as is
                updated = updated.replace(/window\.MetLogger\.log\((.+Error.+)\)/g, 'console.error($1)');
                
                console.log(`Updated ${script}:`, updated.includes('MetLogger') ? 'Success' : 'No changes');
                
                // For manual review - copy to clipboard
                if (updated !== content) {
                    console.log(`Changes for ${script}:`, updated);
                }
            });
    });
};

// Note: This is a helper script - actual replacements will be done manually