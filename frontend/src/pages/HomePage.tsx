type Props = { onPlay: () => void; onQuickRace: () => void; onMultiplayer: () => void; onSprint: () => void; onDaily: () => void };
/** A two-action landing screen. Progress, car collections and explanations
 * belong on their own routes, not in the entry hero. */
export function HomePage({onPlay,onQuickRace,onMultiplayer,onSprint,onDaily}:Props) {
  return <div className="home-page">
    <section className="home-hero">
      <div className="home-hero-copy">
        <div className="eyebrow">TYPE RACER <span className="eyebrow-sep">/</span> MONGOLIA</div>
        <h1>ХУРДАН БИЧ.<br/><span>ТҮРҮҮЛЖ УРАЛД.</span></h1>
        <div className="hero-buttons">
          <button className="primary-button hero-play" onClick={onQuickRace} data-testid="home-instant-race">
            <span aria-hidden="true">▶</span> ШУУД УРАЛДАХ <span aria-hidden="true">→</span>
          </button>
          <button className="secondary-button hero-secondary" onClick={onMultiplayer}>НАЙЗУУДТАЙ →</button>
        </div>
        <div className="home-fast-links" aria-label="Хурдны дасгал">
          <button type="button" onClick={onSprint}>15 СЕК ТЕСТ <span aria-hidden="true">→</span></button>
          <button type="button" onClick={onDaily}>ӨНӨӨДРИЙН СОРИЛ <span aria-hidden="true">→</span></button>
          <button type="button" className="home-mode-link" onClick={onPlay}>БУСАД ГОРИМ <span aria-hidden="true">→</span></button>
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
