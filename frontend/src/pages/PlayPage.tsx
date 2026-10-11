import './PlayPage.css';

type Props = {
  best: number; carIcon: string; carName: string;
  onPlay: () => void; onMultiplayer: () => void; onGarage: () => void;
};

/** There is no Solo mode in the primary game: Play is always live quick matchmaking.
 * The other route is a private lobby for friends.
 */
export function PlayPage({ best, carIcon, carName, onPlay, onMultiplayer, onGarage }: Props) {
  return <div className="play-page">
    <header className="play-entry-heading">
      <div className="play-entry-heading-copy">
        <span className="play-entry-eyebrow"><span className="play-entry-dot" aria-hidden="true"/> ҮНДСЭН УРАЛДААН</span>
        <h1>УРАЛДАХАД <span>БЭЛЭН ҮҮ?</span></h1>
        <p>Нэг товч дарж бодит тоглогчидтой уралд. Хүн хүрэлцэхгүй бол ботоор нөхнө.</p>
      </div>
      <div className="play-language-badge" aria-label="Монгол хэлний уралдаан"><span>МН</span><div><strong>МОНГОЛ ХЭЛ</strong><small>Ө · Ү үсэгтэй</small></div></div>
    </header>
    <section className="play-solo-feature play-quick-feature" aria-labelledby="play-live-title">
      <div className="play-solo-details">
        <div className="play-solo-kicker"><span className="play-option-index">01</span><span>ОНЛАЙН УРАЛДААН</span>
          <span className="play-feature-pill">ШУУД ТОГЛОХ</span></div>
        <h2 id="play-live-title">УРАЛДААНД<br/>ОРОХ</h2>
        <p className="play-solo-description">Нийт 5 уралдагч оролцоно. Хүн хүрэлцэхгүй бол бот нэг нэгээрээ нэгдэж, тав дахь оролцогч ирмэгц 3 секундын гараа эхэлнэ.</p>
        <div className="play-solo-steps"><span><b>1</b> Тоглогч хайх</span><span className="play-step-arrow">→</span>
          <span><b>2</b> Уралдах</span><span className="play-step-arrow">→</span><span><b>3</b> Зоос авах</span></div>
        <button type="button" className="play-start-button" onClick={onPlay}>
          <span className="play-start-symbol" aria-hidden="true">▶</span><span>УРАЛДААНД ОРОХ</span>
          <span className="play-start-arrow" aria-hidden="true">→</span>
        </button>
        <p className="play-after-button">5 уралдагч · Найз биш бодит өрсөлдөгчид + бот · Нэг гарааны тоолол</p>
        <div className="play-quick-payout"><span>БАРИАНЫ ШАГНАЛ</span>
          <strong>1-р байр ◈120</strong><strong>2-р байр ◈95</strong><strong>3-р байр ◈75</strong><small>4–5-р байр ◈55–40</small>
        </div>
      </div>
      <div className="play-preview" aria-label="Тоглогчид болон боттой уралдааны замын жишээ">
        <div className="play-preview-topline"><strong>ТАНЫ УРАЛДААН</strong><span>5 УРАЛДАГЧ</span></div>
        <div className="play-preview-road">
          <div className="play-preview-lane play-preview-lane-you">
            <div className="play-preview-lane-label"><strong>01</strong><span>ТА</span></div>
            <img src={carIcon} alt={carName} draggable={false}/><span className="play-preview-checkers"/>
          </div>
          <div className="play-preview-lane">
            <div className="play-preview-lane-label"><strong>02</strong><span>ХҮН / БОТ</span></div>
            <img src="/cars/graphite-r.svg" alt="" draggable={false}/><span className="play-preview-checkers"/>
          </div>
          <div className="play-preview-lane">
            <div className="play-preview-lane-label"><strong>03</strong><span>ХҮН / БОТ</span></div>
            <img src="/cars/blue-sprint.svg" alt="" draggable={false}/><span className="play-preview-checkers"/>
          </div>
        </div>
        <div className="play-preview-bottom"><div><span className="play-preview-status-dot"/> СОНГОСОН МАШИН: <strong>{carName}</strong></div>
          <button type="button" onClick={onGarage}>МАШИН СОЛИХ ↗</button></div>
        <p className="play-preview-disclaimer">Жишээ зураг. Жинхэнэ уралдаанд бодит хүмүүс болон ботууд тус тусдаа тэмдэглэгдэнэ.</p>
      </div>
    </section>
    <section className="play-friends-feature" aria-labelledby="play-friends-title">
      <div className="play-friends-illustration" aria-hidden="true"><img src="/cars/blue-sprint.svg" alt=""/><img src="/cars/graphite-r.svg" alt=""/></div>
      <div className="play-friends-content"><span className="play-friends-kicker">02 / ХУВИЙН ӨРӨӨ</span>
        <h2 id="play-friends-title">НАЙЗУУДТАЙГАА УРАЛДАХ</h2>
        <p>Өөрийн өрөөг үүсгэ эсвэл найзынхаа кодоор нэгд. Энэ нь олон нийтийн хурдан уралдаанаас тусдаа.</p></div>
      <button type="button" className="play-friends-button" onClick={onMultiplayer}>ӨРӨӨ ҮҮСГЭХ / НЭГДЭХ <span aria-hidden="true">→</span></button>
    </section>
    <div className="play-entry-footer"><div className="play-entry-personalbest"><span>ХУВИЙН РЕКОРД</span><strong>{best} <small>ҮГ/МИН</small></strong></div>
      <p>Шагнал нь зөвхөн тоглоомын дотоод зоос бөгөөд одоогоор төхөөрөмж дээр хадгалагдана. Албан ёсны рейтинг хараахан байхгүй.</p></div>
  </div>;
}
