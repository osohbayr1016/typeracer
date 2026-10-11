type Props = {
  best: number; xp: number; onPlay: () => void; onMultiplayer: () => void; onGarage: () => void;
};
export function HomePage({ best, xp, onPlay, onMultiplayer, onGarage }: Props) {
  return <div className="home-page">
    <section className="home-hero">
      <div className="home-hero-copy">
        <div className="eyebrow">ТАЙП РЕЙСЕР <span className="eyebrow-sep">/</span> MONGOLIA</div>
        <h1>ХУРДАН БИЧ.<br/><span>ТҮРҮҮЛЖ УРАЛД.</span></h1>
        <p>Монгол хэлний бичгийн хурдны уралдаан. Хурд, нарийвчлалаа сайжруулаад өөрийн рекордыг эвд.</p>
        <div className="hero-buttons">
          <button className="primary-button hero-play" onClick={onPlay}><span aria-hidden="true">▶</span> ТОГЛОХ <span aria-hidden="true">→</span></button>
          <button className="secondary-button hero-secondary" onClick={onMultiplayer}>НАЙЗУУДТАЙ УРАЛДАХ →</button>
        </div>
        <p className="home-play-caption">Тоглох → горимоо сонго → бэлдээд уралд. Бүртгэл шаардахгүй.</p>
      </div>
      <div className="home-visual" aria-hidden="true">
        <span className="hero-sideword">ГАРААНД БЭЛД</span>
        <div className="home-track-lines"/>
        <img src="/cars/coral-gt.svg" alt="" className="home-car-image"/>
        <div className="home-road-stamp">01 <span>БЭЛЭН ҮҮ</span></div>
        <span className="home-finish-art">FINISH /</span>
      </div>
    </section>
    <section className="home-lower">
      <div className="home-record">
        <span className="section-kicker">МИНИЙ АХИЦ · ТӨХӨӨРӨМЖ ДЭЭР</span>
        <strong>{best} <small>ҮГ/МИН ХУВИЙН РЕКОРД</small></strong>
        <p>{xp} XP · Энэ төхөөрөмж дээр хадгалагдсан дасгалын оноо. Албан ёсны чансаа биш.</p>
      </div>
      <div className="home-steps">
        <span className="section-kicker">ЯАЖ ТОГЛОХ ВЭ</span>
        <div><b>01</b><span>Тоглох горимоо сонго.</span></div>
        <div><b>02</b><span>Дэлгэц дээрх текстийг хурдан, зөв бич.</span></div>
        <div><b>03</b><span>Машинаа барианд хүргээд рекордоо ахиул.</span></div>
      </div>
      <button className="home-garage-link" onClick={onGarage}>МИНИЙ ГАРАЖ <span aria-hidden="true">↗</span></button>
    </section>
  </div>;
}
