// store.jsx — persistent favorites + daily streak with a tiny pub/sub.
const FAV_KEY = 'salon.favorites.v1';
const STREAK_KEY = 'salon.streak.v1';

function read(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch (e) { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

const listeners = new Set();
function emit() { listeners.forEach((fn) => fn()); }
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// ── Favorites: store the full normalized artwork so Saved can render offline ──
function getFavorites() { return read(FAV_KEY, []); }
function isFavorite(id) { return getFavorites().some((a) => a.id === id); }
function toggleFavorite(art) {
  const favs = getFavorites();
  const idx = favs.findIndex((a) => a.id === art.id);
  let next;
  if (idx >= 0) next = favs.filter((a) => a.id !== art.id);
  else next = [{ ...art, savedAt: Date.now() }, ...favs];
  write(FAV_KEY, next);
  emit();
  return idx < 0; // true if now favorited
}

// ── Daily streak ──
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayDiff(a, b) {
  const pa = new Date(a + 'T00:00:00'), pb = new Date(b + 'T00:00:00');
  return Math.round((pb - pa) / 86400000);
}
function getStreak() { return read(STREAK_KEY, { count: 0, last: null }); }
function recordVisit() {
  const s = getStreak();
  const today = todayKey();
  if (s.last === today) return s;
  let count = 1;
  if (s.last) {
    const diff = dayDiff(s.last, today);
    if (diff === 1) count = s.count + 1;
    else if (diff === 0) count = s.count;
  }
  const next = { count, last: today };
  write(STREAK_KEY, next);
  emit();
  return next;
}

// Deterministic daily index from the date (stable across reloads same day).
function dailySeed() {
  const t = todayKey();
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return h;
}

Object.assign(window, {
  Store: {
    getFavorites, isFavorite, toggleFavorite, subscribe,
    getStreak, recordVisit, todayKey, dailySeed,
  },
});
