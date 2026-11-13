import {expect,test} from '@playwright/test';

test('server-owned online rewards and shop purchases survive reload and cannot be forged by browser',async({page})=>{
  await page.goto('/profile');
  await expect(page.getByTestId('online-progress')).toContainText('СЕРВЕРТ ХАДГАЛАГДСАН');
  const first=await page.request.get('/api/progression');
  expect(first.ok()).toBeTruthy();
  const account=await first.json() as {coins:number;races:number;xp:number;owned:string[];source:string};
  expect(account).toMatchObject({coins:200,races:0,xp:0,source:'server'});
  expect(account.owned).toEqual([]);

  const attempt=await page.request.post('/api/progression/award',{data:{
    raceId:'11111111-1111-4111-8111-111111111111',coins:100000,wpm:200,accuracy:100
  }});
  expect(attempt.status()).toBe(404);
  const forgedPrice=await page.request.post('/api/progression/items',{data:{
    kind:'car',id:'falcon',price:0,coins:999999
  }});
  expect(forgedPrice.status()).toBe(400);
  expect((await forgedPrice.json() as {error:string}).error).toBe('insufficient_earned_coins');

  const bought=await page.request.post('/api/progression/items',{data:{kind:'title',id:'swift'}});
  expect(bought.ok()).toBeTruthy();
  expect(await bought.json()).toMatchObject({
    profile:{coins:10,xp:0,races:0,owned:['title:swift']}
  });
  const duplicate=await page.request.post('/api/progression/items',{data:{kind:'title',id:'swift'}});
  expect(duplicate.status()).toBe(409);
  await page.reload();
  await expect(page.getByTestId('online-progress')).toContainText('10');
  const persisted=await (await page.request.get('/api/progression')).json();
  expect(persisted).toMatchObject({coins:10,owned:['title:swift']});
});
test('logout isolates server-earned inventory and does not leak prior session balance',async({page})=>{
  await page.goto('/profile');
  await expect(page.getByTestId('online-progress')).toContainText('СЕРВЕРТ ХАДГАЛАГДСАН');
  const purchased=await page.request.post('/api/progression/items',{data:{kind:'title',id:'swift'}});
  expect(purchased.ok()).toBeTruthy();
  const old=await (await page.request.get('/api/account')).json() as {player:{id:string}};
  const out=await page.request.post('/api/auth/logout');
  expect(out.ok()).toBeTruthy();
  const next=await (await page.request.get('/api/account')).json() as {player:{id:string}};
  expect(next.player.id).not.toBe(old.player.id);
  const fresh=await (await page.request.get('/api/progression')).json();
  expect(fresh).toMatchObject({coins:200,owned:[],xp:0,races:0});
});

test('Shop UI purchases a cosmetic using server-earned coins without refreshing the page',async({page})=>{
  await page.goto('/shop');
  await expect(page.locator('.coin-counter')).toContainText('СЕРВЕРИЙН УРАЛДААНЫ ЗООС');
  const card=page.locator('.shop-item-grid article').filter({hasText:'Түргэн хуруу'}).first();
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'◈ ХУДАЛДАН АВАХ'}).click();
  await expect(page.locator('.coin-counter')).toContainText('10');
  await expect(card.getByRole('button',{name:'Машинд суух / Зүүх'})).toBeVisible();
  await card.getByRole('button',{name:'Машинд суух / Зүүх'}).click();
  await expect(card.getByRole('button',{name:'✓ Сонгосон'})).toBeDisabled();
  await page.reload();
  await expect(page.locator('.coin-counter')).toContainText('10');
  await expect(card.getByRole('button',{name:'✓ Сонгосон'})).toBeDisabled();
  const equipped=await (await page.request.get('/api/progression')).json();
  expect(equipped).toMatchObject({equipped:{title:'swift'},owned:['title:swift']});
});

test('online daily-quest claim is rejected until actual completed server races exist',async({page})=>{
  await page.goto('/profile');
  await expect(page.getByTestId('online-progress')).toContainText('СЕРВЕРТ ХАДГАЛАГДСАН');
  const before=await (await page.request.get('/api/progression')).json() as {coins:number};
  const unearned=await page.request.post('/api/progression/quests/claim',{data:{id:'first-finish',coins:9999}});
  expect(unearned.status()).toBe(400);
  expect(await unearned.json()).toMatchObject({error:'not_complete'});
  const unknown=await page.request.post('/api/progression/quests/claim',{data:{id:'not-a-real-goal'}});
  expect(unknown.status()).toBe(400);
  expect(await unknown.json()).toMatchObject({error:'invalid_quest'});
  const after=await (await page.request.get('/api/progression')).json() as {coins:number};
  expect(after.coins).toBe(before.coins);
});
