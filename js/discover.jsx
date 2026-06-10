// discover.jsx — swipeable artwork card stack (skip / save / tap-to-open)
const { useState, useEffect, useRef, useCallback } = React;

function ArtCard({ art, depth, isTop, dragRef, onPointerDown, onOpen }) {
  // depth 0 = top. Behind cards shrink + drop back.
  const scale = 1 - depth * 0.045;
  const ty = depth * 18;
  const base = {
    position: 'absolute', inset: 0,
    transform: `translateY(${ty}px) scale(${scale})`,
    transformOrigin: 'top center',
    transition: 'transform .45s cubic-bezier(.2,.8,.2,1), opacity .45s',
    opacity: depth > 2 ? 0 : 1,
    zIndex: 10 - depth,
    willChange: 'transform',
  };
  return (
    <div
      ref={isTop ? dragRef : null}
      style={base}
      onPointerDown={isTop ? onPointerDown : undefined}
      onClick={isTop ? () => onOpen(art) : undefined}
    >
      <div className="art-card">
        <div className="art-card-img" style={{ backgroundImage: `url("${art.thumb}")` }} />
        <div className="art-card-shade" />
        {art.isPublicDomain && (
          <div className="pd-pill"><span>PUBLIC DOMAIN</span></div>
        )}
        {/* swipe verdict labels */}
        <div className="verdict verdict-save" data-role="save">SAVE</div>
        <div className="verdict verdict-skip" data-role="skip">PASS</div>
        <div className="art-card-meta">
          {art.department && <div className="eyebrow">{art.department}</div>}
          <div className="art-title">{art.title}</div>
          <div className="art-sub">
            {art.artist || (art.culture ? art.culture : 'Maker unknown')}
            {art.date ? <span className="dot">·</span> : null}
            {art.date}
          </div>
        </div>
      </div>
    </div>
  );
}

function Discover({ onOpen, registerSaveToast }) {
  const { Icon, MetAPI, Store } = window;
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const feedRef = useRef(null);
  const dragRef = useRef(null);
  const drag = useRef({ active: false, x0: 0, y0: 0, dx: 0, dy: 0 });

  const fetchOne = useCallback(async () => {
    const art = await feedRef.current.next();
    try { await MetAPI.preloadImage(art.thumb); } catch (e) {}
    MetAPI.preloadImage(art.img); // warm full-res in background
    return art;
  }, [MetAPI]);

  const fill = useCallback(async () => {
    try {
      const a = await fetchOne();
      setCards((c) => (c.length >= 3 ? c : [...c, a]));
    } catch (e) {}
  }, [fetchOne]);

  useEffect(() => {
    feedRef.current = MetAPI.createFeed();
    let alive = true;
    (async () => {
      try {
        const first = [];
        for (let i = 0; i < 3; i++) first.push(await fetchOne());
        if (alive) { setCards(first); setLoading(false); }
      } catch (e) { if (alive) { setErr(true); setLoading(false); } }
    })();
    return () => { alive = false; };
  }, [MetAPI, fetchOne]);

  // advance after a swipe / button verdict
  const advance = useCallback((liked) => {
    setCards((c) => {
      const [top, ...rest] = c;
      if (liked && top) {
        if (!Store.isFavorite(top.id)) Store.toggleFavorite(top);
        registerSaveToast && registerSaveToast(top);
      }
      return rest;
    });
    fill();
  }, [fill, Store, registerSaveToast]);

  const flyOut = useCallback((dir, liked) => {
    const el = dragRef.current;
    if (!el) { advance(liked); return; }
    el.style.transition = 'transform .35s ease, opacity .35s ease';
    el.style.transform = `translate(${dir * 620}px, -40px) rotate(${dir * 18}deg)`;
    el.style.opacity = '0';
    setTimeout(() => advance(liked), 300);
  }, [advance]);

  const setVerdict = (el, dx) => {
    const save = el.querySelector('[data-role="save"]');
    const skip = el.querySelector('[data-role="skip"]');
    if (save) save.style.opacity = String(Math.max(0, Math.min(1, dx / 90)));
    if (skip) skip.style.opacity = String(Math.max(0, Math.min(1, -dx / 90)));
  };

  const onPointerDown = (e) => {
    const el = dragRef.current; if (!el) return;
    drag.current = { active: true, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false };
    el.style.transition = 'none';
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current; const el = dragRef.current;
    if (!d.active || !el) return;
    d.dx = e.clientX - d.x0; d.dy = e.clientY - d.y0;
    if (Math.abs(d.dx) > 6 || Math.abs(d.dy) > 6) d.moved = true;
    el.style.transform = `translate(${d.dx}px, ${d.dy * 0.4}px) rotate(${d.dx * 0.05}deg)`;
    setVerdict(el, d.dx);
  };
  const onPointerUp = () => {
    const d = drag.current; const el = dragRef.current;
    if (!d.active || !el) return;
    d.active = false;
    const threshold = 110;
    if (d.dx > threshold) { flyOut(1, true); return; }
    if (d.dx < -threshold) { flyOut(-1, false); return; }
    // snap back
    el.style.transition = 'transform .4s cubic-bezier(.2,.9,.2,1)';
    el.style.transform = 'translate(0,0) rotate(0deg)';
    setVerdict(el, 0);
    if (!d.moved) { /* treated as tap by onClick */ }
  };

  useEffect(() => {
    const up = () => onPointerUp();
    const move = (e) => onPointerMove(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  });

  const Heart = Icon.Heart, Close = Icon.Close, Shuffle = Icon.Shuffle;

  return (
    <div className="screen discover">
      <header className="screen-head">
        <div>
          <div className="brand-eyebrow">THE MET · OPEN ACCESS</div>
          <h1 className="brand-title">Discover</h1>
        </div>
        <button className="ghost-btn" onClick={() => { setCards([]); setLoading(true); feedRef.current.setScope({ term: null }); setTimeout(() => { (async () => { const f = []; for (let i = 0; i < 3; i++) f.push(await fetchOne()); setCards(f); setLoading(false); })(); }, 10); }} aria-label="Shuffle">
          <Shuffle size={20} />
        </button>
      </header>

      <div className="stack-wrap">
        {loading && (
          <div className="art-card skeleton">
            <div className="sk-shimmer" />
            <div className="sk-cap">Curating the collection…</div>
          </div>
        )}
        {err && !loading && (
          <div className="art-card skeleton"><div className="sk-cap">Couldn’t reach the gallery. Pull to retry.</div></div>
        )}
        {!loading && cards.slice(0, 3).map((art, i) => (
          <ArtCard
            key={art.id + '-' + i}
            art={art}
            depth={i}
            isTop={i === 0}
            dragRef={dragRef}
            onPointerDown={onPointerDown}
            onOpen={onOpen}
          />
        )).reverse()}
      </div>

      <div className="action-row">
        <button className="round-btn skip" onClick={() => cards[0] && flyOut(-1, false)} aria-label="Pass">
          <Close size={26} />
        </button>
        <button className="round-btn open" onClick={() => cards[0] && onOpen(cards[0])} aria-label="Details">
          <Icon.Expand size={22} />
        </button>
        <button className="round-btn save" onClick={() => cards[0] && flyOut(1, true)} aria-label="Save">
          <Heart size={26} />
        </button>
      </div>
      <div className="swipe-hint">Swipe to pass · Swipe to save · Tap to explore</div>
    </div>
  );
}

Object.assign(window, { Discover });
