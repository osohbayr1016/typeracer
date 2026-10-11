type Props = {
  wpm: number; accuracy: number; elapsed: number; best: number; correct: number; carIcon: string; earnedXp: number; earnedCoins: number;
  onAgain: () => void; onPlay: () => void; onGarage: () => void;
};
export function ResultsPage({ wpm, accuracy, elapsed, best, correct, carIcon, earnedXp, earnedCoins, onAgain, onPlay, onGarage }: Props) {
  if (correct === 0) return <div className="results-page no-result">
    <span className="section-kicker">УРАЛДААНЫ ҮР ДҮН</span><h1>УРАЛДААН <span>АЛГА.</span></h1>
    <p>Эхлээд уралдаанаа дуусгаарай.</p>
    <button className="primary-button" onClick={onPlay}>УРАЛДААН СОНГОХ →</button>
  </div>;
  return <div className="results-page">
    <div className="results-title"><span className="section-kicker">ГАНЦААРЧИЛСАН УРАЛДААН · ДУУССАН</span><h1>БАРИАНД <span>ОРЛОО!</span></h1>
      <p>Барианд орлоо! Одоо дараагийн рекордоо эвдэх цаг.</p></div>
    <section className="results-feature">
      <div className="results-car"><img src={carIcon} alt="Equipped race car"/><span>ДУУССАН</span></div>
      <div className="results-score"><span>БИЧИХ ХУРД</span><strong>{wpm}<em> WPM</em></strong><p>ХУВИЙН РЕКОРД: {best} WPM</p></div>
    </section>
    <div className="results-metrics">
      <div><span>НАРИЙВЧЛАЛ</span><strong>{accuracy}%</strong></div>
      <div><span>ХУГАЦАА</span><strong>{(elapsed / 1000).toFixed(1)}s</strong></div>
      <div><span>ТЭМДЭГТ</span><strong>{correct}</strong></div>
    </div>
    <div className="result-rewards"><span>ЭНЭ УРАЛДААНЫ ШАГНАЛ</span><strong>+{earnedXp} XP</strong><strong>◈ +{earnedCoins} зоос</strong></div>
    <div className="results-actions">
      <button className="primary-button" onClick={onAgain}>▶ ДАХИН УРАЛДАХ →</button>
      <button className="secondary-button" onClick={onPlay}>ГОРИМ СОЛИХ</button>
      <button className="text-button" onClick={onGarage}>ГАРАЖ ↗</button>
    </div>
  </div>;
}
