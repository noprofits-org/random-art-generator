// met.jsx — Metropolitan Museum of Art Collection API service
// Mirrors the working repo: direct fetch, then CORS-proxy fallback.
// No API key required. Exposes helpers on window.

const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// Direct first; then the repo's own proxy; then a public fallback.
const PROXY_WRAPS = [
  (u) => u,
  (u) => 'https://cors-proxy-xi-ten.vercel.app/api/proxy?url=' + encodeURIComponent(u),
  (u) => 'https://corsproxy.io/?' + encodeURIComponent(u),
];

async function fetchJSON(url) {
  let lastErr;
  for (const wrap of PROXY_WRAPS) {
    try {
      const res = await fetch(wrap(url), { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('fetch failed');
}

// ── Seed terms: rotate these so a session surfaces broad variety while
// still guaranteeing every pool item HAS an image (hasImages=true). ──
const SEED_TERMS = [
  'portrait', 'landscape', 'flowers', 'figure', 'study', 'river', 'garden',
  'still life', 'horse', 'temple', 'goddess', 'vessel', 'mask', 'textile',
  'drawing', 'sculpture', 'ship', 'king', 'queen', 'dancer', 'tree', 'moon',
  'gold', 'silver', 'blue', 'red', 'green', 'ivory', 'bronze', 'marble',
  'manuscript', 'tapestry', 'armor', 'crown', 'lion', 'bird', 'dragon',
  'mountain', 'ocean', 'angel', 'saint', 'mythology', 'harvest', 'night',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Pool of object IDs that have images, optionally scoped to a department.
async function fetchPool({ departmentId = null, term = null } = {}) {
  const q = term || pick(SEED_TERMS);
  let url = MET_BASE + '/search?hasImages=true&q=' + encodeURIComponent(q);
  if (departmentId) url += '&departmentId=' + departmentId;
  const data = await fetchJSON(url);
  return shuffle(data.objectIDs || []);
}

async function fetchObject(id) {
  const o = await fetchJSON(MET_BASE + '/objects/' + id);
  if (!o || (!o.primaryImageSmall && !o.primaryImage)) return null;
  return normalize(o);
}

function normalize(o) {
  return {
    id: o.objectID,
    title: (o.title || 'Untitled').trim(),
    artist: (o.artistDisplayName || '').trim(),
    artistBio: (o.artistDisplayBio || '').trim(),
    date: (o.objectDate || '').trim(),
    medium: (o.medium || '').trim(),
    dimensions: (o.dimensions || '').trim(),
    department: (o.department || '').trim(),
    culture: (o.culture || '').trim(),
    period: (o.period || '').trim(),
    classification: (o.classification || '').trim(),
    creditLine: (o.creditLine || '').trim(),
    gallery: (o.GalleryNumber || '').trim(),
    isPublicDomain: !!o.isPublicDomain,
    url: o.objectURL || '',
    img: o.primaryImage || o.primaryImageSmall || '',
    thumb: o.primaryImageSmall || o.primaryImage || '',
    extraImages: (o.additionalImages || []).slice(0, 6),
    tags: (o.tags || []).map((t) => t.term).filter(Boolean).slice(0, 6),
  };
}

let _departments = null;
async function fetchDepartments() {
  if (_departments) return _departments;
  const data = await fetchJSON(MET_BASE + '/departments');
  _departments = (data.departments || []).map((d) => ({
    id: d.departmentId,
    name: d.displayName,
  }));
  return _departments;
}

// ── ArtFeed: a self-refilling buffer of ready-to-show artworks. ──
function createFeed({ departmentId = null, term = null } = {}) {
  let pool = [];
  let cursor = 0;
  let scope = { departmentId, term };

  async function ensurePool() {
    if (cursor >= pool.length) {
      pool = await fetchPool(scope);
      cursor = 0;
    }
  }

  async function next() {
    let tries = 0;
    while (tries < 24) {
      tries++;
      await ensurePool();
      const id = pool[cursor++];
      if (id == null) continue;
      try {
        const art = await fetchObject(id);
        if (art && art.thumb) return art;
      } catch (e) { /* skip */ }
    }
    throw new Error('Could not load artwork');
  }

  function setScope(s) {
    scope = { ...scope, ...s };
    pool = [];
    cursor = 0;
  }

  return { next, setScope };
}

// Preload an image; resolves when ready (or errors out).
function preloadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('no src'));
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error('img error'));
    img.src = src;
  });
}

Object.assign(window, {
  MetAPI: {
    fetchJSON, fetchPool, fetchObject, fetchDepartments,
    createFeed, preloadImage, SEED_TERMS,
  },
});
