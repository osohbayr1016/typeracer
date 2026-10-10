export type Skin = 'mint' | 'sunset' | 'purple' | 'lime' | 'phantom';
export type CarSkin = { color: string; label: string; icon: string; unlockAt: number };
export const CARS: Record<Skin, CarSkin> = {
  mint: { color: '#3679e8', label: 'Blue Sprint', icon: '/cars/blue-sprint.svg', unlockAt: 0 },
  sunset: { color: '#fa5139', label: 'Coral GT', icon: '/cars/coral-gt.svg', unlockAt: 0 },
  purple: { color: '#c8cdd6', label: 'Graphite R', icon: '/cars/graphite-r.svg', unlockAt: 0 },
  lime: { color: '#c8e64a', label: 'Volt', icon: '/cars/volt.svg', unlockAt: 250 },
  phantom: { color: '#65666e', label: 'Phantom', icon: '/cars/phantom.svg', unlockAt: 650 }
};
export const carKeys = Object.keys(CARS) as Skin[];
