import { useEffect, useRef, useState } from 'react';

/** Keep navigation usable without cluttering every page with all destinations. */
export type NavDestination =
  | 'home' | 'play' | 'friends' | 'leaderboard' | 'garage'
  | 'shop' | 'season' | 'teams' | 'stats' | 'profile';

type Props = {
  page: string;
  nickname: string;
  level: number;
  coins: number;
  onNavigate: (page: NavDestination) => void;
};
const links: Array<{page:NavDestination;label:string;icon:string}> = [
  {page:'play',label:'Тоглох',icon:'◢'},
  {page:'friends',label:'Найзууд',icon:'♧'},
  {page:'leaderboard',label:'Чансаа',icon:'▥'},
  {page:'garage',label:'Гараж',icon:'▰'}
];
const extra: Array<{page:NavDestination;label:string;description:string}> = [
  {page:'shop',label:'Дэлгүүр',description:'Машин · гоёл'},
  {page:'season',label:'Battle Pass',description:'Шагнал · ахиц'},
  {page:'teams',label:'Багууд',description:'Багийн чансаа'},
  {page:'stats',label:'Статистик',description:'Хурд · үр дүн'}
];
export function navActive(current:string, destination:NavDestination):boolean {
  if(destination==='play')return ['play','race','quickRace','quickResults','results'].includes(current);
  if(destination==='friends')return ['friends','multiplayer','multiplayerRace'].includes(current);
  return current===destination;
}
export function SiteNavigation({page,nickname,level,coins,onNavigate}:Props) {
  const [moreOpen,setMoreOpen]=useState(false);
  const wrapRef=useRef<HTMLElement>(null);
  const navigate=(destination:NavDestination)=>{
    setMoreOpen(false);
    onNavigate(destination);
  };
  useEffect(()=>{
    const closeOnEscape=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setMoreOpen(false);
    };
    const closeOutside=(event:PointerEvent)=>{
      if(event.target instanceof Node && !wrapRef.current?.contains(event.target) &&
          !(event.target instanceof Element && event.target.closest('.premium-mobile-nav')))
        setMoreOpen(false);
    };
    document.addEventListener('keydown',closeOnEscape);
    document.addEventListener('pointerdown',closeOutside);
    return ()=>{
      document.removeEventListener('keydown',closeOnEscape);
      document.removeEventListener('pointerdown',closeOutside);
    };
  },[]);
  const moreSelected=extra.some(link=>navActive(page,link.page));
  const moreButton=(mobile:boolean)=><button type="button"
    className={'premium-nav-link premium-more-trigger'+(moreSelected?' is-active':'')}
    aria-expanded={moreOpen} aria-controls="premium-more-panel" aria-label="Бусад хуудас"
    onClick={()=>setMoreOpen(open=>!open)}>
      {mobile&&<span className="premium-link-icon" aria-hidden="true">☷</span>}
      <span>Бусад</span><span className="premium-down" aria-hidden="true">{moreOpen?'⌃':'⌄'}</span>
    </button>;
  return <>
    <header className="topbar premium-header" ref={wrapRef}>
      <div className="shell premium-header-content">
        <a href="/" className="brand premium-brand"
          onClick={event=>{event.preventDefault();navigate('home');}}
          aria-label="TypeRacer Mongolia нүүр">
          <span className="brand-mark">TR</span>
          <span className="brand-name">TYPE<span>RACER</span><small>MONGOLIA</small></span>
        </a>
        <nav className="premium-primary-nav" aria-label="Үндсэн цэс">
          {links.map(link=><button key={link.page} type="button"
            className={'premium-nav-link'+(navActive(page,link.page)?' is-active':'')}
            aria-current={navActive(page,link.page)?'page':undefined}
            onClick={()=>navigate(link.page)}>{link.label}</button>)}
          {moreButton(false)}
        </nav>
        <div className="premium-user-tools">
          <span className="premium-wallet" aria-label={coins+' зоос'}><span aria-hidden="true">◈</span>
            <strong>{coins.toLocaleString('mn-MN')}</strong>
          </span>
          <button className="profile-chip premium-profile" type="button" onClick={()=>navigate('profile')}
            aria-label="Миний профайл" aria-current={page==='profile'?'page':undefined}>
            <span className="profile-avatar premium-avatar" aria-hidden="true">●</span>
            <span className="profile-name">{nickname}<small>ТҮВШИН {level} · ◈ {coins}</small></span>
          </button>
        </div>
      </div>
      {moreOpen&&<div className="premium-more-panel" id="premium-more-panel">
        <div className="premium-more-heading">БУСАД</div>
        {extra.map(link=><button type="button" key={link.page} onClick={()=>navigate(link.page)}
          className={'premium-more-item'+(navActive(page,link.page)?' is-active':'')}
          aria-current={navActive(page,link.page)?'page':undefined}>
          <strong>{link.label}</strong><small>{link.description}</small><span aria-hidden="true">↗</span>
        </button>)}
      </div>}
    </header>
    <nav className="premium-mobile-nav" aria-label="Гар утасны үндсэн цэс">
      {links.map(link=><button key={link.page} type="button"
        className={'premium-mobile-link'+(navActive(page,link.page)?' is-active':'')}
        aria-current={navActive(page,link.page)?'page':undefined}
        onClick={()=>navigate(link.page)}>
          <span className="premium-link-icon" aria-hidden="true">{link.icon}</span>
          <span>{link.label}</span>
        </button>)}
      <button type="button" className={'premium-mobile-link'+(moreOpen||moreSelected?' is-active':'')}
        aria-expanded={moreOpen} aria-controls="premium-more-panel"
        onClick={()=>setMoreOpen(open=>!open)}>
        <span className="premium-link-icon" aria-hidden="true">☷</span>
        <span>Бусад</span>
      </button>
    </nav>
  </>;
}
