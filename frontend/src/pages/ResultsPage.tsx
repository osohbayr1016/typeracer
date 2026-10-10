type Props = {
  wpm: number; accuracy: number; elapsed: number; best: number; correct: number; carIcon: string;
  onAgain: () => void; onPlay: () => void; onGarage: () => void;
};
export function ResultsPage({ wpm, accuracy, elapsed, best, correct, carIcon, onAgain, onPlay, onGarage }: Props) {
  if (correct === 0) return <div className="results-page no-result">
    <span className="section-kicker">RACE RESULTS</span><h1>NO RACE <span>YET.</span></h1>
    <p>Эхлээд уралдаанаа дуусгаарай.</p>
    <button className="primary-button" onClick={onPlay}>CHOOSE A RACE →</button>
  </div>;
  return <div className="results-page">
    <div className="results-title"><span className="section-kicker">RACE COMPLETE / SOLO</span><h1>FINISH <span>LINE.</span></h1>
      <p>Барианд орлоо! Одоо дараагийн рекордоо эвдэх цаг.</p></div>
    <section className="results-feature">
      <div className="results-car"><img src={carIcon} alt="Equipped race car"/><span>FINISHED</span></div>
      <div className="results-score"><span>YOUR RACE SPEED</span><strong>{wpm}<em> WPM</em></strong><p>PERSONAL BEST: {best} WPM</p></div>
    </section>
    <div className="results-metrics">
      <div><span>ACCURACY</span><strong>{accuracy}%</strong></div>
      <div><span>TIME</span><strong>{(elapsed / 1000).toFixed(1)}s</strong></div>
      <div><span>CHARACTERS</span><strong>{correct}</strong></div>
    </div>
    <div className="results-actions">
      <button className="primary-button" onClick={onAgain}>▶ RACE AGAIN →</button>
      <button className="secondary-button" onClick={onPlay}>CHANGE MODE</button>
      <button className="text-button" onClick={onGarage}>MY GARAGE ↗</button>
    </div>
  </div>;
}
