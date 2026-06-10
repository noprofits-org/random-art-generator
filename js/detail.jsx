// detail.jsx — full artwork detail: zoomable image, metadata, AI curator note
const { useState: useStateD, useEffect: useEffectD, useRef: useRefD } = React;

const _noteCache = new Map();
async function generateNote(art) {
  if (_noteCache.has(art.id)) return _noteCache.get(art.id);
  if (!(window.claude && window.claude.complete)) throw new Error('no-ai');
  const prompt =
    'You are a curator at The Metropolitan Museum of Art writing a short wall label. ' +
    'In 2 to 3 vivid yet factual sentences (about 50 words total), help a curious visitor ' +
    'appreciate this work — what to notice, its context or technique. Do not restate the title verbatim, ' +
    'avoid hype and avoid inventing facts you are unsure of. Return plain prose only.\n\n' +
    `Title: ${art.title}\nArtist: ${art.artist || 'Unknown'}\nDate: ${art.date}\n` +
    `Medium: ${art.medium}\nCulture: ${art.culture}\nPeriod: ${art.period}\n` +
    `Classification: ${art.classification}\nDepartment: ${art.department}`;
  const text = (await window.claude.complete(prompt)).trim();
  _noteCache.set(art.id, text);
  return text;
}

function LightBox({ art, onClose }) {
  const { Icon } = window;
  const z = useRefD({ scale: 1, x: 0, y: 0, dragging: false, x0: 0, y0: 0 });
  const imgRef = useRefD(null);
  const apply = () => {
    const el = imgRef.current; if (!el) return;
    el.style.transform = `translate(${z.current.x}px, ${z.current.y}px) scale(${z.current.scale})`;
  };
  const toggle = () => {
    z.current.scale = z.current.scale > 1 ? 1 : 2.5;
    if (z.current.scale === 1) { z.current.x = 0; z.current.y = 0; }
    const el = imgRef.current; el.style.transition = 'transform .3s ease'; apply();
  };
  const down = (e) => { const s = z.current; if (s.scale === 1) return; s.dragging = true; s.x0 = e.clientX - s.x; s.y0 = e.clientY - s.y; imgRef.current.style.transition = 'none'; };
  const move = (e) => { const s = z.current; if (!s.dragging) return; s.x = e.clientX - s.x0; s.y = e.clientY - s.y0; apply(); };
  const up = () => { z.current.dragging = false; };
  return (
    <div className="lightbox" onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
      <button className="lb-close" onClick={onClose}><Icon.Close size={22} /></button>
      <img ref={imgRef} src={art.img} alt={art.title} className="lb-img"
        onClick={toggle} onPointerDown={down} draggable={false} />
      <div className="lb-hint">Tap to zoom · Drag to pan</div>
    </div>
  );
}

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="meta-row">
      <div className="meta-label">{label}</div>
      <div className="meta-value">{value}</div>
    </div>
  );
}

