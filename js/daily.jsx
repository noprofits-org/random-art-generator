// daily.jsx — artwork of the day (date-deterministic) + visit streak
const { useState: useStateY, useEffect: useEffectY, useRef: useRefY } = React;

const DAILY_KEY = 'salon.daily.v1';
const DAILY_TERMS = ['painting', 'portrait', 'landscape', 'masterpiece', 'still life', 'figure', 'goddess', 'temple'];

async function resolveDaily() {
  const { Store, MetAPI } = window;
  const today = Store.todayKey();
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(DAILY_KEY)); } catch (e) {}
  if (cached && cached.date === today && cached.id) {
    const art = await MetAPI.fetchObject(cached.id);
    if (art) return art;
  }
  const seed = Store.dailySeed();
  const term = DAILY_TERMS[seed % DAILY_TERMS.length];
  const pool = await MetAPI.fetchPool({ term });
  // walk deterministically from the seed index until we find one with an image
  for (let k = 0; k < pool.length; k++) {
    const idx = (seed + k * 7) % pool.length;
    const id = pool[idx];
    const art = await MetAPI.fetchObject(id).catch(() => null);
    if (art && art.thumb) {
      try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: today, id })); } catch (e) {}
      return art;
    }
  }
  throw new Error('no daily');
}

function Daily({ onOpen }) {
  const { Icon, Store } = window;
  const [art, setArt] = useStateY(null);
  const [streak, setStreak] = useStateY(Store.getStreak());
  const [loading, setLoading] = useStateY(true);
  const [fav, setFav] = useStateY(false);
  const [loaded, setLoaded] = useStateY(false);

  useEffectY(() => {
    setStreak(Store.recordVisit());
    let alive = true;
    resolveDaily()
      .then((a) => { if (alive) { setArt(a); setFav(Store.isFavorite(a.id)); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    const unsub = Store.subscribe(() => { if (art) setFav(Store.isFavorite(art.id)); });
    return () => { alive = false; unsub(); };
  }, []);

  const d = new Date();
  const dateLabel = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const toggleFav = () => { if (art) setFav(Store.toggleFavorite(art)); };

  return (
    <div className="screen daily">
      <header className="screen-head">
        <div>
          <div className="brand-eyebrow">{dateLabel.toUpperCase()}</div>
          <h1 className="brand-title">Today</h1>
        </div>
        <div className="streak-badge">
          <Icon.Flame size={16} />
          <span>{streak.count} day{streak.count === 1 ? '' : 's'}</span>
        </div>
      </header>

      <div className="daily-wrap">
        {loading && <div className="daily-card skeleton"><div className="sk-shimmer" /><div className="sk-cap">Selecting today’s work…</div></div>}
        {!loading && !art && <div className="daily-card skeleton"><div className="sk-cap">Couldn’t load today’s artwork. Try again later.</div></div>}
        {!loading && art && (
          <div className="daily-card" onClick={() => onOpen(art)}>
            {!loaded && <div className="hero-skel sk-shimmer" />}
            <img src={art.img || art.thumb} alt={art.title} className="daily-img"
              style={{ opacity: loaded ? 1 : 0 }} onLoad={() => setLoaded(true)} />
            <div className="daily-shade" />
            <div className="daily-badge">ARTWORK OF THE DAY</div>
            <div className="daily-meta">
              {art.department && <div className="eyebrow">{art.department}</div>}
              <div className="daily-title">{art.title}</div>
              <div className="art-sub">
                {art.artist || art.culture || 'Maker unknown'}{art.date ? <span className="dot">·</span> : null}{art.date}
              </div>
            </div>
          </div>
        )}
      </div>

      {!loading && art && (
        <div className="daily-actions">
          <button className="pill-btn primary" onClick={() => onOpen(art)}>
            <Icon.Expand size={18} /><span>Explore this work</span>
          </button>
          <button className={'pill-btn icon-only' + (fav ? ' on' : '')} onClick={toggleFav}>
            <Icon.Heart size={20} filled={fav} />
          </button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Daily });
