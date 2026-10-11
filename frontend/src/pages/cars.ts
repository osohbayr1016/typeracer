export type Skin = 'mint' | 'sunset' | 'purple' | 'lime' | 'phantom' | 'steppe' | 'thunder' | 'midnight' | 'khan' | 'dawn' | 'cosmic';
export type CarSkin = { color: string; label: string; icon: string; unlockAt: number };
export const CARS: Record<Skin, CarSkin> = {
  mint: { color: '#3679e8', label: 'Blue Sprint', icon: '/cars/blue-sprint.svg', unlockAt: 0 },
  sunset: { color: '#fa5139', label: 'Coral GT', icon: '/cars/coral-gt.svg', unlockAt: 0 },
  purple: { color: '#c8cdd6', label: 'Graphite R', icon: '/cars/graphite-r.svg', unlockAt: 0 },
  lime: { color: '#c8e64a', label: 'Volt', icon: '/cars/volt.svg', unlockAt: 250 },
  phantom: { color: '#65666e', label: 'Phantom', icon: '/cars/phantom.svg', unlockAt: 650 },
  steppe: { color: '#268ce5', label: 'Талын салхи', icon: '/cars/steppe.svg', unlockAt: 0 },
  thunder: { color: '#b8ed19', label: 'Аянга', icon: '/cars/thunder.svg', unlockAt: 0 },
  midnight: { color: '#69737f', label: 'Шөнийн хүлэг', icon: '/cars/midnight.svg', unlockAt: 0 },
  khan: { color: '#e9b643', label: 'Хааны хүлэг', icon: '/cars/khan.svg', unlockAt: 0 },
  dawn: { color: '#ff945e', label: 'Үүрийн гэгээ', icon: '/cars/dawn.svg', unlockAt: 0 },
  cosmic: { color: '#b17dfc', label: 'Оддын зам', icon: '/cars/cosmic.svg', unlockAt: 0 }
};
export const carKeys = Object.keys(CARS) as Skin[];
