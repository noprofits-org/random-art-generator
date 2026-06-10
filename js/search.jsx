// search.jsx — search + browse by Met department, masonry results grid
const { useState: useStateS, useEffect: useEffectS, useRef: useRefS } = React;

async function loadGrid({ term, departmentId }, n = 18) {
  const { MetAPI } = window;
  const pool = await MetAPI.fetchPool({ term, departmentId });
  const ids = pool.slice(0, 48);
  const out = [];
  let i = 0;
  while (out.length < n && i < ids.length) {
    const batch = ids.slice(i, i + 6); i += 6;
    const arts = await Promise.all(batch.map((id) => MetAPI.fetchObject(id).catch(() => null)));
    arts.forEach((a) => { if (a && a.thumb) out.push(a); });
  }
  return out.slice(0, n);
}

function Search({ onOpen }) {
  const { Icon } = window;
  const [depts, setDepts] = useStateS([]);
  const [deptId, setDeptId] = useStateS(null);
  const [query, setQuery] = useStateS('');
  const [submitted, setSubmitted] = useStateS('');
  const [results, setResults] = useStateS([]);
  const [loading, setLoading] = useStateS(true);
  const reqId = useRefS(0);

  useEffectS(() => {
    window.MetAPI.fetchDepartments().then(setDepts).catch(() => {});
  }, []);

  const run = (opts) => {
    const my = ++reqId.current;
    setLoading(true);
    loadGrid(opts)
      .then((arts) => { if (my === reqId.current) { setResults(arts); setLoading(false); } })
      .catch(() => { if (my === reqId.current) { setResults([]); setLoading(false); } });
  };

  useEffectS(() => { run({ term: submitted || null, departmentId: deptId }); }, [deptId, submitted]);

  const onSubmit = (e) => { e.preventDefault(); setSubmitted(query.trim()); };

  return (
    <div className="screen search">
      <header className="screen-head">
        <div>
          <div className="brand-eyebrow">EXPLORE</div>
          <h1 className="brand-title">Search</h1>
        </div>
      </header>

      <form className="search-bar" onSubmit={onSubmit}>
        <Icon.Search size={19} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the collection…"
          enterKeyHint="search"
        />
        {query && <button type="button" className="clear-x" onClick={() => { setQuery(''); setSubmitted(''); }}><Icon.Close size={16} /></button>}
      </form>

      <div className="chip-scroll">
        <button className={'filter-chip' + (deptId === null ? ' on' : '')} onClick={() => setDeptId(null)}>All</button>
        {depts.map((d) => (
          <button key={d.id} className={'filter-chip' + (deptId === d.id ? ' on' : '')} onClick={() => setDeptId(d.id)}>
            {d.name}
          </button>
        ))}
      </div>

      <div className="grid-scroll">
        {loading && (
          <div className="masonry">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="m-tile sk-shimmer" key={i} style={{ height: 120 + (i % 3) * 60 }} />
            ))}
          </div>
        )}
        {!loading && results.length === 0 && (
          <div className="empty-state">
            <Icon.Search size={30} />
            <p>No works found{submitted ? ` for “${submitted}”` : ''}. Try another term or department.</p>
          </div>
        )}
        {!loading && results.length > 0 && (
          <div className="masonry">
            {results.map((art) => (
              <button className="m-tile" key={art.id} onClick={() => onOpen(art)}>
                <img src={art.thumb} alt={art.title} loading="lazy" />
                <div className="m-cap">
                  <div className="m-title">{art.title}</div>
                  {art.artist && <div className="m-artist">{art.artist}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Search });
