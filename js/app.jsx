// app.jsx — Salon shell: tab routing, detail overlay, toast.
// Web build: renders full-viewport (the design's iOS device frame was a
// preview-only shell and is intentionally dropped here).
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;
const { Discover, Search, Saved, Daily, Detail, Icon } = window;

const TABS = [
  { id: 'discover', label: 'Discover', icon: 'Compass' },
  { id: 'search', label: 'Search', icon: 'Search' },
  { id: 'daily', label: 'Today', icon: 'Calendar' },
  { id: 'saved', label: 'Saved', icon: 'Heart' },
];

function TabBar({ active, onChange }) {
  return (
    <nav className="tab-bar">
      <div className="tab-bar-glass" />
      {TABS.map((t) => {
        const I = Icon[t.icon];
        const on = active === t.id;
        return (
          <button key={t.id} className={'tab' + (on ? ' on' : '')} onClick={() => onChange(t.id)}>
            <I size={23} filled={on && t.id === 'saved'} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast" key={msg}>{msg}</div>;
}

function App() {
  const [tab, setTab] = useStateA('discover');
  const [visited, setVisited] = useStateA({ discover: true });
  const [detail, setDetail] = useStateA(null);
  const [toast, setToast] = useStateA('');
  const toastTimer = useRefA(null);

  const showToast = (m) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1900);
  };

  const go = (id) => { setTab(id); setVisited((v) => ({ ...v, [id]: true })); };
  const open = (art) => setDetail(art);

  const screens = {
    discover: <Discover onOpen={open} registerSaveToast={(a) => showToast('Saved · ' + (a.artist || a.title.slice(0, 18)))} />,
    search: <Search onOpen={open} />,
    daily: <Daily onOpen={open} />,
    saved: <Saved onOpen={open} />,
  };

  return (
    <div className="app-root">
      {TABS.map((t) => visited[t.id] && (
        <div key={t.id} className="screen-host" style={{ display: tab === t.id ? 'block' : 'none' }}>
          {screens[t.id]}
        </div>
      ))}

      <TabBar active={tab} onChange={go} />
      <Toast msg={toast} />

      <div className={'overlay-host' + (detail ? ' open' : '')}>
        {detail && <Detail art={detail} onClose={() => setDetail(null)} onToast={showToast} />}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
