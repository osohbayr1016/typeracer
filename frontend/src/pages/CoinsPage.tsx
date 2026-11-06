import { useEffect, useState } from 'react';
import { COIN_PACKS, type PaidWallet } from '@typeracer/shared';
import { paymentApi, paymentSession } from '../payments';
import './CoinsPage.css';

export function CoinsPage({ wallet, onWallet, onShop }: {
  wallet: PaidWallet; onWallet: (wallet: PaidWallet) => void; onShop: () => void
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [orderId, setOrderId] = useState(() => new URLSearchParams(location.search).get('order') ?? '');
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        await paymentSession();
        const config = await paymentApi<{ ready: boolean }>('config');
        const next = await paymentApi<PaidWallet>('wallet');
        if (!alive) return;
        setReady(config.ready); onWallet(next);
        if (!config.ready) setError('Төлбөрийн холболт хараахан бэлэн болоогүй байна.');
      } catch (error) { if (alive) setError((error as Error).message); }
    }
    void load(); return () => { alive = false; };
  }, [onWallet]);
  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check() {
      try {
        await paymentSession();
        const order = await paymentApi<{ credited: boolean; status: string; coins: number; wallet: PaidWallet }>(
          'orders/' + encodeURIComponent(orderId));
        if (!alive) return;
        onWallet(order.wallet);
        if (order.credited) { setMessage('✓ Төлбөр баталгаажлаа. ' + order.coins + ' зоос нэмэгдлээ.'); setError(''); return; }
        if (order.status === 'canceled') { setMessage('Төлбөр цуцлагдсан эсвэл хугацаа дууссан.'); return; }
        setMessage('Төлбөрийн баталгаажуулалтыг хүлээж байна…');
        if (++attempts < 60) timer = setTimeout(() => void check(), 10_000);
        else setMessage('Төлбөр хүлээгдэж байна. Дараа нь энэ хуудсаа нээгээд шалгаж болно.');
      } catch (error) { if (alive) setError((error as Error).message); }
    }
    void check(); return () => { alive = false; clearTimeout(timer); };
  }, [orderId, onWallet, refresh]);
  async function checkout(packId: string) {
    setBusy(true); setError('');
    try {
      await paymentSession();
      // Keep the same id after a network failure; only an explicit new checkout gets a new order.
      let requestId = sessionStorage.getItem('tr.payment.request');
      if (!requestId) { requestId = crypto.randomUUID(); sessionStorage.setItem('tr.payment.request', requestId); }
      const result = await paymentApi<{ orderId: string; url?: string; paid?: boolean }>('checkout', { packId, requestId });
      if (result.url) {
        const url = new URL(result.url);
        if (url.protocol !== 'https:' || url.hostname !== 'pay.wire.mn') throw new Error('Төлбөрийн холбоос буруу байна.');
        sessionStorage.removeItem('tr.payment.request');
        location.assign(url.href);
      } else { sessionStorage.removeItem('tr.payment.request'); setOrderId(result.orderId); }
    } catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <section className="coins-page" aria-labelledby="coins-title">
    <button className="back-link" onClick={onShop}>← ДЭЛГҮҮР</button>
    <span className="section-kicker">WIRE · QPAY</span>
    <h1 id="coins-title">ЗООС <span>ЦЭНЭГЛЭХ.</span></h1>
    <div className="coins-balance"><span>ЦЭНЭГЛЭСЭН ЗООС</span><strong>◈ {wallet.balance}</strong></div>
    <p>Банкны апп эсвэл QR-аар төлнө. Төлбөр баталгаажмагц зоос таны бүртгэлд нэмэгдэнэ.</p>
    <div className="coin-packs">{COIN_PACKS.map(pack => <article key={pack.id}>
      <span>{pack.label}</span><h2>◈ {pack.coins} зоос</h2><strong>{pack.amount.toLocaleString('mn-MN')} ₮</strong>
      <button className="primary-button" disabled={!ready || busy} onClick={() => void checkout(pack.id)}>
        {busy ? 'Холбогдож байна…' : pack.amount + ' ₮ · ТӨЛӨХ →'}
      </button>
    </article>)}</div>
    <p className="coins-live-note">Бодит төлбөр · Туршилтаар 100 ₮ төлнө. Зоосыг мөнгө болгон буцаах, шилжүүлэх боломжгүй.</p>
    {orderId && <button className="secondary-button" onClick={() => { setError(''); setRefresh(value => value + 1); }}>Төлбөр дахин шалгах</button>}
    {message && <p role="status" className="coins-status">{message}</p>}
    {error && <p role="alert" className="error-note">{error}</p>}
    {wallet.recent.length > 0 && <div className="coins-history"><h2>Сүүлийн цэнэглэлт</h2>
      {wallet.recent.map(order => <button key={order.id} onClick={() => {
        setOrderId(order.id); setRefresh(value => value + 1); history.replaceState(null, '', '/coins?order=' + encodeURIComponent(order.id));
      }}><span>◈ {order.coins} · {order.amount} ₮</span><span>{order.credited ? '✓ Нэмэгдсэн' : order.status === 'canceled' ? 'Цуцлагдсан' : 'Шалгах →'}</span></button>)}
    </div>}
    <p className="coins-live-note">Бүртгэлээсээ гарах, браузерын мэдээллээ цэвэрлэхээс өмнө профайлаа Google эсвэл Facebook-тэй холбоорой.</p>
  </section>;
}
