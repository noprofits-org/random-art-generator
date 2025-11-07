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
  }

  function closeDrawer() {
    drawerOpen = false;
    els.drawer.classList.remove('open');
    els.drawerOverlay.classList.remove('visible');
    els.menuBtn.classList.remove('open');
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
    const small = a.primaryImageSmall || a.primaryImage || '';
    const high = a.primaryImage || '';
    els.img.alt = a.title || 'Artwork image';
    cleanupImageHandlers();
    els.img.src = small;
    if (high && high !== small) {
      const temp = new Image();
      temp.onload = () => { els.img.src = high; };
      temp.src = high;
      currentImage = temp;
    }

    const parts = [];
    if (a.title) parts.push(`<h2 class="title">${escapeHTML(a.title)}</h2>`);
    const artist = a.artistDisplayName || 'Unknown Artist';
    parts.push(`<div class="meta">${escapeHTML(artist)}${a.objectDate ? ` • ${escapeHTML(a.objectDate)}` : ''}</div>`);
    if (a.medium) parts.push(`<div class="meta">${escapeHTML(a.medium)}</div>`);
    if (a.objectURL) parts.push(`<a class="link" href="${a.objectURL}" target="_blank" rel="noopener">View on The Met</a>`);
    els.info.innerHTML = parts.join('');

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

  function escapeHTML(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
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
    await ensurePool();
    while (preloadQueue.length < count) {
      const id = pickRandom(imageIDs);
      try {
        const d = await fetchArtworkDetails(id);
        if (d && (d.primaryImage || d.primaryImageSmall)) {
          preloadQueue.push(d);
        }
      } catch(_) { /* skip */ }
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
  }

  function isFavorite(objectID) {
    return favorites.some(f => f.objectID === objectID);
  }

  function updateFavoriteButton() {
    if (hIndex < 0 || !history[hIndex]) return;
    const current = history[hIndex];
    const favorited = isFavorite(current.objectID);
    const heart = els.favoriteBtn.querySelector('.heart');
    if (favorited) {
      els.favoriteBtn.classList.add('favorited');
      heart.textContent = '♥';
      els.favoriteBtn.setAttribute('aria-label', 'Remove from favorites (F)');
      els.favoriteBtn.setAttribute('title', 'Remove from favorites (F or swipe down)');
    } else {
      els.favoriteBtn.classList.remove('favorited');
      heart.textContent = '♡';
      els.favoriteBtn.setAttribute('aria-label', 'Add to favorites (F)');
      els.favoriteBtn.setAttribute('title', 'Add to favorites (F or swipe down)');
    }
  }

  function showFavorites() {
    if (favorites.length === 0) {
      setStatus('No favorites yet. Swipe down to add!', 'info');
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

  // Deep link by ?id=, else random. Also populate departments and pool.
  (async function init(){
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
