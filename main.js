'use strict';

(function () {
  const MET_API = 'https://collectionapi.metmuseum.org/public/collection/v1';
  const PROXIES = [
    { url: 'https://cors-proxy-xi-ten.vercel.app/api/proxy', mode: 'query' },
    { url: 'https://corsproxy.io/?', mode: 'path' },
    { url: 'https://api.allorigins.win/raw?url=', mode: 'query' }
  ];

  const els = {
    app: document.querySelector('.app-container'),
    btn: document.getElementById('randomBtn'),
    prev: document.getElementById('prevBtn'),
    next: document.getElementById('nextBtn'),
    status: document.getElementById('status'),
    img: document.getElementById('artImg'),
    imgHigh: document.getElementById('artImgHigh'),
    viewport: document.getElementById('imageViewport'),
    imageLoader: document.getElementById('imageLoader'),
    imageError: document.getElementById('imageError'),
    imageErrorBtn: document.getElementById('imageErrorBtn'),
    prevEdge: document.getElementById('prevEdge'),
    nextEdge: document.getElementById('nextEdge'),
    firstHint: document.getElementById('firstHint'),
    drawerToggle: document.getElementById('drawerToggle'),
    toast: document.getElementById('toast'),
    info: document.getElementById('info'),
    deptTag: document.getElementById('deptTag'),
    pdTag: document.getElementById('pdTag'),
    deptSelect: document.getElementById('deptSelect'),
    saveBtn: document.getElementById('saveBtn'),
    shareBtn: document.getElementById('shareBtn'),
    copyBtn: document.getElementById('copyBtn'),
    favoriteBtn: document.getElementById('favoriteBtn'),
    drawer: document.getElementById('drawer'),
    drawerOverlay: document.getElementById('drawerOverlay'),
    menuBtn: document.getElementById('menuBtn'),
    floatingFavoriteBtn: document.getElementById('floatingFavoriteBtn'),
    floatingDownloadBtn: document.getElementById('floatingDownloadBtn'),
    caption: document.getElementById('caption'),
    captionTitle: document.getElementById('captionTitle'),
    captionMeta: document.getElementById('captionMeta'),
    captionToggle: document.getElementById('captionToggle'),
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
  let currentDept = ''; // departmentId string or ''
  // Keep favorites small: store only the fields the UI reads.
  function minimalFavorite(a) {
    return {
      objectID: a.objectID,
      title: a.title,
      artistDisplayName: a.artistDisplayName,
      objectDate: a.objectDate,
      medium: a.medium,
      department: a.department,
      primaryImageSmall: a.primaryImageSmall,
      primaryImage: a.primaryImage,
      objectURL: a.objectURL,
      isPublicDomain: a.isPublicDomain,
    };
  }

  let favorites = JSON.parse(localStorage.getItem('met_favorites') || '[]').map(minimalFavorite);
  try { localStorage.setItem('met_favorites', JSON.stringify(favorites)); } catch (_) {}

  function saveFavorites() {
    try {
      localStorage.setItem('met_favorites', JSON.stringify(favorites));
    } catch (_) {
      setStatus('Storage full — could not save favorite.', 'error');
    }
  }

  let drawerOpen = false; // drawer state
  let preloading = false; // single-flight guard for ensurePreload

  function setStatus(msg, type = 'info') {
    els.status.textContent = msg;
    els.status.className = `status ${type}`;
  }

  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    // force reflow so the transition runs even on rapid successive toasts
    void els.toast.offsetWidth;
    els.toast.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('visible');
      toastTimer = setTimeout(() => { els.toast.hidden = true; toastTimer = null; }, 250);
    }, 1800);
  }

  let loaderTimer = null;
  function showLoader(delay = 150) {
    hideLoader();
    loaderTimer = setTimeout(() => {
      els.imageLoader.classList.add('visible');
      loaderTimer = null;
    }, delay);
  }
  function hideLoader() {
    if (loaderTimer) { clearTimeout(loaderTimer); loaderTimer = null; }
    els.imageLoader.classList.remove('visible');
  }

  function showImageError() {
    hideLoader();
    els.imageError.hidden = false;
  }
  function hideImageError() {
    els.imageError.hidden = true;
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

  // On-image caption (title overlay). The dismissed state is a sticky
  // preference so it carries across artworks once the user hides it.
  let captionDismissed = localStorage.getItem('met_caption_hidden') === '1';

  function updateCaption(a) {
    const title = a.title || 'Untitled';
    const artist = a.artistDisplayName || 'Unknown Artist';
    els.captionTitle.textContent = title;
    els.captionMeta.textContent = a.objectDate ? `${artist} • ${a.objectDate}` : artist;
    els.caption.setAttribute('aria-label', `${title}. Tap to hide title.`);
    els.caption.hidden = false;
    applyCaptionState();
  }

  function applyCaptionState() {
    if (els.caption.hidden) return;
    els.caption.classList.toggle('dismissed', captionDismissed);
    els.captionToggle.classList.toggle('visible', captionDismissed);
  }

  function setCaptionDismissed(dismissed) {
    captionDismissed = dismissed;
    try { localStorage.setItem('met_caption_hidden', dismissed ? '1' : '0'); } catch (_) {}
    applyCaptionState();
    if (!dismissed) els.caption.focus();
  }

  function renderArtwork(a) {
    updateURLParam('id', a.objectID);
    hideImageError();

    const small = safeHttpURL(a.primaryImageSmall || a.primaryImage || '');
    const high = safeHttpURL(a.primaryImage || '');
    const alt = a.title || 'Artwork image';
    els.img.alt = alt;

    cleanupImageHandlers();

    // Reset the high-res layer so the crossfade replays for the new artwork.
    els.imgHigh.classList.remove('loaded');
    els.imgHigh.removeAttribute('src');

    // Small/thumb first: show spinner if it's slow, hide on load, show error on failure.
    showLoader();
    els.img.onload = () => { hideLoader(); };
    els.img.onerror = () => { hideLoader(); showImageError(); };
    els.img.src = small;

    if (high && high !== small) {
      // Use the stacked high-res image so the swap fades in rather than flashing.
      els.imgHigh.onload = () => { els.imgHigh.classList.add('loaded'); };
      els.imgHigh.onerror = () => { /* keep the small version visible */ };
      els.imgHigh.src = high;
    }

    updateCaption(a);

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
        hideLoader();
        showImageError();
        setStatus("Couldn't find an image. Try again.", 'error');
        return;
      }

      renderArtwork(artwork);
      animateStack('fade');
      pushHistory(artwork);
      void ensurePreload();
      setStatus('Loaded.');
    } catch (err) {
      console.error(err);
      hideLoader();
      showImageError();
      setStatus('Error loading artwork. Please try again.', 'error');
    } finally {
      els.btn.disabled = false;
    }
  }

  // ---------- Enhancements ----------
  const LS_KEYS = {
    IMAGE_POOL_PREFIX: 'met_image_ids_pool_v2_',
    IMAGE_POOL_TS_PREFIX: 'met_image_ids_pool_ts_v2_',
  };

  function poolKeys(deptId) {
    const suffix = deptId || 'all';
    return {
      data: LS_KEYS.IMAGE_POOL_PREFIX + suffix,
      ts: LS_KEYS.IMAGE_POOL_TS_PREFIX + suffix,
    };
  }

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
    const keys = poolKeys(deptId);
    const now = Date.now();
    const ts = parseInt(localStorage.getItem(keys.ts) || '0', 10);
    const cached = localStorage.getItem(keys.data);
    const isFresh = now - ts < 6 * 60 * 60 * 1000; // 6 hours
    if (cached && isFresh) {
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
    try {
      localStorage.setItem(keys.data, JSON.stringify(imageIDs));
      localStorage.setItem(keys.ts, String(Date.now()));
    } catch (_) { /* quota exceeded — not fatal */ }
    // Fallback: if empty, use full object list
    if (imageIDs.length === 0) {
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
    els.img.onload = null;
    els.img.onerror = null;
    els.imgHigh.onload = null;
    els.imgHigh.onerror = null;
  }

  // History management
  function pushHistory(art) {
    // If this artwork is already the current one, don't duplicate the entry.
    if (hIndex >= 0 && history[hIndex] && history[hIndex].objectID === art.objectID) {
      return;
    }
    // if we're not at end, truncate forward history
    if (hIndex < history.length - 1) history.splice(hIndex + 1);
    history.push(art);
    hIndex = history.length - 1;
    updateNavButtons();
  }
  function updateNavButtons() {
    const atStart = hIndex <= 0;
    const atEnd = hIndex >= history.length - 1;
    els.prev.disabled = atStart;
    els.prevEdge.disabled = atStart;
    els.next.disabled = atEnd;
    els.nextEdge.disabled = atEnd;
  }
  function goPrev() {
    if (hIndex > 0) {
      hIndex--;
      renderArtwork(history[hIndex]);
      animateStack('prev');
      setStatus('Loaded from history.');
      updateNavButtons();
    } else {
      springBack(); // nothing earlier — settle a stray swipe back to center
    }
  }
  function goNext() {
    if (hIndex < history.length - 1) {
      hIndex++;
      renderArtwork(history[hIndex]);
      animateStack('next');
      setStatus('Loaded from history.');
      updateNavButtons();
    } else {
      // end of history → load fresh
      springBack();
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
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); saveCurrentImage(); }
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); setCaptionDismissed(!captionDismissed); }
  });

  // Touch gestures — live finger-tracking swipe with a settle/spring animation.
  const stack = els.img.parentElement; // .image-stack (holds both image layers)
  const minSwipeDistance = 50; // minimum distance to commit a swipe
  const maxTapTime = 300; // max time for a tap
  const maxTapMovement = 10; // max movement for a tap
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let dragging = false;
  let horizontal = false;

  function setStackTransition(on) {
    stack.style.transition = (on && !reduceMotion)
      ? 'transform 0.25s ease, opacity 0.25s ease'
      : 'none';
  }

  function springBack() {
    setStackTransition(true);
    stack.style.transform = 'translateX(0)';
    stack.style.opacity = '1';
  }

  // Slide the freshly-rendered artwork in from the side it came from.
  function animateStack(dir) {
    if (reduceMotion) { stack.style.transform = ''; stack.style.opacity = ''; return; }
    const from = dir === 'next' ? 32 : dir === 'prev' ? -32 : 0;
    setStackTransition(false);
    stack.style.transform = `translateX(${from}px)`;
    stack.style.opacity = dir ? '0.25' : '0.4';
    void stack.offsetWidth; // force reflow so the transition replays
    setStackTransition(true);
    stack.style.transform = 'translateX(0)';
    stack.style.opacity = '1';
  }

  els.img.parentElement.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) { dragging = false; return; }
    touchStartX = e.touches[0].screenX;
    touchStartY = e.touches[0].screenY;
    touchStartTime = Date.now();
    dragging = true;
    horizontal = false;
    setStackTransition(false);
  }, { passive: true });

  els.img.parentElement.addEventListener('touchmove', (e) => {
    if (!dragging || drawerOpen || e.touches.length > 1) return;
    const dx = e.touches[0].screenX - touchStartX;
    const dy = e.touches[0].screenY - touchStartY;
    if (!horizontal && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) horizontal = true;
    if (horizontal) {
      // Add resistance when there's nowhere to go in that direction.
      const atEdge = (dx > 0 && hIndex <= 0);
      const eff = dx * (atEdge ? 0.25 : 0.85);
      stack.style.transform = `translateX(${eff}px)`;
      stack.style.opacity = String(Math.max(0.6, 1 - Math.abs(eff) / 700));
    }
  }, { passive: true });

  els.img.parentElement.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    const duration = Date.now() - touchStartTime;

    // Tap: new random (or close the drawer if it's open).
    if (duration < maxTapTime && Math.abs(dx) < maxTapMovement && Math.abs(dy) < maxTapMovement) {
      springBack();
      if (drawerOpen) closeDrawer(); else loadRandom();
      return;
    }

    // Horizontal swipe past the threshold commits a navigation.
    if (horizontal && !drawerOpen && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipeDistance) {
      if (dx > 0) goPrev(); else goNext();
    } else {
      springBack();
    }
  }, { passive: true });

  // Menu button and overlay handlers
  els.menuBtn.addEventListener('click', toggleDrawer);
  els.drawerOverlay.addEventListener('click', closeDrawer);

  // On-image caption: tap the title to hide it, tap the pill to bring it back.
  els.caption.addEventListener('click', () => setCaptionDismissed(true));
  els.caption.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCaptionDismissed(true); }
  });
  els.captionToggle.addEventListener('click', () => setCaptionDismissed(false));

  // Favorites system
  function toggleFavorite() {
    if (hIndex < 0 || !history[hIndex]) return;
    const current = history[hIndex];
    const idx = favorites.findIndex(f => f.objectID === current.objectID);
    if (idx >= 0) {
      favorites.splice(idx, 1);
      showToast('Removed from favorites');
    } else {
      favorites.push(minimalFavorite(current));
      showToast('Added to favorites');
    }
    saveFavorites();
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

    els.favoriteBtn.setAttribute('aria-pressed', favorited ? 'true' : 'false');
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
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
      item.setAttribute('aria-label', `Open ${fav.title || 'Untitled'}`);

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
          saveFavorites();
          renderFavoritesList();
          updateFavoriteButton();
          showToast('Removed from favorites');
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

      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });

      els.favoritesList.appendChild(item);
    });
  }

  function extForType(type) {
    if (/png/i.test(type)) return 'png';
    if (/webp/i.test(type)) return 'webp';
    if (/gif/i.test(type)) return 'gif';
    return 'jpg';
  }

  function downloadFilename(a, ext = 'jpg') {
    const slug = (s) => String(s || '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    const parts = [slug(a.artistDisplayName), slug(a.title), a.objectID].filter(Boolean);
    return (parts.length ? parts.join('-') : `met-artwork-${a.objectID}`) + '.' + ext;
  }

  // Fetch the image as a Blob, trying a direct request first and then falling
  // back through the CORS proxies. The Met image CDN does not reliably send
  // CORS headers, so a direct fetch often fails — the proxies are what make
  // saving work in practice. Returns null only if every source failed.
  async function fetchImageBlob(imageUrl) {
    const sources = [imageUrl, ...PROXIES.map(p => proxied(imageUrl, p))];
    for (const src of sources) {
      try {
        const r = await fetch(src);
        if (!r.ok) continue;
        const blob = await r.blob();
        // Skip proxies that hand back an HTML error page instead of the image.
        if (blob && blob.size > 0 && !/^text\//i.test(blob.type)) return blob;
      } catch (_) { /* try the next source */ }
    }
    return null;
  }

  // True when the browser can share image files via the native share sheet —
  // on iOS/Android this is the path that offers "Save Image" into Photos.
  function canShareImageFile() {
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
    try {
      const probe = new File(['x'], 'probe.jpg', { type: 'image/jpeg' });
      return navigator.canShare({ files: [probe] });
    } catch (_) {
      return false;
    }
  }

  let savingImage = false; // single-flight guard for saveCurrentImage
  function setSaveButtonsDisabled(disabled) {
    [els.saveBtn, els.floatingDownloadBtn].forEach((b) => {
      if (b) b.disabled = disabled;
    });
  }

  async function saveCurrentImage() {
    if (savingImage) return;
    if (hIndex < 0 || !history[hIndex]) {
      showToast('No image to save');
      return;
    }
    const current = history[hIndex];
    const imageUrl = safeHttpURL(current.primaryImage || current.primaryImageSmall || '');
    if (!imageUrl) {
      showToast('No image available');
      return;
    }

    savingImage = true;
    setSaveButtonsDisabled(true);
    setStatus('Preparing image…', 'loading');

    try {
      const blob = await fetchImageBlob(imageUrl);
      if (!blob) {
        // Direct fetch and every proxy failed. Open the raw image so the user
        // can still long-press / right-click to save it manually.
        window.open(imageUrl, '_blank', 'noopener,noreferrer');
        setStatus('Ready.', 'info');
        showToast('Couldn’t download automatically — opened image in a new tab');
        return;
      }

      const filename = downloadFilename(current, extForType(blob.type));

      // On mobile the native share sheet is the reliable route into Photos/Files.
      if (canShareImageFile()) {
        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: current.title || 'Met Artwork' });
            setStatus('Ready.', 'info');
            return;
          } catch (err) {
            if (err && err.name === 'AbortError') {
              setStatus('Ready.', 'info');
              return;
            }
            // Any other share failure: fall through to the download link.
          }
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Give the browser time to start the download before releasing the URL.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      setStatus('Ready.', 'info');
      showToast('Image saved');
    } finally {
      savingImage = false;
      setSaveButtonsDisabled(false);
    }
  }

  els.btn.addEventListener('click', loadRandom);
  els.prev.addEventListener('click', goPrev);
  els.next.addEventListener('click', goNext);
  els.prevEdge.addEventListener('click', goPrev);
  els.nextEdge.addEventListener('click', goNext);
  els.favoriteBtn.addEventListener('click', toggleFavorite);
  els.floatingFavoriteBtn.addEventListener('click', toggleFavorite);
  els.saveBtn.addEventListener('click', saveCurrentImage);
  els.floatingDownloadBtn.addEventListener('click', saveCurrentImage);
  if (canShareImageFile()) {
    els.floatingDownloadBtn.setAttribute('aria-label', 'Save to Photos');
    els.floatingDownloadBtn.setAttribute('title', 'Save to Photos');
  }
  els.imageErrorBtn.addEventListener('click', () => { hideImageError(); loadRandom(); });

  // Desktop drawer collapse toggle (button only appears on desktop via CSS).
  const DRAWER_COLLAPSED_KEY = 'met_drawer_collapsed';
  function setDrawerCollapsed(collapsed) {
    els.app.classList.toggle('drawer-collapsed', collapsed);
    els.drawerToggle.setAttribute('aria-label', collapsed ? 'Show sidebar' : 'Hide sidebar');
    els.drawerToggle.setAttribute('title', collapsed ? 'Show sidebar' : 'Hide sidebar');
    try { localStorage.setItem(DRAWER_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (_) {}
  }
  els.drawerToggle.addEventListener('click', () => {
    setDrawerCollapsed(!els.app.classList.contains('drawer-collapsed'));
  });
  if (localStorage.getItem(DRAWER_COLLAPSED_KEY) === '1') setDrawerCollapsed(true);

  // One-time first-run hint on mobile viewports.
  const FIRST_HINT_KEY = 'met_first_hint_seen_v1';
  function maybeShowFirstHint() {
    if (localStorage.getItem(FIRST_HINT_KEY) === '1') return;
    if (window.matchMedia('(min-width: 768px)').matches) return;
    els.firstHint.hidden = false;
    const dismiss = () => {
      els.firstHint.hidden = true;
      try { localStorage.setItem(FIRST_HINT_KEY, '1'); } catch (_) {}
      window.removeEventListener('touchstart', dismiss, true);
      clearTimeout(hintTimer);
    };
    const hintTimer = setTimeout(dismiss, 4500);
    window.addEventListener('touchstart', dismiss, { passive: true, capture: true, once: true });
  }

  // Deep link by ?id=, else random. Also populate departments and pool.
  (async function init(){
    renderFavoritesList(); // Initialize favorites list
    updateNavButtons();
    maybeShowFirstHint();
    showLoader(0); // visible immediately while the pool builds
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
