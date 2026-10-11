import './PlayPage.css';

type Props = {
  best: number;
  carIcon: string;
  carName: string;
  onSolo: () => void;
  onMultiplayer: () => void;
  onGarage: () => void;
};

/**
 * A race-first entry point. This page deliberately has one dominant action:
 * start the existing solo race (with its real countdown and reward flow).
 * Friends mode is secondary and links to the existing real lobby.
 */
export function PlayPage({ best, carIcon, carName, onSolo, onMultiplayer, onGarage }: Props) {
  return <div className="play-page">
    <header className="play-entry-heading">
      <div className="play-entry-heading-copy">
        <span className="play-entry-eyebrow"><span className="play-entry-dot" aria-hidden="true"/> УРАЛДААН СОНГОХ</span>
        <h1>УРАЛДАХАД <span>БЭЛЭН ҮҮ?</span></h1>
        <p>Монгол хэлээр бичиж машинаа хөдөлгөөрэй. Доороос уралдаанаа сонгоод шууд эхэлнэ.</p>
      </div>
      <div className="play-language-badge" aria-label="Уралдааны хэл: Монгол">
        <span aria-hidden="true">МН</span>
        <div><strong>МОНГОЛ ХЭЛ</strong><small>Ө · Ү үсэгтэй</small></div>
      </div>
    </header>

    <section className="play-solo-feature" aria-labelledby="play-solo-title">
      <div className="play-solo-details">
        <div className="play-solo-kicker">
          <span className="play-option-index">01</span>
          <span>ШУУД ЭХЛЭХ</span>
          <span className="play-feature-pill">БҮРТГЭЛ ШААРДАХГҮЙ</span>
        </div>
        <h2 id="play-solo-title">ГАНЦААРАА<br/>УРАЛДАХ</h2>
        <p className="play-solo-description">Өөрийн хурдаа сорь. 3 секундын бэлтгэлийн дараа бичиж эхлээрэй.</p>
        <div className="play-solo-steps" aria-label="Ганцаарчилсан уралдааны явц">
          <span><b>1</b> Эхлэх</span>
          <span aria-hidden="true" className="play-step-arrow">→</span>
          <span><b>2</b> Бичих</span>
          <span aria-hidden="true" className="play-step-arrow">→</span>
          <span><b>3</b> Шагнал авах</span>
        </div>
        <button className="play-start-button" onClick={onSolo} type="button">
          <span className="play-start-symbol" aria-hidden="true">▶</span>
          <span>ГАНЦААРАА ЭХЛЭХ</span>
          <span className="play-start-arrow" aria-hidden="true">→</span>
        </button>
        <p className="play-after-button">Шууд уралдаан руу орно · Монгол хэл · XP ба зоос</p>
      </div>

      <div className="play-preview" aria-label="Таны сонгосон машинтай уралдааны замын жишээ">
        <div className="play-preview-topline">
          <strong>ТАНЫ ГАРААНЫ ЗАМ</strong>
          <span>БАРИА <span aria-hidden="true">↗</span></span>
        </div>
        <div className="play-preview-road">
          <div className="play-preview-lane play-preview-lane-you">
            <div className="play-preview-lane-label"><strong>01</strong><span>ТА</span></div>
            <img src={carIcon} alt={carName} draggable={false}/>
            <span className="play-preview-checkers" aria-hidden="true"/>
          </div>
          <div className="play-preview-lane">
            <div className="play-preview-lane-label"><strong>02</strong><span>ЖИШИГ 60</span></div>
            <img src="/cars/graphite-r.svg" alt="" aria-hidden="true" draggable={false}/>
            <span className="play-preview-checkers" aria-hidden="true"/>
          </div>
          <div className="play-preview-lane">
            <div className="play-preview-lane-label"><strong>03</strong><span>ЖИШИГ 40</span></div>
            <img src="/cars/blue-sprint.svg" alt="" aria-hidden="true" draggable={false}/>
            <span className="play-preview-checkers" aria-hidden="true"/>
          </div>
        </div>
        <div className="play-preview-bottom">
          <div><span className="play-preview-status-dot" aria-hidden="true"/> СОНГОСОН МАШИН: <strong>{carName}</strong></div>
          <button type="button" onClick={onGarage}>МАШИН СОЛИХ <span aria-hidden="true">↗</span></button>
        </div>
        <p className="play-preview-disclaimer">Жишиг машинууд нь бодит тоглогч биш. Энэ бол уралдааны замын танилцуулга.</p>
      </div>
    </section>

    <section className="play-friends-feature" aria-labelledby="play-friends-title">
      <div className="play-friends-illustration" aria-hidden="true">
        <img src="/cars/blue-sprint.svg" alt="" draggable={false}/>
        <img src="/cars/graphite-r.svg" alt="" draggable={false}/>
      </div>
      <div className="play-friends-content">
        <span className="play-friends-kicker">02 / НАЙЗУУДТАЙ</span>
        <h2 id="play-friends-title">НАЙЗУУДТАЙГАА УРАЛДАХ</h2>
        <p>2–6 тоглогчтой өрөө үүсгэ, эсвэл найзынхаа кодоор нэгд. Бүгд бэлэн болоход уралдаан эхэлнэ.</p>
      </div>
      <button type="button" className="play-friends-button" onClick={onMultiplayer}>
        ӨРӨӨ ҮҮСГЭХ ЭСВЭЛ НЭГДЭХ <span aria-hidden="true">→</span>
      </button>
    </section>

    <div className="play-entry-footer">
      <div className="play-entry-personalbest"><span>ХУВИЙН РЕКОРД</span><strong>{best} <small>ҮГ/МИН</small></strong></div>
      <p>Ганцаарчилсан уралдаанд жишиг хурдтай бэлтгэнэ. Найзуудтай уралдахад жинхэнэ тоглогчид оролцоно.</p>
    </div>
  </div>;
}
