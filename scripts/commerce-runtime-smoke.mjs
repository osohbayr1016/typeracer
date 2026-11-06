import { Miniflare } from 'miniflare';
import assert from 'node:assert/strict';

// Native workerd + SQLite + WebSocket tests. Wire is replaced at the network
// boundary: this script cannot charge a bank account or use a merchant secret.
const intents = new Map();
let serial = 0;
const mf = new Miniflare({
  modules:true,compatibilityDate:'2026-10-10',scriptPath:'backend/dist/index.js',
  durableObjects:{RACE_ROOMS:{className:'RaceRoom',useSQLite:true}},
  bindings:{WIRE_API_KEY:'sk_live_runtime_fixture'},
  outboundService:async request => {
    const path = new URL(request.url).pathname;
    if(path === '/v1/payment_intents' && request.method === 'POST') {
      const body = await request.json();
      const intent = {...body,id:'pi_fixture'+(++serial),status:'requires_payment_method'};
      intents.set(intent.id,intent); return Response.json(intent);
    }
    if(path === '/v1/checkout/sessions') {
      const body = await request.json();
      return Response.json({url:'https://pay.wire.mn/c/cs_fixture'+body.payment_intent});
    }
    const intent = intents.get(path.split('/').at(-1));
    return intent ? Response.json(intent) : Response.json({error:{code:'resource_missing'}},{status:404});
  }
});
const api = (path,cookie,body) => mf.dispatchFetch('https://game.example'+path,{
  headers:{...(cookie?{Cookie:cookie}:{}),Origin:'https://game.example','Content-Type':'application/json'},
  ...(body?{method:'POST',body:JSON.stringify(body)}:{})
});
async function account(){const res=await api('/api/account');return {cookie:res.headers.get('set-cookie').split(';')[0],player:(await res.json()).player};}
async function checkout(cookie,id){
  const response=await api('/api/payments/checkout',cookie,{packId:id,requestId:crypto.randomUUID()});
  assert.equal(response.status,200);return response.json();
}
async function pay(cookie,order){
  const intent=[...intents.values()].find(value=>value.metadata.order_id===order.orderId);
  intent.status='succeeded';
  const response=await api('/api/payments/orders/'+order.orderId,cookie);
  assert.equal(response.status,200);const receipt=await response.json();assert.equal(receipt.credited,true);return receipt;
}
async function connect(path,cookie){
  const response=await mf.dispatchFetch('https://game.example'+path,{headers:{Cookie:cookie,Upgrade:'websocket'}});
  assert.equal(response.status,101);const socket=response.webSocket;const messages=[];
  socket.addEventListener('message',event=>messages.push(JSON.parse(String(event.data))));socket.accept();
  return {socket,messages};
}
async function until(read,timeout=8000){
  const end=Date.now()+timeout;
  while(Date.now()<end){const value=read();if(value)return value;await new Promise(resolve=>setTimeout(resolve,15));}
  throw Error('Timed out waiting for runtime result');
}
try {
  const owner=await account();
  assert.equal((await api('/api/payments/checkout',owner.cookie,{packId:'coins-200',requestId:crypto.randomUUID()})).status,403);
  const recovery=await api('/api/account/recovery',owner.cookie,{});assert.equal(recovery.status,201);
  const code=(await recovery.json()).code;assert.match(code,/^trr_[a-f0-9]{48}$/);
  const coins=await checkout(owner.cookie,'coins-200');const first=await pay(owner.cookie,coins);
  assert.equal(first.wallet.balance,200);
  const supporter=await checkout(owner.cookie,'supporter');const bundle=await pay(owner.cookie,supporter);
  assert.equal(bundle.wallet.balance,2200);assert.equal(bundle.wallet.supporter,true);
  assert.equal((await api('/api/payments/checkout',owner.cookie,{packId:'supporter',requestId:crypto.randomUUID()})).status,409);
  const debited=await (await api('/api/payments/items',owner.cookie,{itemKey:'trail:ember'})).json();assert.equal(debited.balance,2080);
  const restored=await api('/api/account/recover',undefined,{code});assert.equal(restored.status,200);
  const restoredCookie=restored.headers.get('set-cookie').split(';')[0];
  assert.equal((await restored.json()).player.id,owner.player.id);
  assert.equal((await (await api('/api/payments/wallet',restoredCookie)).json()).balance,2080);
  const racer=await connect('/api/quickplay/ws?input=2&trail=gold&sticker=crown&title=supporter',restoredCookie);
  const welcome=await until(()=>racer.messages.find(value=>value.type==='welcome'));
  const racing=await until(()=>racer.messages.find(value=>value.type==='state'&&value.phase==='racing'));
  const me=racing.players.find(player=>player.id===welcome.id);
  assert.equal(me.trail,'gold');assert.equal(me.title,'supporter');assert.equal(welcome.inputVersion,2);
  const keys=Array.from(racing.prompt.text.normalize('NFC'));
  const send=(seq,key)=>racer.socket.send(JSON.stringify({type:'key',seq,key,matchId:racing.matchId}));
  send(1,keys[0]);send(1,keys[0]);send(3,keys[2]);send(2,keys[1]);
  const confirmed=await until(()=>racer.messages.find(value=>value.type==='state'&&value.players.some(player=>player.id===welcome.id&&player.inputSeq===2)));
  assert.equal(confirmed.players.find(player=>player.id===welcome.id).strokes,2);
  racer.socket.close();
  const resumed=await connect('/api/quickplay/ws?input=2&resume='+welcome.resumeToken,restoredCookie);
  const same=await until(()=>resumed.messages.find(value=>value.type==='welcome'));assert.equal(same.id,welcome.id);
  resumed.socket.send(JSON.stringify({type:'key',seq:3,key:keys[2],matchId:racing.matchId}));
  await until(()=>resumed.messages.find(value=>value.type==='state'&&value.players.some(player=>player.id===welcome.id&&player.inputSeq===3)));
  const visitor=await account();const forged=await connect('/api/quickplay/ws?input=2&trail=gold&title=supporter',visitor.cookie);
  const visitorWelcome=await until(()=>forged.messages.find(value=>value.type==='welcome'));
  const visitorState=await until(()=>forged.messages.find(value=>value.type==='state'));
  assert.equal(visitorState.players.find(player=>player.id===visitorWelcome.id).trail,'none');
  assert.equal(visitorState.players.find(player=>player.id===visitorWelcome.id).title,'rookie');
  resumed.socket.close();forged.socket.close();
  console.log('PASS: native Worker checkout, recovery, supporter grants, single debit, protected appearance and sequenced reconnect.');
} finally {await mf.dispose();}
