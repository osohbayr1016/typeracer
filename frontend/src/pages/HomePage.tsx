type Props = { onPlay: () => void; onMultiplayer: () => void };
/** A two-action landing screen. Progress, car collections and explanations
 * belong on their own routes, not in the entry hero. */
export function HomePage({onPlay,onMultiplayer}:Props) {
  return <div className="home-page">
    <section className="home-hero">
      <div className="home-hero-copy">
        <div className="eyebrow">TYPE RACER <span className="eyebrow-sep">/</span> MONGOLIA</div>
        <h1>ХУРДАН БИЧ.<br/><span>ТҮРҮҮЛЖ УРАЛД.</span></h1>
        <div className="hero-buttons">
          <button className="primary-button hero-play" onClick={onPlay}>
            <span aria-hidden="true">▶</span> ТОГЛОХ <span aria-hidden="true">→</span>
          </button>
          <button className="secondary-button hero-secondary" onClick={onMultiplayer}>НАЙЗУУДТАЙ →</button>
        </div>
      </div>
      <div className="home-visual" aria-hidden="true">
        <div className="home-track-lines"/>
        <img src="/cars/sunset.webp" alt="" className="home-car-image"/>
        <span className="home-finish-art">FINISH /</span>
      </div>
    </section>
  </div>;
}
