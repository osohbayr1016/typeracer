import { useEffect, useState } from 'react';
import { CARS } from './cars';
import type { Profile } from '../progression';
import type { QuickRaceOutcome } from './quickResultsModel';
import { raceStandings } from './quickResultsModel';
import './RankingsPages.css';

type PlayerRow = {rank:number;id:string;name:string;points:number;races:number;wpm:number;accuracy:number;bestWpm:number;teamTag:string|null;guest:boolean};
type PlayerBoard = {period:string;total:number;offset:number;limit:number;players:PlayerRow[]};
type TeamRow = {rank:number;id:string;name:string;tag:string;points:number;races:number;members:number};
type TeamBoard = {period:string;teams:TeamRow[]};
type MyTeam = {id:string;name:string;tag:string;captainId:string;joinCode?:string;members:Array<{id:string;name:string;points:number;races:number;bestWpm:number}>};
type Account = {player:{id:string;name:string;guest:boolean;points:number;races:number}};
const fetchJSON = async <T,>(path:string, init?:RequestInit):Promise<T> => {
  const r=await fetch(path,{credentials:'include',...init});
  const data=await r.json() as T&{error?:string};
  if(!r.ok)throw Error(data.error ?? 'Сервертэй холбогдох боломжгүй.');
  return data;
};
const postJSON = <T,>(path:string,data:object) => fetchJSON<T>(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});

