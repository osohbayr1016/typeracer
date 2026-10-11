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
    <section className="home-race-preview" aria-label="Уралдааны замын дүрслэл">
      {[0,1,2].map((lane) => <div className="home-preview-lane" key={lane} aria-hidden="true">
        <span className="home-preview-lane-number">{String(lane + 1).padStart(2,"0")}</span>
        <span className="home-preview-road"><span className="home-preview-progress" style={{width: `${[72,54,39][lane]}%`}}/><img src={["/cars/race/sunset.webp","/cars/race/mint.webp","/cars/race/purple.webp"][lane]} alt="" className={`home-preview-car home-preview-car-${lane}`} style={{left:`${[72,54,39][lane]}%`}}/><span className="home-preview-finish"/></span>
      </div>)}
    </section>
  </div>;
}
