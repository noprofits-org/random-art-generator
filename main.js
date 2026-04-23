'use strict';

(function () {
  const MET_API = 'https://collectionapi.metmuseum.org/public/collection/v1';
  const PROXIES = [
    { url: 'https://cors-proxy-xi-ten.vercel.app/api/proxy', mode: 'query' },
    { url: 'https://corsproxy.io/?', mode: 'path' },
    { url: 'https://api.allorigins.win/raw?url=', mode: 'query' }
  ];

  const els = {
    btn: document.getElementById('randomBtn'),
    prev: document.getElementById('prevBtn'),
    next: document.getElementById('nextBtn'),
    status: document.getElementById('status'),
    img: document.getElementById('artImg'),
    info: document.getElementById('info'),
    deptTag: document.getElementById('deptTag'),
    pdTag: document.getElementById('pdTag'),
    deptSelect: document.getElementById('deptSelect'),
    shareBtn: document.getElementById('shareBtn'),
    copyBtn: document.getElementById('copyBtn'),
    favoriteBtn: document.getElementById('favoriteBtn'),
    drawer: document.getElementById('drawer'),
    drawerOverlay: document.getElementById('drawerOverlay'),
    menuBtn: document.getElementById('menuBtn'),
    floatingFavoriteBtn: document.getElementById('floatingFavoriteBtn'),
    floatingDownloadBtn: document.getElementById('floatingDownloadBtn'),
    favoritesList: document.getElementById('favoritesList'),
    favoritesCount: document.getElementById('favoritesCount'),
  };

  // In-memory state
  let objectIDs = null; // raw object IDs (fallback)
  let imageIDs = [];    // pool of IDs that have images (from /search)
  let preloadQueue = []; // array of preloaded artwork detail objects
  const history = [];   // array of artwork detail objects
  let hIndex = -1;      // pointer into history
  let currentDetailController = null; // AbortController for details
  let currentImage = null; // current image element load handler cleanup
  let currentDept = ''; // departmentId string or ''
  let favorites = JSON.parse(localStorage.getItem('met_favorites') || '[]'); // array of artwork objects
  let drawerOpen = false; // drawer state
  let preloading = false; // single-flight guard for ensurePreload

  function setStatus(msg, type = 'info') {
    els.status.textContent = msg;
    els.status.className = `status ${type}`;
  }

  function proxied(url, proxy) {
    return proxy.mode === 'query' ? `${proxy.url}?url=${encodeURIComponent(url)}`
                                   : `${proxy.url}${encodeURIComponent(url)}`;
  }

  // Drawer functions
  function openDrawer() {
    drawerOpen = true;
    els.drawer.classList.add('open');
    els.drawerOverlay.classList.add('visible');
    els.menuBtn.classList.add('open');
    els.menuBtn.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    drawerOpen = false;
    els.drawer.classList.remove('open');
    els.drawerOverlay.classList.remove('visible');
    els.menuBtn.classList.remove('open');
    els.menuBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleDrawer() {
    if (drawerOpen) closeDrawer();
    else openDrawer();
  }

  async function getJSONWithFallback(url, { retries = 2 } = {}) {
    // Try proxies first to avoid CORS noise, then direct
    for (let attempt = 0; attempt <= retries; attempt++) {
      // proxies
      for (const p of PROXIES) {
        try {
          const r = await fetch(proxied(url, p), { headers: { 'Accept': 'application/json' } });
          if (!r.ok) throw new Error(`Proxy HTTP ${r.status}`);
          return await r.json();
        } catch (_) { /* try next proxy */ }
      }
      // direct
      try {
        const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      } catch (e) {
        if (attempt === retries) throw e;
        await sleep(300 * Math.pow(2, attempt));
      }
    }
  }

  async function ensureObjectIDs() {
    if (objectIDs && Array.isArray(objectIDs) && objectIDs.length) return objectIDs;
    setStatus('Loading collection…', 'loading');
    const data = await getJSONWithFallback(`${MET_API}/objects`);
    if (!data || !data.objectIDs || !data.objectIDs.length) {
      throw new Error('No objects returned');
    }
    objectIDs = data.objectIDs;
    return objectIDs;
  }

  async function fetchArtworkDetails(id) {
    if (currentDetailController) currentDetailController.abort();
    currentDetailController = new AbortController();
    const url = `${MET_API}/objects/${id}`;
    // Attempt direct, then proxies with retries
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(url, { signal: currentDetailController.signal, headers: { 'Accept': 'application/json' } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      } catch (e) {
        // proxies
        for (const p of PROXIES) {
          try {
            const r = await fetch(proxied(url, p), { signal: currentDetailController.signal, headers: { 'Accept': 'application/json' } });
            if (!r.ok) throw new Error(`Proxy HTTP ${r.status}`);
            return await r.json();
          } catch (_) { /* next */ }
        }
        await sleep(300 * Math.pow(2, attempt));
      }
    }
    throw new Error('Failed to fetch details');
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function renderArtwork(a) {
    // update URL and share state
    updateURLParam('id', a.objectID);

    // progressive image: small then high-res
    const small = safeHttpURL(a.primaryImageSmall || a.primaryImage || '');
    const high = safeHttpURL(a.primaryImage || '');
    els.img.alt = a.title || 'Artwork image';
    cleanupImageHandlers();
    els.img.src = small;
    if (high && high !== small) {
      const temp = new Image();
      temp.onload = () => { els.img.src = high; };
      temp.src = high;
      currentImage = temp;
    }

    els.info.replaceChildren();
    if (a.title) {
      const h = document.createElement('h2');
      h.className = 'title';
      h.textContent = a.title;
      els.info.appendChild(h);
    }
    const artist = a.artistDisplayName || 'Unknown Artist';
    const metaArtist = document.createElement('div');
    metaArtist.className = 'meta';
    metaArtist.textContent = a.objectDate ? `${artist} • ${a.objectDate}` : artist;
    els.info.appendChild(metaArtist);
    if (a.medium) {
      const metaMedium = document.createElement('div');
      metaMedium.className = 'meta';
      metaMedium.textContent = a.medium;
      els.info.appendChild(metaMedium);
    }
    const href = safeHttpURL(a.objectURL);
    if (href) {
      const link = document.createElement('a');
      link.className = 'link';
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'View on The Met';
      els.info.appendChild(link);
    }

    if (a.department) {
      els.deptTag.style.display = '';
      els.deptTag.textContent = a.department;
    } else {
      els.deptTag.style.display = 'none';
    }

    if (a.isPublicDomain) {
      els.pdTag.style.display = '';
    } else {
      els.pdTag.style.display = 'none';
    }

    updateFavoriteButton();
  }

  // Only allow http(s) URLs through to href/src attributes.
  function safeHttpURL(u) {
    if (!u) return '';
    try {
      const url = new URL(u, window.location.href);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch (_) {}
    return '';
  }

  async function loadRandom() {
    try {
      els.btn.disabled = true;
      setStatus('Finding artwork…', 'loading');

      const artwork = await getNextArtwork();

      if (!artwork) {
        setStatus("Couldn't find an image. Try again.", 'error');
        return;
      }

      renderArtwork(artwork);
      pushHistory(artwork);
      void ensurePreload();
      setStatus('Loaded.');
    } catch (err) {
      console.error(err);
      setStatus('Error loading artwork. Please try again.', 'error');
    } finally {
      els.btn.disabled = false;
    }
  }

  // ---------- Enhancements ----------
  const LS_KEYS = {
    IMAGE_POOL: 'met_image_ids_pool_v1',
    IMAGE_POOL_TS: 'met_image_ids_pool_ts_v1',
  };

  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

  function updateURLParam(key, value) {
    const url = new URL(window.location.href);
    if (value === '' || value === null || value === undefined) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
    historyReplace(url);
  }

  function historyReplace(url) {
    try { window.history.replaceState({}, '', url); } catch(_) {}
  }

  function readParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  async function buildImagePool(deptId = '') {
    // try cache
    const now = Date.now();
    const ts = parseInt(localStorage.getItem(LS_KEYS.IMAGE_POOL_TS) || '0', 10);
    const cached = localStorage.getItem(LS_KEYS.IMAGE_POOL);
    const isFresh = now - ts < 6 * 60 * 60 * 1000; // 6 hours
    if (cached && isFresh && !deptId) {
      imageIDs = JSON.parse(cached);
      return imageIDs;
    }

    // Collect via /search with hasImages=true using random letters
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    shuffle(letters);
    const sample = letters.slice(0, 6); // keep it small to reduce requests
    const out = new Set();
    const maxCollect = 600; // cap
    for (const letter of sample) {
      let url = `${MET_API}/search?hasImages=true&q=${encodeURIComponent(letter)}`;
      if (deptId) url += `&departmentId=${encodeURIComponent(deptId)}`;
      try {
        const data = await getJSONWithFallback(url, { retries: 1 });
        if (data && data.objectIDs) {
          for (const id of data.objectIDs) {
            out.add(id);
            if (out.size >= maxCollect) break;
          }
        }
      } catch(_) { /* skip this letter */ }
      if (out.size >= maxCollect) break;
    }
    imageIDs = [...out];
    if (!deptId) {
      localStorage.setItem(LS_KEYS.IMAGE_POOL, JSON.stringify(imageIDs));
      localStorage.setItem(LS_KEYS.IMAGE_POOL_TS, String(Date.now()));
    }
    // Fallback: if empty, use full object list
    if (imageIDs.length === 0) {
      // Fall back to full objects list
      const ids = await ensureObjectIDs();
      imageIDs = ids;
    }
    return imageIDs;
  }

  function shuffle(arr) {
    for (let i = arr.length -1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function getNextArtwork() {
    // use preloaded if available
    if (preloadQueue.length) return preloadQueue.shift();
    // else fetch from pool
    await ensurePool();
    for (let tries = 0; tries < 10; tries++) {
      const id = pickRandom(imageIDs);
      try {
        const d = await fetchArtworkDetails(id);
        if (d && (d.primaryImage || d.primaryImageSmall)) return d;
      } catch(_) {}
    }
    return null;
  }

  async function ensurePool() {
    if (!imageIDs || imageIDs.length === 0) {
      setStatus('Building image pool…', 'loading');
      await buildImagePool(currentDept);
    }
  }

  async function ensurePreload(count = 3) {
    if (preloading) return;
    preloading = true;
    try {
      await ensurePool();
      let attempts = 0;
      const maxAttempts = count * 6;
      while (preloadQueue.length < count && attempts < maxAttempts) {
        attempts++;
        const id = pickRandom(imageIDs);
        try {
          const d = await fetchArtworkDetails(id);
          if (d && (d.primaryImage || d.primaryImageSmall)) {
            preloadQueue.push(d);
          }
        } catch(_) { /* skip */ }
      }
    } finally {
      preloading = false;
    }
  }

  function cleanupImageHandlers() {
    if (currentImage) {
      currentImage.onload = null;
      currentImage = null;
    }
  }

  // History management
  function pushHistory(art) {
    // if we're not at end, truncate forward history
    if (hIndex < history.length - 1) history.splice(hIndex + 1);
    history.push(art);
    hIndex = history.length - 1;
    updateNavButtons();
  }
  function updateNavButtons() {
    els.prev.disabled = hIndex <= 0;
    els.next.disabled = hIndex >= history.length - 1;
  }
  function goPrev() {
    if (hIndex > 0) {
      hIndex--;
      renderArtwork(history[hIndex]);
      setStatus('Loaded from history.');
      updateNavButtons();
    }
  }
  function goNext() {
    if (hIndex < history.length - 1) {
      hIndex++;
      renderArtwork(history[hIndex]);
      setStatus('Loaded from history.');
      updateNavButtons();
    } else {
      // end of history → load fresh
      loadRandom();
    }
  }

  // Departments
  async function loadDepartments() {
    try {
      const data = await getJSONWithFallback(`${MET_API}/departments`, { retries: 1 });
      if (!data || !data.departments) return;
      for (const d of data.departments) {
        const opt = document.createElement('option');
        opt.value = String(d.departmentId);
        opt.textContent = d.displayName;
        els.deptSelect.appendChild(opt);
      }
      // set from URL param
      const deptParam = readParam('dept');
      if (deptParam) {
        els.deptSelect.value = deptParam;
        currentDept = deptParam;
      }
    } catch(_){}
  }

  els.deptSelect.addEventListener('change', async () => {
    currentDept = els.deptSelect.value;
    updateURLParam('dept', currentDept || null);
    imageIDs = []; // reset pool
    preloadQueue = [];
    await ensurePool();
    loadRandom();
  });

  // Share / Copy
  els.copyBtn.addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => setStatus('Link copied.', 'info'))
      .catch(() => setStatus('Copy failed.', 'error'));
  });
  els.shareBtn.addEventListener('click', async () => {
    if (navigator.share && history[hIndex]) {
      try {
        await navigator.share({ title: history[hIndex].title || 'Met Artwork', url: window.location.href });
      } catch(_){}
    } else {
      els.copyBtn.click();
    }
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerOpen) { e.preventDefault(); closeDrawer(); return; }
    // Ignore shortcuts when user is interacting with a form control.
    const t = e.target;
    if (t instanceof Element) {
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t.isContentEditable) return;
    }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); loadRandom(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFavorite(); }
  });

  // Touch gestures
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let touchStartTime = 0;
  const minSwipeDistance = 50; // minimum distance for swipe
  const maxTapTime = 300; // max time for tap
  const maxTapMovement = 10; // max movement for tap

  // Image viewport gestures
  els.img.parentElement.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    touchStartTime = Date.now();
  }, { passive: true });

  els.img.parentElement.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    const touchDuration = Date.now() - touchStartTime;
    handleImageGesture(touchDuration);
  }, { passive: true });

  function handleImageGesture(duration) {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);

    // Check for tap
    if (duration < maxTapTime && absDiffX < maxTapMovement && absDiffY < maxTapMovement) {
      if (drawerOpen) {
        closeDrawer();
      } else {
        loadRandom();
      }
      return;
    }

    // Only allow navigation swipes when drawer is closed
    if (!drawerOpen && absDiffX > absDiffY && absDiffX > minSwipeDistance) {
      if (diffX > 0) {
        // Swipe right = previous
        goPrev();
      } else {
        // Swipe left = next
        goNext();
      }
    }
  }

  // Menu button and overlay handlers
  els.menuBtn.addEventListener('click', toggleDrawer);
  els.drawerOverlay.addEventListener('click', closeDrawer);

  // Favorites system
  function toggleFavorite() {
    if (hIndex < 0 || !history[hIndex]) return;
    const current = history[hIndex];
    const idx = favorites.findIndex(f => f.objectID === current.objectID);
    if (idx >= 0) {
      favorites.splice(idx, 1);
      setStatus('Removed from favorites', 'info');
    } else {
      favorites.push(current);
      setStatus('Added to favorites!', 'info');
    }
    localStorage.setItem('met_favorites', JSON.stringify(favorites));
    updateFavoriteButton();
    renderFavoritesList();
  }

  function isFavorite(objectID) {
    return favorites.some(f => f.objectID === objectID);
  }

  function updateFavoriteButton() {
    if (hIndex < 0 || !history[hIndex]) return;
    const current = history[hIndex];
    const favorited = isFavorite(current.objectID);
    const heart = els.favoriteBtn.querySelector('.heart');
    const floatingHeart = els.floatingFavoriteBtn.querySelector('.heart-float');

    if (favorited) {
      els.favoriteBtn.classList.add('favorited');
      heart.textContent = '♥';
      els.favoriteBtn.setAttribute('aria-label', 'Remove from favorites (F)');
      els.favoriteBtn.setAttribute('title', 'Remove from favorites');

      els.floatingFavoriteBtn.classList.add('favorited');
      floatingHeart.textContent = '♥';
    } else {
      els.favoriteBtn.classList.remove('favorited');
      heart.textContent = '♡';
      els.favoriteBtn.setAttribute('aria-label', 'Add to favorites (F)');
      els.favoriteBtn.setAttribute('title', 'Add to favorites');

      els.floatingFavoriteBtn.classList.remove('favorited');
      floatingHeart.textContent = '♡';
    }
  }

  function renderFavoritesList() {
    els.favoritesCount.textContent = favorites.length;
    els.favoritesList.replaceChildren();

    if (favorites.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'favorites-empty';
      empty.textContent = 'No favorites yet. Tap the heart to add!';
      els.favoritesList.appendChild(empty);
      return;
    }

    favorites.forEach((fav, idx) => {
      const item = document.createElement('div');
      item.className = 'favorite-item';
      item.dataset.favIndex = String(idx);

      const thumb = safeHttpURL(fav.primaryImageSmall || fav.primaryImage || '');
      if (thumb) {
        const img = document.createElement('img');
        img.src = thumb;
        img.alt = '';
        img.className = 'favorite-item-thumb';
        img.loading = 'lazy';
        item.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'favorite-item-thumb';
        item.appendChild(placeholder);
      }

      const info = document.createElement('div');
      info.className = 'favorite-item-info';
      const title = document.createElement('div');
      title.className = 'favorite-item-title';
      title.textContent = fav.title || 'Untitled';
      const artist = document.createElement('div');
      artist.className = 'favorite-item-artist';
      artist.textContent = fav.artistDisplayName || 'Unknown Artist';
      info.appendChild(title);
      info.appendChild(artist);
      item.appendChild(info);

      const remove = document.createElement('button');
      remove.className = 'favorite-item-remove';
      remove.type = 'button';
      remove.dataset.removeIndex = String(idx);
      remove.setAttribute('aria-label', 'Remove favorite');
      remove.textContent = '×';
      item.appendChild(remove);

      item.addEventListener('click', (e) => {
        const target = e.target;
        if (target instanceof Element && target.closest('.favorite-item-remove')) {
          const removeIdx = parseInt(target.closest('.favorite-item-remove').dataset.removeIndex, 10);
          favorites.splice(removeIdx, 1);
          localStorage.setItem('met_favorites', JSON.stringify(favorites));
          renderFavoritesList();
          updateFavoriteButton();
          setStatus('Removed from favorites', 'info');
          return;
        }
        const favIdx = parseInt(item.dataset.favIndex, 10);
        const fav = favorites[favIdx];
        if (fav) {
          renderArtwork(fav);
          pushHistory(fav);
          setStatus('Loaded favorite', 'info');
          closeDrawer();
        }
      });

      els.favoritesList.appendChild(item);
    });
  }

  function downloadCurrentImage() {
    if (hIndex < 0 || !history[hIndex]) {
      setStatus('No image to download', 'error');
      return;
    }

    const current = history[hIndex];
    const imageUrl = current.primaryImage || current.primaryImageSmall;

    if (!imageUrl) {
      setStatus('No image available for download', 'error');
      return;
    }

    // Create a temporary link and trigger download
    const link = document.createElement('a');
    const filename = `met-artwork-${current.objectID}.jpg`;
    link.href = imageUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatus('Download started', 'info');
  }

  function showFavorites() {
    if (favorites.length === 0) {
      setStatus('No favorites yet. Tap the heart to add!', 'info');
      return;
    }
    const random = favorites[Math.floor(Math.random() * favorites.length)];
    renderArtwork(random);
    pushHistory(random);
    setStatus(`Showing favorite (${favorites.length} total)`, 'info');
  }

  els.btn.addEventListener('click', loadRandom);
  els.prev.addEventListener('click', goPrev);
  els.next.addEventListener('click', goNext);
  els.favoriteBtn.addEventListener('click', toggleFavorite);
  els.floatingFavoriteBtn.addEventListener('click', toggleFavorite);
  els.floatingDownloadBtn.addEventListener('click', downloadCurrentImage);

  // Deep link by ?id=, else random. Also populate departments and pool.
  (async function init(){
    renderFavoritesList(); // Initialize favorites list
    await loadDepartments();
    await ensurePool();
    const idParam = readParam('id');
    if (idParam) {
      try {
        setStatus('Loading artwork…', 'loading');
        const a = await fetchArtworkDetails(idParam);
        if (a && (a.primaryImage || a.primaryImageSmall)) {
          renderArtwork(a); pushHistory(a);
          setStatus('Loaded.');
          void ensurePreload();
          return;
        }
      } catch(_){}
    }
    loadRandom();
  })();
})();
