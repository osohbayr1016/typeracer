type Props = {
  best: number;
  onSolo: () => void; onMultiplayer: () => void; onGarage: () => void;
};
export function PlayPage({ best, onSolo, onMultiplayer, onGarage }: Props) {
  return <div className="play-page">
    <div className="flow-heading">
      <span className="section-kicker">УРАЛДААНЫ ЛОББИ / ГОРИМ СОНГОХ</span>
      <h1>УРАЛДАХАД <span>БЭЛЭН ҮҮ?</span></h1>
      <p>Уралдааны төрлөө сонгоод шууд эхлээрэй. Аль товч ямар үйлдэл хийх нь тодорхой.</p>
    </div>
    <div className="mode-cards">
      <section className="mode-card solo-mode">
        <div className="mode-card-top"><span className="mode-number">01 / ГАНЦААРЧИЛСАН</span><span className="mode-pill">БҮРТГЭЛГҮЙ</span></div>
        <img src="/cars/coral-gt.svg" alt="" className="mode-car" />
        <h2>Ганцаараа уралдах</h2>
        <p>Өөрийн рекорд болон зорилтот хурдтай уралдаж, бичих чадвараа сайжруул.</p>
        <div className="mode-option"><span>УРАЛДААНЫ ХЭЛ</span><strong>🇲🇳 Монгол хэл</strong></div>
        <div className="mode-detail">ХУВИЙН РЕКОРД <strong>{best} WPM</strong></div>
        <button className="primary-button mode-action" onClick={onSolo}>▶ ГАНЦААРАА ЭХЛЭХ <span aria-hidden="true">→</span></button>
      </section>
      <section className="mode-card multi-mode">
        <div className="mode-card-top"><span className="mode-number">02 / НАЙЗУУДТАЙ</span><span className="mode-pill">2–6 ТОГЛОГЧ</span></div>
        <div className="mode-car-grid" aria-hidden="true"><img src="/cars/blue-sprint.svg" alt=""/><img src="/cars/graphite-r.svg" alt=""/></div>
        <h2>Найзуудтайгаа уралдах</h2>
        <p>Өрөө үүсгэж найзуудаа кодоор урь. Бүгд Ready дармагц countdown эхэлнэ.</p>
        <div className="mode-rules"><span>ХУВИЙН ӨРӨӨ</span><span>КОДООР УРИНА</span><span>ШУУД УРАЛДААН</span></div>
        <button className="primary-button mode-action" onClick={onMultiplayer}>+ ӨРӨӨ ҮҮСГЭХ / НЭГДЭХ <span aria-hidden="true">→</span></button>
        <small className="mode-note">Одоогоор найзуудын хувийн өрөө. Санамсаргүй matchmaking байхгүй.</small>
      </section>
    </div>
    <div className="play-page-footer">Өөрийн машинаа солимоор байна уу? <button onClick={onGarage}>Гараж руу очих →</button></div>
  </div>;
}
