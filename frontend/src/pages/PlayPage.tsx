import type { Language } from '@typeracer/shared';
type Props = {
  language: Language; best: number; onLanguage: (language: Language) => void;
  onSolo: () => void; onMultiplayer: () => void; onGarage: () => void;
};
export function PlayPage({ language, best, onLanguage, onSolo, onMultiplayer, onGarage }: Props) {
  return <div className="play-page">
    <div className="flow-heading">
      <span className="section-kicker">RACE LOBBY / CHOOSE YOUR MODE</span>
      <h1>READY TO <span>RACE?</span></h1>
      <p>Уралдааны төрлөө сонгоод шууд эхлээрэй. Аль товч ямар үйлдэл хийх нь тодорхой.</p>
    </div>
    <div className="mode-cards">
      <section className="mode-card solo-mode">
        <div className="mode-card-top"><span className="mode-number">01 / SOLO</span><span className="mode-pill">NO LOGIN</span></div>
        <img src="/cars/coral-gt.svg" alt="" className="mode-car" />
        <h2>Ганцаараа уралдах</h2>
        <p>Өөрийн рекорд болон зорилтот хурдтай уралдаж, бичих чадвараа сайжруул.</p>
        <div className="mode-option">
          <span>БИЧИХ ХЭЛ</span>
          <div className="segmented" role="group" aria-label="Хэл сонгох">
            <button className={language === 'mn' ? 'active' : ''} aria-pressed={language === 'mn'} onClick={() => onLanguage('mn')}>Монгол</button>
            <button className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => onLanguage('en')}>English</button>
          </div>
        </div>
        <div className="mode-detail">PERSONAL BEST <strong>{best} WPM</strong></div>
        <button className="primary-button mode-action" onClick={onSolo}>▶ START SOLO RACE <span aria-hidden="true">→</span></button>
      </section>
      <section className="mode-card multi-mode">
        <div className="mode-card-top"><span className="mode-number">02 / MULTIPLAYER</span><span className="mode-pill">2–6 PLAYERS</span></div>
        <div className="mode-car-grid" aria-hidden="true"><img src="/cars/blue-sprint.svg" alt=""/><img src="/cars/graphite-r.svg" alt=""/></div>
        <h2>Найзуудтайгаа уралдах</h2>
        <p>Өрөө үүсгэж найзуудаа кодоор урь. Бүгд Ready дармагц countdown эхэлнэ.</p>
        <div className="mode-rules"><span>PRIVATE ROOM</span><span>ROOM CODE INVITE</span><span>LIVE RACE</span></div>
        <button className="primary-button mode-action" onClick={onMultiplayer}>+ CREATE / JOIN LOBBY <span aria-hidden="true">→</span></button>
        <small className="mode-note">Одоогоор найзуудын хувийн өрөө. Санамсаргүй matchmaking байхгүй.</small>
      </section>
    </div>
    <div className="play-page-footer">Өөрийн машинаа солимоор байна уу? <button onClick={onGarage}>Гараж руу очих →</button></div>
  </div>;
}
