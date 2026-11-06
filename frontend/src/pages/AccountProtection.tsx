import { useState } from 'react';
import { paymentSession } from '../payments';

/** No email service required. The server stores only the recovery code's hash. */
export function AccountProtection({ ready, onSaved }: { ready: boolean; onSaved: () => void }) {
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [restore, setRestore] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  async function create() {
    setBusy(true); setError('');
    try {
      await paymentSession();
      const result = await fetch('/api/account/recovery', {method:'POST',credentials:'same-origin'});
      const value = await result.json() as {code?:string;exists?:boolean};
      if (value.exists) { onSaved(); return; }
      if (!result.ok || !value.code) throw Error('Код үүсгэж чадсангүй. Дахин оролдоно уу.');
      setCode(value.code);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function recover(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await fetch('/api/account/recover', {method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({code:restore})});
      if (!result.ok) throw Error(result.status === 429 ? 'Түр хүлээгээд дахин оролдоно уу.' : 'Сэргээх код буруу байна.');
      location.reload();
    } catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <section className="account-protection" aria-label="Бүртгэлийн хамгаалалт">
    <div><strong>{ready ? '✓ БҮРТГЭЛ ХАМГААЛАГДСАН' : 'ХУДАЛДАН АВАЛТАА ХАДГАЛААРАЙ'}</strong>
      <p>{ready ? 'Сэргээх код эсвэл холбосон бүртгэлээрээ өөр төхөөрөмжөөс зоос, авсан зүйлсээ сэргээнэ.' :
        'Төлбөр хийхээс өмнө сэргээх кодоо аюулгүй газар хадгалаарай. Кодтой хүн таны бүртгэлд нэвтрэх боломжтой.'}</p></div>
    {!ready && !code && <button type="button" className="secondary-button" disabled={busy} onClick={() => void create()}>
      СЭРГЭЭХ КОД ҮҮСГЭХ</button>}
    {code && <div className="recovery-secret">
      <label>Энэ код дахин харагдахгүй.<input aria-label="Миний сэргээх код" readOnly value={code} onFocus={event => event.currentTarget.select()}/></label>
      <button type="button" className="secondary-button" onClick={() => {
        void navigator.clipboard.writeText(code).then(() => setCopied(true)).catch(() => setError('Кодоо сонгоод өөрөө хуулж аваарай.'));
      }}>{copied ? '✓ ХУУЛСАН' : 'КОД ХУУЛАХ'}</button>
      <label className="recovery-saved"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)}/>Кодоо аюулгүй газар хадгалсан</label>
      <button type="button" className="primary-button" disabled={!saved} onClick={() => {setCode('');onSaved();}}>ҮРГЭЛЖЛҮҮЛЭХ →</button>
    </div>}
    <details className="recovery-restore"><summary>Өмнөх бүртгэлээ сэргээх</summary>
      <form onSubmit={event => void recover(event)}>
        <label>Сэргээх код<input type="password" aria-label="Бүртгэл сэргээх код" autoComplete="off" spellCheck={false}
          value={restore} onChange={event => setRestore(event.target.value)} placeholder="trr_…"/></label>
        <button className="secondary-button" disabled={busy || !restore.trim()}>БҮРТГЭЛ СЭРГЭЭХ</button>
      </form>
    </details>
    {error && <p role="alert" className="error-note">{error}</p>}
  </section>;
}
