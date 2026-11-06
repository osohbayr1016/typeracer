import { useEffect, useRef, useState } from 'react';
import { COIN_PACKS, type CoinProduct, type PaidWallet } from '@typeracer/shared';
import { paymentApi, paymentSession } from '../payments';
import { AccountProtection } from './AccountProtection';
import './CoinsPage.css';

type Receipt = { credited: boolean; status: string; coins: number; label?: string; grants?: string[];
  checkoutUrl?: string; wallet: PaidWallet };
const money = (amount: number) => amount.toLocaleString('mn-MN') + ' ₮';
export function CoinsPage({ wallet, onWallet, onShop, onGarage }: {
  wallet: PaidWallet; onWallet: (wallet: PaidWallet) => void; onShop: () => void; onGarage?: () => void
}) {
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<readonly CoinProduct[]>(COIN_PACKS);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [orderId, setOrderId] = useState(() => new URLSearchParams(location.search).get('order') ?? '');
  const requests = useRef(new Map<string,string>());
  const protectedAccount = !!(wallet.linked || wallet.recoveryReady);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await paymentSession();
        const config = await paymentApi<{ready:boolean;packs:CoinProduct[]}>('config');
        const next = await paymentApi<PaidWallet>('wallet');
        if (!alive) return;
        setReady(config.ready); if (config.packs) setCatalog(config.packs); onWallet(next);
        if (!config.ready) setError('Төлбөрийн холболт хараахан бэлэн болоогүй байна.');
      } catch (error) { if (alive) setError((error as Error).message); }
    })();
    return () => { alive = false; };
  }, [onWallet, refresh]);
  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    void check();
    async function check() {
      try {
        await paymentSession();
        const order = await paymentApi<Receipt>('orders/' + encodeURIComponent(orderId));
        if (!alive) return;
        setReceipt(order); onWallet(order.wallet); setError('');
        if (order.credited) {
          setMessage('✓ Төлбөр баталгаажлаа. ' + order.coins + ' зоос нэмэгдлээ.' +
            (order.grants?.length ? ' Дэмжигчийн гоёлоо гаражаас сонгоорой.' : ''));
          return;
        }
        if (order.status === 'canceled') { setMessage('Төлбөр цуцлагдсан эсвэл хугацаа дууссан.'); return; }
        setMessage('Төлбөрийн баталгаажуулалтыг хүлээж байна…');
      } catch (error) { if (alive) setError((error as Error).message); }
      if (alive && ++attempts < 60) timer = setTimeout(() => void check(), 10_000);
    }
    return () => { alive = false; clearTimeout(timer); };
  }, [orderId, onWallet, refresh]);
  function openReceipt(id: string) {
    setReceipt(null); setMessage(''); setError(''); setOrderId(id); setRefresh(n => n + 1);
    history.replaceState(null, '', '/coins?order=' + encodeURIComponent(id));
  }
  function redirect(value: string) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'pay.wire.mn')
      throw new Error('Төлбөрийн холбоос буруу байна.');
    location.assign(url.href);
  }
  async function checkout(pack: CoinProduct) {
    if (busy) return;
    setBusy(pack.id); setError('');
    try {
      await paymentSession();
      const storageKey = 'tr.payment.request.' + pack.id;
      let requestId = requests.current.get(pack.id);
      try { requestId ||= sessionStorage.getItem(storageKey) ?? undefined; } catch { /* private browsing */ }
      requestId ||= crypto.randomUUID(); requests.current.set(pack.id, requestId);
      try { sessionStorage.setItem(storageKey, requestId); } catch { /* in-memory retry is retained */ }
      const result = await paymentApi<{orderId:string;url?:string}>('checkout', {packId:pack.id,requestId});
      requests.current.delete(pack.id);
      try { sessionStorage.removeItem(storageKey); } catch { /* optional storage */ }
      if (result.url) redirect(result.url); else {openReceipt(result.orderId);setBusy('');}
    } catch (error) { setError((error as Error).message); setBusy(''); }
  }
  function product(pack: CoinProduct) {
    const owned = pack.oneTime && wallet.supporter;
    return <article key={pack.id} className={pack.oneTime ? 'supporter-pack' : ''} data-product-id={pack.id}>
      <span className="pack-label">{pack.label}</span>
      {pack.oneTime && <div className="supporter-preview" aria-hidden="true"><span className="supporter-streak"/><img src="/cars/race/sunset.webp" alt=""/><b>♛</b></div>}
      <h2>◈ {pack.coins.toLocaleString('mn-MN')} зоос</h2>
      <p>{pack.description}</p>
      {pack.bonus && <span className="pack-bonus">+{pack.bonus} бонус багтсан</span>}
      <strong>{money(pack.amount)}</strong>
      <button className="primary-button" disabled={!ready || !!busy || !!owned || (!pack.testOnly && !protectedAccount)}
        onClick={() => void checkout(pack)}>{owned ? '✓ АВСАН' : busy === pack.id ? 'Холбогдож байна…' : money(pack.amount) + ' · ТӨЛӨХ →'}</button>
      {owned && <button className="secondary-button" onClick={onGarage ?? onShop}>ГАРАЖААС СОНГОХ →</button>}
      {pack.oneTime && <small>Нэг удаагийн төлбөр · Автомат сунгалтгүй</small>}
    </article>;
  }
  return <section className="coins-page" aria-labelledby="coins-title">
    <button className="back-link" onClick={onShop}>← ДЭЛГҮҮР</button>
    <span className="section-kicker">WIRE · QPAY</span>
    <h1 id="coins-title">ЗООС <span>ЦЭНЭГЛЭХ.</span></h1>
    <div className="coins-balance"><div><span>ЦЭНЭГЛЭСЭН ЗООС</span>
      {wallet.supporter && <small className="supporter-tag">♛ ДЭМЖИГЧ</small>}</div><strong>◈ {wallet.balance.toLocaleString('mn-MN')}</strong></div>
    <p>Уралдаан үнэгүй. Зоосоор дуртай машин, гэрлийн мөр, тэмдэгээ сонгоорой. Гоёл нь хурд, оноог өөрчлөхгүй.</p>
    <AccountProtection ready={protectedAccount} onSaved={() => setRefresh(value => value + 1)}/>
    <div className="coin-packs">{catalog.filter(pack => !pack.testOnly).map(product)}</div>
    <p className="coins-live-note">Үнэ нь төгрөгөөр илэрхийлсэн бодит төлбөр. Зоосыг мөнгө болгон буцаах, шилжүүлэх боломжгүй.</p>
    <details className="test-payment"><summary>100 ₮-ийн холболтын туршилт</summary>
      <div className="coin-packs">{catalog.filter(pack => pack.testOnly).map(product)}</div>
    </details>
    {orderId && <div className="receipt-panel" aria-label="Төлбөрийн баримт">
      <h2>{receipt?.label || 'Төлбөр шалгах'}</h2><small>Захиалга: {orderId}</small>
      {message && <p role="status" className="coins-status">{message}</p>}
      <div className="receipt-actions">
        <button className="secondary-button" onClick={() => setRefresh(value => value + 1)}>Төлбөр дахин шалгах</button>
        {receipt?.checkoutUrl && !receipt.credited && <button className="primary-button" onClick={() => redirect(receipt.checkoutUrl!)}>ТӨЛБӨР ҮРГЭЛЖЛҮҮЛЭХ →</button>}
        {receipt?.credited && <button className="primary-button" onClick={onGarage ?? onShop}>ГАРАЖ →</button>}
      </div>
    </div>}
    {error && <p role="alert" className="error-note">{error}</p>}
    {wallet.recent.length > 0 && <div className="coins-history"><h2>Төлбөрийн түүх</h2>
      {wallet.recent.map(order => <button key={order.id} onClick={() => openReceipt(order.id)}>
        <span><strong>{order.label || '◈ ' + order.coins + ' зоос'}</strong><small>{money(order.amount)}{order.createdAt ? ' · ' + new Date(order.createdAt).toLocaleDateString('mn-MN') : ''}</small></span>
        <span>{order.credited ? '✓ Баталгаажсан' : order.status === 'canceled' ? 'Цуцлагдсан' : 'Шалгах →'}</span>
      </button>)}
    </div>}
  </section>;
}
