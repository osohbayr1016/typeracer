type Props = {
  best: number; xp: number; onPlay: () => void; onMultiplayer: () => void; onGarage: () => void;
};
export function HomePage({ best, xp, onPlay, onMultiplayer, onGarage }: Props) {
  return <div className="home-page">
    <section className="home-hero">
      <div className="home-hero-copy">
        <div className="eyebrow">TYPE RACER <span className="eyebrow-sep">/</span> MONGOLIA</div>
        <h1>TYPE FAST.<br/><span>RACE FASTER.</span></h1>
        <p>Монгол хэлний бичгийн хурдны уралдаан. Хурд, нарийвчлалаа сайжруулаад өөрийн рекордыг эвд.</p>
        <div className="hero-buttons">
          <button className="primary-button hero-play" onClick={onPlay}><span aria-hidden="true">▶</span> PLAY NOW <span aria-hidden="true">→</span></button>
          <button className="secondary-button hero-secondary" onClick={onMultiplayer}>НАЙЗУУДТАЙ УРАЛДАХ →</button>
        </div>
        <p className="home-play-caption">Play Now → горимоо сонго → бэлдээд уралд. Бүртгэл шаардахгүй.</p>
      </div>
      <div className="home-visual" aria-hidden="true">
        <span className="hero-sideword">START YOUR ENGINES</span>
        <div className="home-track-lines"/>
        <img src="/cars/coral-gt.svg" alt="" className="home-car-image"/>
        <div className="home-road-stamp">01 <span>READY TO RACE</span></div>
        <span className="home-finish-art">FINISH /</span>
      </div>
    </section>
    <section className="home-lower">
      <div className="home-record">
        <span className="section-kicker">YOUR PROGRESS · LOCAL</span>
        <strong>{best} <small>WPM PERSONAL BEST</small></strong>
        <p>{xp} XP earned on this browser. Saved on this device, not a public leaderboard.</p>
      </div>
      <div className="home-steps">
        <span className="section-kicker">HOW IT WORKS</span>
        <div><b>01</b><span>Тоглох горимоо сонго.</span></div>
        <div><b>02</b><span>Дэлгэц дээрх текстийг хурдан, зөв бич.</span></div>
        <div><b>03</b><span>Машинаа барианд хүргээд рекордоо ахиул.</span></div>
      </div>
      <button className="home-garage-link" onClick={onGarage}>MY GARAGE <span aria-hidden="true">↗</span></button>
    </section>
  </div>;
}
