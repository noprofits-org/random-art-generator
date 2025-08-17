// virtual-scroll.js - Virtual scrolling for performance optimization
// FIXED: Implement virtual scrolling for search results

class VirtualScroller {
    constructor(container, options = {}) {
        this.container = container;
        this.items = [];
        this.itemHeight = options.itemHeight || 200;
        this.bufferSize = options.bufferSize || 5;
        this.onRenderItem = options.onRenderItem || (() => {});
        
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        
        this.scrollHandler = this.handleScroll.bind(this);
        this.resizeHandler = this.handleResize.bind(this);
        
        this.init();
    }
    
    init() {
        // Create viewport
        this.viewport = document.createElement('div');
        this.viewport.style.cssText = `
            height: 100%;
            overflow-y: auto;
            position: relative;
        `;
        
        // Create content container
        this.content = document.createElement('div');
        this.content.style.cssText = `
            position: relative;
            width: 100%;
        `;
        
        // Create visible items container
        this.visibleContainer = document.createElement('div');
        this.visibleContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
        `;
        
        this.content.appendChild(this.visibleContainer);
        this.viewport.appendChild(this.content);
        this.container.appendChild(this.viewport);
        
        // Add event listeners
        this.viewport.addEventListener('scroll', this.scrollHandler, { passive: true });
        window.addEventListener('resize', this.resizeHandler);
        
        // Initial render
        this.handleResize();
    }
    
    setItems(items) {
        this.items = items;
        this.totalHeight = items.length * this.itemHeight;
        this.content.style.height = `${this.totalHeight}px`;
        this.render();
    }
    
    handleScroll() {
        this.scrollTop = this.viewport.scrollTop;
        this.render();
    }
    
    handleResize() {
        this.containerHeight = this.viewport.clientHeight;
        this.render();
    }
    
    render() {
        if (!this.items.length) return;
        
        // Calculate visible range
        const scrollTop = this.scrollTop;
        const visibleStart = Math.floor(scrollTop / this.itemHeight);
        const visibleEnd = Math.ceil((scrollTop + this.containerHeight) / this.itemHeight);
        
        // Add buffer
        this.startIndex = Math.max(0, visibleStart - this.bufferSize);
        this.endIndex = Math.min(this.items.length - 1, visibleEnd + this.bufferSize);
        
        // Clear container
        this.visibleContainer.innerHTML = '';
        
        // Render visible items
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            const item = this.items[i];
            const element = this.onRenderItem(item, i);
            
            if (element) {
                element.style.position = 'absolute';
                element.style.top = `${i * this.itemHeight}px`;
                element.style.height = `${this.itemHeight}px`;
                element.style.width = '100%';
                this.visibleContainer.appendChild(element);
            }
        }
        
        // Update container position
        this.visibleContainer.style.transform = `translateY(${this.startIndex * this.itemHeight}px)`;
        
        // Log performance
        if (window.MetLogger) {
            window.MetLogger.debug(`Virtual scroll: rendering items ${this.startIndex} to ${this.endIndex}`);
        }
    }
    
    scrollToIndex(index) {
        const scrollTop = index * this.itemHeight;
        this.viewport.scrollTop = scrollTop;
    }
    
    destroy() {
        this.viewport.removeEventListener('scroll', this.scrollHandler);
        window.removeEventListener('resize', this.resizeHandler);
        this.container.innerHTML = '';
    }
}

// Export for use
window.VirtualScroller = VirtualScroller;