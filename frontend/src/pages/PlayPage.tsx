import { useState } from 'react';
import './PlayPage.css';

type Props = {
  best: number; carIcon: string; carName: string;
  onPlay: () => void; onMultiplayer: () => void;
  onCreateRoom: () => void; onJoinRoom: (code: string) => void; onGarage: () => void;
};
/** Two obvious next actions. No invented online friend or account state. */
export function PlayPage({ best, carIcon, carName, onPlay, onMultiplayer, onCreateRoom, onJoinRoom, onGarage }: Props) {
  const [code, setCode] = useState('');
  const validCode = /^[A-F0-9]{8}$/.test(code);
  return <div className="play-choice-page" data-testid="play-choices">
    <header className="play-choice-header">
      <div><span className="play-choice-kicker">TYPE RACER / MONGOLIA</span><h1>ТОГЛОХ</h1></div>
      <span className="play-record-pill">ХУВИЙН РЕКОРД <b>{best} WPM</b></span>
    </header>
    <div className="play-choice-grid">
      <section className="play-choice-card play-choice-public" aria-labelledby="play-live-title">
        <div className="play-choice-top"><span className="play-choice-index">01 / ОНЛАЙН</span><span className="play-available"><span/> НЭЭЛТТЭЙ</span></div>
        <div className="play-choice-art">
          <div className="play-choice-road" aria-hidden="true"/>
          <img className="play-choice-main-car" src={carIcon} alt={carName}/>
          <img className="play-choice-rival-car" src="/cars/race/mint.webp" alt="" aria-hidden="true"/>
          <span className="play-choice-finish" aria-hidden="true"/>
        </div>
        <div className="play-choice-copy"><span className="play-choice-type">5 УРАЛДАГЧ · БОТООР НӨХНӨ</span><h2 id="play-live-title">ШУУД УРАЛДАХ</h2></div>
        <button className="play-choice-primary" type="button" onClick={onPlay} data-testid="quick-play-button">▶ УРАЛДАХ <span aria-hidden="true">→</span></button>
        <div className="play-choice-bottom"><span>МОНГОЛ ХЭЛ · Ө Ү</span><button type="button" onClick={onGarage}>МАШИН СОЛИХ ↗</button></div>
      </section>
      <section className="play-choice-card play-choice-friends" aria-labelledby="play-friends-title">
        <div className="play-choice-top"><span className="play-choice-index">02 / ХУВИЙН ӨРӨӨ</span><span className="play-choice-people">2–6 ХҮН</span></div>
        <div className="play-choice-art">
          <div className="play-choice-road" aria-hidden="true"/>
          <img className="play-choice-main-car" src="/cars/race/purple.webp" alt=""/>
          <img className="play-choice-rival-car" src="/cars/race/mint.webp" alt="" aria-hidden="true"/>
          <span className="play-choice-finish" aria-hidden="true"/>
        </div>
        <div className="play-choice-copy"><span className="play-choice-type">НАЙЗАА КОДООР УРЬ</span><h2 id="play-friends-title">НАЙЗУУДТАЙГАА</h2></div>
        <button className="play-choice-create" type="button" onClick={onCreateRoom} data-testid="create-friends-room">+ ӨРӨӨ ҮҮСГЭХ <span aria-hidden="true">→</span></button>
        <form className="play-choice-join" onSubmit={event => { event.preventDefault(); if(validCode) onJoinRoom(code); }}>
          <label htmlFor="play-room-code">ӨРӨӨНД НЭГДЭХ</label>
          <div><input id="play-room-code" aria-label="Өрөөний код" inputMode="text" maxLength={8}
            autoCapitalize="characters" placeholder="8 ТЭМДЭГТ КОД" value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,8))}/>
            <button type="submit" disabled={!validCode} aria-label="Кодоор нэгдэх">→</button></div>
        </form>
        <button className="play-choice-subtle" type="button" onClick={onMultiplayer}>ӨРӨӨНИЙ ХУУДАС ↗</button>
      </section>
    </div>
  </div>;
}