function Detail({ art, onClose, onToast }) {
  const { Icon, Store } = window;
  const [fav, setFav] = useStateD(Store.isFavorite(art.id));
  const [zoom, setZoom] = useStateD(false);
  const [note, setNote] = useStateD('');
  const [noteState, setNoteState] = useStateD('loading'); // loading | done | error
  const [imgLoaded, setImgLoaded] = useStateD(false);

  useEffectD(() => {
    let alive = true;
    setNoteState('loading'); setNote('');
    generateNote(art)
      .then((t) => { if (alive) { setNote(t); setNoteState('done'); } })
      .catch(() => { if (alive) setNoteState('error'); });
    return () => { alive = false; };
  }, [art.id]);

  const toggleFav = () => {
    const now = Store.toggleFavorite(art);
    setFav(now);
    onToast && onToast(now ? 'Saved to favorites' : 'Removed from favorites');
  };
  const share = async () => {
    const url = art.url || location.href;
    try {
      if (navigator.share) await navigator.share({ title: art.title, text: art.title + (art.artist ? ' — ' + art.artist : ''), url });
      else { await navigator.clipboard.writeText(url); onToast && onToast('Link copied'); }
    } catch (e) {}
  };
  const download = () => { if (art.img) window.open(art.img, '_blank'); };
  const openMet = () => { if (art.url) window.open(art.url, '_blank'); };

  const subtitle = [art.artist, art.artistBio].filter(Boolean).join(', ');

  return (
    <div className="detail-overlay">
      <div className="detail-scroll">
        <div className="detail-hero" onClick={() => setZoom(true)}>
          {!imgLoaded && <div className="hero-skel sk-shimmer" />}
          <img src={art.img || art.thumb} alt={art.title}
            className="detail-hero-img" style={{ opacity: imgLoaded ? 1 : 0 }}
            onLoad={() => setImgLoaded(true)} />
          <button className="hero-expand" onClick={(e) => { e.stopPropagation(); setZoom(true); }}>
            <Icon.Expand size={18} />
          </button>
          {art.isPublicDomain && <div className="pd-pill hero-pd"><span>PUBLIC DOMAIN</span></div>}
        </div>

        <div className="detail-body">
          {art.department && <div className="eyebrow">{art.department}</div>}
          <h1 className="detail-title">{art.title}</h1>
          {subtitle && <div className="detail-artist">{subtitle}</div>}

          {art.tags && art.tags.length > 0 && (
            <div className="chip-row">
              {art.tags.map((t) => <span className="chip" key={t}>{t}</span>)}
            </div>
          )}

          <div className="note-card">
            <div className="note-head">
              <Icon.Sparkle size={17} />
              <span>Curator’s Note</span>
            </div>
            {noteState === 'loading' && (
              <div className="note-loading">
                <span className="ln" /><span className="ln" /><span className="ln short" />
              </div>
            )}
            {noteState === 'done' && <p className="note-text">{note}</p>}
            {noteState === 'error' && (
              <p className="note-text muted">A curator’s note isn’t available right now — explore the details below, or view the full record at The Met.</p>
            )}
            {noteState === 'done' && <div className="note-foot">AI-generated · verify against The Met’s record</div>}
          </div>

          <div className="meta-table">
            <MetaRow label="Date" value={art.date} />
            <MetaRow label="Medium" value={art.medium} />
            <MetaRow label="Dimensions" value={art.dimensions} />
            <MetaRow label="Classification" value={art.classification} />
            <MetaRow label="Culture" value={art.culture} />
            <MetaRow label="Period" value={art.period} />
            <MetaRow label="Gallery" value={art.gallery && ('Gallery ' + art.gallery)} />
            <MetaRow label="Credit" value={art.creditLine} />
          </div>

          <button className="met-link" onClick={openMet}>
            <span>View full record at metmuseum.org</span>
            <Icon.External size={18} />
          </button>
          <div className="detail-footer">Image & data courtesy of The Metropolitan Museum of Art</div>
        </div>
      </div>

      {/* top floating controls */}
      <div className="detail-topbar">
        <button className="glass-round" onClick={onClose}><Icon.ChevronDown size={22} /></button>
        <div className="detail-actions">
          <button className="glass-round" onClick={share}><Icon.Share size={19} /></button>
          <button className={'glass-round' + (fav ? ' on' : '')} onClick={toggleFav}>
            <Icon.Heart size={20} filled={fav} />
          </button>
        </div>
      </div>

      {/* bottom action dock */}
      <div className="detail-dock">
        <button className="dock-btn" onClick={download}><Icon.Download size={19} /><span>Save image</span></button>
        <button className="dock-btn" onClick={share}><Icon.Share size={18} /><span>Share</span></button>
        <button className={'dock-btn primary' + (fav ? ' on' : '')} onClick={toggleFav}>
          <Icon.Heart size={18} filled={fav} /><span>{fav ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {zoom && <LightBox art={art} onClose={() => setZoom(false)} />}
    </div>
  );
}

Object.assign(window, { Detail });
