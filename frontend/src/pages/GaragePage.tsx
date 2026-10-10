import { CARS, carKeys, type Skin } from './cars';
type Props = { skin: Skin; xp: number; onSelect: (skin: Skin) => void; onPlay: () => void };
export function GaragePage({ skin, xp, onSelect, onPlay }: Props) {
  const level = Math.floor(xp / 300) + 1;
  return <div className="garage-page">
    <div className="flow-heading garage-flow-heading">
      <span className="section-kicker">YOUR COLLECTION / LOCAL GARAGE</span>
      <h1>MY <span>GARAGE.</span></h1>
      <p>Уралдаанд оролцох машинаа сонго. Машины загвар бичих хурданд нөлөөлөхгүй.</p>
    </div>
    <section className="garage-feature">
      <div>
        <span className="section-kicker">CURRENTLY EQUIPPED</span>
        <h2>{CARS[skin].label}</h2>
        <p>LEVEL {level} <span>·</span> {xp} XP</p>
        <button className="primary-button" onClick={onPlay}>▶ PLAY WITH THIS CAR →</button>
      </div>
      <img src={CARS[skin].icon} alt={CARS[skin].label}/>
    </section>
    <div className="garage-collection-heading"><h2>CHOOSE YOUR CAR</h2><span>{carKeys.filter(key => xp >= CARS[key].unlockAt).length} / {carKeys.length} UNLOCKED</span></div>
    <div className="garage-page-grid">
      {carKeys.map((key, index) => {
        const car = CARS[key];
        const locked = xp < car.unlockAt;
        const selected = key === skin;
        return <button key={key} className={'garage-car-tile' + (selected ? ' selected' : '')}
          disabled={locked} aria-pressed={!locked && selected} onClick={() => onSelect(key)}>
          <span className="garage-tile-number">{String(index + 1).padStart(2, '0')}</span>
          <img src={car.icon} alt="" loading="lazy"/>
          <span className="garage-tile-footer"><b>{car.label}</b><small>{locked ? '🔒 ' + car.unlockAt + ' XP' : selected ? '✓ EQUIPPED' : 'EQUIP →'}</small></span>
        </button>;
      })}
    </div>
    <p className="help-note">XP нь зөвхөн таны хөтөч дээр хадгалагдах дасгалын оноо. Худалдан авалт эсвэл төлбөр байхгүй.</p>
  </div>;
}
