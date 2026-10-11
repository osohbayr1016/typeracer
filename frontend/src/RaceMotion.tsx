import { useEffect, useState } from 'react';
import './RaceMotion.css';

export type RouteMotionEvent = {
  id: number;
  destination: string;
};

type Props = {
  carIcon: string;
  carName: string;
  transition: RouteMotionEvent | null;
};

const BOOT_KEY = 'typeracer.boot.seen.v1';

function shouldShowBoot(): boolean {
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      sessionStorage.getItem(BOOT_KEY) !== '1';
  } catch {
    return false;
  }
}

/**
 * Keep this outside the keyed page container so navigation never resets its timer.
 * First visit: a lightweight loading splash while the equipped SVG resolves.
 * Normal route: a single GPU-transformed car wipe, never a fake network wait.
 */
export function RaceMotion({ carIcon, carName, transition }: Props) {
  const [bootVisible, setBootVisible] = useState(shouldShowBoot);

  useEffect(() => {
    if (!bootVisible) return;
    let cancelled = false;
    // The loading screen appears once per tab. It ends once the vehicle artwork
    // has resolved (or the short guard expires); it is not tied to imaginary progress.
    const carReady = new Promise<void>(resolve => {
      const car = new Image();
      car.onload = () => resolve();
      car.onerror = () => resolve();
      car.src = carIcon;
      if (car.complete) resolve();
    });
    const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));
    void Promise.all([wait(500), Promise.race([carReady, wait(1100)])]).then(() => {
      if (cancelled) return;
      try { sessionStorage.setItem(BOOT_KEY, '1'); } catch { /* private browsing */ }
      setBootVisible(false);
    });
    return () => { cancelled = true; };
    // The first equipped car is deliberately captured for this one-time intro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>
    {bootVisible && <div className="race-boot" data-testid="race-boot" role="status" aria-live="polite">
      <div className="race-boot-inner">
        <div className="race-boot-brand"><strong>TR</strong><span>TYPE RACER<small>МОНГОЛ</small></span></div>
        <div className="race-boot-label">УРАЛДААНД БЭЛДЭЖ БАЙНА</div>
        <div className="race-boot-track" aria-hidden="true">
          <div className="race-boot-track-stripe"/>
          <div className="race-boot-speed"/>
          <img className="race-boot-car" src={carIcon} alt=""/>
          <span className="race-boot-finish"/>
        </div>
        <div className="race-boot-caption">Таны хүлэг: <strong>{carName}</strong></div>
        <div className="race-boot-line" aria-hidden="true"><span/></div>
      </div>
    </div>}
    {transition && !bootVisible && <div className="race-route-motion" aria-hidden="true"
      data-testid="race-route-motion" data-destination={transition.destination} key={transition.id}>
      <div className="race-route-panel">
        <div className="race-route-bar">
          <span className="race-route-mark">TR</span>
          <div className="race-route-copy"><strong>{transition.destination}</strong><small>ДАРААГИЙН ГАРАА</small></div>
        </div>
        <div className="race-route-lane">
          <span className="race-route-tiremarks"/>
          <img src={carIcon} alt=""/>
          <span className="race-route-checker"/>
        </div>
      </div>
    </div>}
  </>;
}