export function GlobalLeaderboardPage({outcome,profile,onPlay,onTeams}:{
  outcome:QuickRaceOutcome|null; profile:Profile; onPlay:()=>void; onTeams:()=>void;
}) {
  const [tab,setTab]=useState<'global'|'match'|'personal'>('global');
  const [offset,setOffset]=useState(0);
  const [board,setBoard]=useState<PlayerBoard|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let alive=true;
    void (async()=>{
      setLoading(true);setError('');
      try {const data=await fetchJSON<PlayerBoard>('/api/leaderboard?limit=20&offset='+offset);if(alive)setBoard(data);}
      catch(e){if(alive)setError(e instanceof Error?e.message:'Сүлжээний алдаа');}
      finally{if(alive)setLoading(false);}
    })();
    return ()=>{alive=false;};
  },[offset]);
  const standings=outcome?raceStandings(outcome):[];
  const personal=[...profile.history.filter(h=>h.id.startsWith('quick:'))].sort((a,b)=>b.wpm-a.wpm).slice(0,15);
  return <div className="social-page" data-testid="leaderboard-page">
    <header className="social-heading"><span className="social-eyebrow">ДОЛОО ХОНОГ · БАТАЛГААЖУУЛСАН ГАРАА</span><h1>ЧАНСАА</h1></header>
    <div className="rank-summary"><strong>POINTS</strong><span>WPM + нарийвчлалаас сервер оноо бодно. Ботууд орохгүй.</span><button type="button" onClick={onTeams}>БАГИЙН ЧАНСАА ↗</button></div>
    <div className="social-tabs" role="group" aria-label="Чансааны төрөл">
      <button type="button" className={tab==='global'?'active':''} onClick={()=>setTab('global')}>БҮХ ТОГЛОГЧ</button>
      <button type="button" className={tab==='match'?'active':''} onClick={()=>setTab('match')}>СҮҮЛИЙН ГАРАА</button>
      <button type="button" className={tab==='personal'?'active':''} onClick={()=>setTab('personal')}>МИНИЙ РЕКОРД</button>
    </div>
    <section className="social-surface rank-surface">
      {tab==='global' && <>
        <div className="social-card-heading"><h2>ДОЛОО ХОНОГИЙН ЧАНСАА</h2><span>{board?.total??'—'} ТОГЛОГЧ</span></div>
        {loading?<p role="status" className="social-empty">АЧААЛЖ БАЙНА…</p>:
          error?<p role="alert" className="rank-error">{error}</p>:
          board?.players.length?<div className="rank-overflow"><table className="rank-table" data-testid="global-points-table"><thead><tr>
            <th>#</th><th>ТОГЛОГЧ</th><th>БАГ</th><th>ОНОО</th><th>ГАРАА</th><th>WPM</th><th>НАРИЙВЧЛАЛ</th>
          </tr></thead><tbody>{board.players.map(row=><tr key={row.id}>
            <td className="rank-position">{String(row.rank).padStart(2,'0')}</td><td><strong>{row.name}</strong><small>ЗОЧИН</small></td>
            <td>{row.teamTag??'—'}</td><td className="rank-points">{row.points.toLocaleString('mn-MN')}</td>
            <td>{row.races}</td><td>{row.wpm}</td><td>{row.accuracy}%</td>
          </tr>)}</tbody></table></div>
            :<div className="social-empty">Энэ долоо хоногт дуусгасан уралдаан хараахан байхгүй.</div>}
        <div className="rank-pager"><span>{board?.total?offset+1:0}–{Math.min(offset+20,board?.total??0)} / {board?.total??0}</span>
          <div><button type="button" disabled={offset===0||loading} onClick={()=>setOffset(Math.max(0,offset-20))}>← ӨМНӨХ</button>
          <button type="button" disabled={loading||offset+20>=(board?.total??0)} onClick={()=>setOffset(offset+20)}>ДАРААХ →</button></div>
        </div>
      </>}
      {tab==='match' && (standings.length?<ol className="social-ranking">{standings.map(({player,position,finished,percent})=><li key={player.id}>
        <span className="social-rank">#{position}</span>
        <img src={player.car&&player.car in CARS?CARS[player.car as keyof typeof CARS].icon:CARS.sunset.icon} alt=""/>
        <strong>{player.name}{player.id===outcome?.playerId?' · ТА':''}</strong>
        <small>{player.bot?'БОТ':'ХҮН'}</small><span>{finished?percent+'%':'ДУУСААГҮЙ'}</span>
      </li>)}</ol>:<div className="social-empty">Сүүлийн тоглолтын дүн алга.</div>)}
      {tab==='personal' && (personal.length?<ol className="social-ranking social-personal-ranking">
        {personal.map((x,i)=><li key={x.id}><span className="social-rank">#{i+1}</span><strong>{x.wpm} WPM</strong><small>{x.accuracy}%</small><span>{new Date(x.at).toLocaleDateString('mn-MN')}</span></li>)}
      </ol>:<div className="social-empty">Таны хувийн рекорд хараахан бүртгэгдээгүй.</div>)}
    </section>
    <div className="social-bottom-actions"><button type="button" className="social-primary" onClick={onPlay}>▶ УРАЛДАХ</button>
      <span>Бодит серверийн оноо · UTC Даваа гарагт долоо хоног шинээр эхэлнэ. Зочны аккаунтуудын anti-cheat одоогоор хязгаарлагдмал.</span></div>
  </div>;
}

export function TeamsPage({onPlay}: {onPlay:()=>void}) {
  const [board,setBoard]=useState<TeamBoard|null>(null);
  const [account,setAccount]=useState<Account|null>(null);
  const [mine,setMine]=useState<MyTeam|null>(null);
  const [name,setName]=useState('');
  const [tag,setTag]=useState('');
  const [code,setCode]=useState('');
  const [mode,setMode]=useState<'create'|'join'>('create');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const refresh=async()=>{
    const [a,b,m]=await Promise.all([
      fetchJSON<Account>('/api/account'), fetchJSON<TeamBoard>('/api/teams'),
      fetchJSON<{team:MyTeam|null}>('/api/teams/me')
    ]);
    setAccount(a);setBoard(b);setMine(m.team);
  };
  useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:'Сүлжээний алдаа'));},[]);
  const submit=async()=>{
    setBusy(true);setError('');setMessage('');
    try{
      await postJSON('/api/teams',mode==='create'?{action:'create',name,tag}:{action:'join',code});
      await refresh();setMessage('Багийн мэдээлэл шинэчлэгдлээ.');
    }catch(e){setError(e instanceof Error?e.message:'Алдаа гарлаа');}
    finally{setBusy(false);}
  };
  return <div className="social-page" data-testid="teams-page">
    <header className="social-heading"><span className="social-eyebrow">БАГИЙН ӨРСӨЛДӨӨН · БОДИТ ОНОО</span><h1>БАГУУД</h1></header>
    <div className="rank-summary"><strong>TEAM POINTS</strong><span>Нэг багийн гишүүдийн уралдаж олсон оноо нийлнэ.</span></div>
    <div className="social-two-grid">
      <section className="social-surface"><div className="social-card-heading"><h2>БАГИЙН ЧАНСАА</h2><span>ДОЛОО ХОНОГ</span></div>
        {board?.teams.length?<div className="rank-overflow"><table className="rank-table" data-testid="team-points-table"><thead><tr><th>#</th><th>БАГ</th><th>ОНОО</th><th>ГИШҮҮН</th></tr></thead>
        <tbody>{board.teams.map(t=><tr key={t.id}><td className="rank-position">#{t.rank}</td><td><strong>[{t.tag}] {t.name}</strong></td><td className="rank-points">{t.points}</td><td>{t.members}</td></tr>)}</tbody></table></div>:
          <div className="social-empty">Одоогоор баг бүртгэгдээгүй.</div>}
      </section>
      <section className="social-surface">
        {mine?<><div className="social-card-heading"><h2>[{mine.tag}] {mine.name}</h2><span>{mine.members.length}/25</span></div>
          {mine.joinCode&&<div className="rank-invite"><span>УРЬХ КОД</span><strong>{mine.joinCode}</strong><button type="button" onClick={()=>void navigator.clipboard?.writeText(mine.joinCode!)}>ХУУЛАХ</button></div>}
          <ul className="rank-roster">{mine.members.map(p=><li key={p.id}><strong>{p.name}{p.id===account?.player.id?' · ТА':''}</strong><span>{p.points} POINTS · {p.bestWpm} WPM</span></li>)}</ul>
          {mine.captainId!==account?.player.id&&<button type="button" onClick={()=>void postJSON('/api/teams',{action:'leave'}).then(refresh).catch(e=>setError(String(e)))}>БАГААС ГАРАХ</button>}
        </>:<><div className="social-card-heading"><h2>БАГТ ОРОХ</h2></div>
          <div className="social-tabs rank-mode"><button className={mode==='create'?'active':''} onClick={()=>setMode('create')} type="button">ҮҮСГЭХ</button>
            <button className={mode==='join'?'active':''} onClick={()=>setMode('join')} type="button">КОДООР НЭГДЭХ</button></div>
          <form className="rank-team-form" onSubmit={e=>{e.preventDefault();void submit();}}>
            {mode==='create'?<><label>БАГИЙН НЭР<input maxLength={20} value={name} onChange={e=>setName(e.target.value)} placeholder="Талын аянга"/></label>
              <label>TAG (2–5)<input maxLength={5} value={tag} onChange={e=>setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="MN"/></label></>:
              <label>УРЬХ КОД<input maxLength={8} value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,''))} placeholder="XXXXXXXX"/></label>}
            <button type="submit" disabled={busy||(mode==='create'?name.trim().length<3||tag.length<2:code.length!==8)}>{busy?'ТҮР ХҮЛЭЭНЭ ҮҮ…':mode==='create'?'+ БАГ ҮҮСГЭХ':'БАГТ НЭГДЭХ →'}</button>
          </form></>}
        {error&&<p role="alert" className="rank-error">{error}</p>}{message&&<p role="status" className="rank-success">{message}</p>}
      </section>
    </div>
    <div className="social-bottom-actions"><button className="social-primary" type="button" onClick={onPlay}>▶ УРАЛДАХ</button>
      <span>Багт нэгдсэнээс хойш олсон оноо тооцогдоно. Зочны баг/профайлыг Google/Facebook account-аар хамгаалах шаардлагатай.</span></div>
  </div>;
}
