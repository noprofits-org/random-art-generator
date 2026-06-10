// saved.jsx — favorites collection (masonry), persisted in localStorage
const { useState: useStateV, useEffect: useEffectV } = React;

function Saved({ onOpen }) {
  const { Icon, Store } = window;
  const [favs, setFavs] = useStateV(Store.getFavorites());
  useEffectV(() => Store.subscribe(() => setFavs(Store.getFavorites())), []);

  return (
    <div className="screen saved">
      <header className="screen-head">
        <div>
          <div className="brand-eyebrow">YOUR COLLECTION</div>
          <h1 className="brand-title">Saved</h1>
        </div>
        <div className="count-pill">{favs.length}</div>
      </header>

      <div className="grid-scroll">
        {favs.length === 0 && (
          <div className="empty-state tall">
            <div className="empty-art">
              <Icon.Heart size={34} />
            </div>
            <h3>Nothing saved yet</h3>
            <p>Swipe right on a work — or tap the heart — to start your own collection of the Met’s masterpieces.</p>
          </div>
        )}
        {favs.length > 0 && (
          <div className="masonry">
            {favs.map((art) => (
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

Object.assign(window, { Saved });
