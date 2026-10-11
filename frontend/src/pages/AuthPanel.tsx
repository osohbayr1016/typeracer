import { useEffect, useState } from 'react';
import './AuthPanel.css';

type Providers = {google:boolean;facebook:boolean};
type Identity = {id:string;name:string;provider:string|null;guest:boolean;points:number;races:number};
const readJSON=async <T,>(path:string,init?:RequestInit):Promise<T>=>{
  const result=await fetch(path,{credentials:'include',...init});
  if(!result.ok)throw Error('Нэвтрэлтийн сервертэй холбогдож чадсангүй.');
  return result.json() as Promise<T>;
};
export function AuthPanel(){
  const [providers,setProviders]=useState<Providers>({google:false,facebook:false});
  const [identity,setIdentity]=useState<Identity|null>(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const status=new URLSearchParams(window.location.search).get('auth');
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try {
        // Session creation precedes OAuth start to prevent login-CSRF and
        // preserve progress when a guest links their first provider account.
        const account=await readJSON<{player:Identity}>('/api/account');
        const available=await readJSON<Providers>('/api/auth/providers');
        if(active){setIdentity(account.player);setProviders(available);}
      }catch{if(active)setError('Нэвтрэлтийн үйлчилгээ түр боломжгүй байна.');}
      finally{if(active)setBusy(false);}
    })();
    return ()=>{active=false;};
  },[]);
  const exit=async()=>{
    setBusy(true);setError('');
    try {
      const session=await readJSON<{player:Identity}>('/api/auth/logout',{method:'POST'});
      setIdentity(session.player);
    }catch{setError('Гарах үед алдаа гарлаа. Дахин оролдоно уу.');}
    finally{setBusy(false);}
  };
  return <section className="auth-panel social-surface" data-testid="auth-panel" aria-label="Нэвтрэх болон account">
    <div className="social-card-heading"><h2>ACCOUNT</h2><span>{identity?.guest===false?'БАТАЛГААЖСАН':'ЗОЧИН · BETA'}</span></div>
    {identity?.guest===false?<div className="auth-connected">
      <span className="auth-verified-mark" aria-hidden="true">✓</span>
      <div><strong>{identity.name}</strong><small>{identity.provider==='google'?'Google':identity.provider==='facebook'?'Facebook':'Нэвтэрсэн'} · {identity.points} POINTS</small></div>
      <button type="button" onClick={()=>void exit()} disabled={busy}>ГАРАХ</button>
    </div>:<>
      <div className="auth-provider-actions">
        <button type="button" disabled={busy||!providers.google} onClick={()=>window.location.assign('/api/auth/google/start')}
          data-testid="google-login"><span className="auth-provider-letter google">G</span> GOOGLE-ЭЭР НЭВТРЭХ</button>
        <button type="button" disabled={busy||!providers.facebook} onClick={()=>window.location.assign('/api/auth/facebook/start')}
          data-testid="facebook-login"><span className="auth-provider-letter facebook">f</span> FACEBOOK-ЭЭР НЭВТРЭХ</button>
      </div>
      {!busy&&!providers.google&&!providers.facebook&&
        <p className="auth-note">Google/Facebook OAuth app-ийн тохиргоо хараахан идэвхжээгүй. Одоохондоо зочноор уралдаж болно.</p>}
      <p className="auth-note">Нэвтрэлт нь серверийн оноо, багийн бүртгэлийг хамгаална. Хөтчийн хуучин зоос, XP автоматаар шилжихгүй.</p>
    </>}
    {status==='connected'&&identity?.guest===false&&<p role="status" className="auth-success">Account амжилттай холбогдлоо.</p>}
    {status&&status!=='connected'&&<p role="alert" className="auth-error">Нэвтрэлт баталгаажаагүй ({status}). Дахин оролдоно уу.</p>}
    {error&&<p role="alert" className="auth-error">{error}</p>}
  </section>;
}
