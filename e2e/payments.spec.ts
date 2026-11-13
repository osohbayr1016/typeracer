import { test, expect } from '@playwright/test';

test('coin button opens a real payment page and honestly reports unconfigured local credentials', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /цэнэглэсэн зоос.*тоглож олсон зоос.*Цэнэглэх/i }).click();
  await expect(page).toHaveURL(/\/coins$/);
  await expect(page.getByRole('heading', { name: 'ЗООС ЦЭНЭГЛЭХ.' })).toBeVisible();
  await page.getByText('100 ₮-ийн холболтын туршилт', {exact:true}).click();
  await expect(page.getByRole('button', { name: '100 ₮ · ТӨЛӨХ →' })).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveText('Төлбөрийн холболт хараахан бэлэн болоогүй байна.');
});

test('store shows clear coin prices, one-time supporter perks and a recovery requirement',async({page})=>{
  await page.route('**/api/payments/config',route=>route.fulfill({json:{ready:true}}));
  await page.goto('/coins');
  const first=page.locator('[data-product-id="coins-200"]');
  await expect(first).toContainText('200 зоос');
  await expect(first.getByRole('button')).toBeDisabled();
  await expect(page.locator('[data-product-id="supporter"]')).toContainText('Автомат сунгалтгүй');
  await page.getByRole('button',{name:'СЭРГЭЭХ КОД ҮҮСГЭХ',exact:true}).click();
  const code=page.getByRole('textbox',{name:'Миний сэргээх код'});
  await expect(code).toHaveValue(/^trr_[a-f0-9]{48}$/);
  await page.getByRole('checkbox',{name:'Кодоо аюулгүй газар хадгалсан'}).check();
  await page.getByRole('button',{name:'ҮРГЭЛЖЛҮҮЛЭХ →',exact:true}).click();
  await expect(first.getByRole('button')).toBeEnabled();
  for(const width of [360,760,1440]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  }
});

test('recovery restores the same account in a separate browser session',async({browser})=>{
  const first=await browser.newContext();const second=await browser.newContext();
  try{
    const owner=await first.newPage();await owner.goto('/profile');
    await expect(owner.getByRole('button',{name:'СЭРГЭЭХ КОД ҮҮСГЭХ',exact:true})).toBeVisible();
    const before=await (await first.request.get('/api/account')).json();
    await owner.getByRole('button',{name:'СЭРГЭЭХ КОД ҮҮСГЭХ',exact:true}).click();
    const code=await owner.getByRole('textbox',{name:'Миний сэргээх код'}).inputValue();
    const restored=await second.newPage();await restored.goto('/profile');
    await restored.getByText('Өмнөх бүртгэлээ сэргээх',{exact:true}).click();
    await restored.getByLabel('Бүртгэл сэргээх код',{exact:true}).fill(code);
    await restored.getByRole('button',{name:'БҮРТГЭЛ СЭРГЭЭХ',exact:true}).click();
    await expect.poll(async()=> (await (await second.request.get('/api/account')).json()).player.id).toBe(before.player.id);
  }finally{await first.close();await second.close();}
});

test('returning from checkout verifies an order instead of trusting the success URL', async ({page}) => {
  await page.route('**/api/payments/config', route => route.fulfill({ json: {ready:true} }));
  await page.route('**/api/payments/wallet', route => route.fulfill({ json: {balance:0,owned:[],recent:[]} }));
  await page.route('**/api/payments/orders/*', route => route.fulfill({ json: {
    credited:false,status:'requires_action',coins:10,wallet:{balance:0,owned:[],recent:[]}
  } }));
  await page.goto('/coins?order=unpaid-order');
  await expect(page.getByRole('status')).toHaveText('Төлбөрийн баталгаажуулалтыг хүлээж байна…');
  await expect(page.locator('.coins-balance strong')).toHaveText('◈ 0');
});


test('a purchased-coin buyer can buy and equip a car directly from its preview',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('racer.profile.v1',JSON.stringify({xp:0,coins:0,owned:[]})));
  await page.route('**/api/payments/wallet',route=>route.fulfill({json:{balance:500,owned:[],recent:[],recoveryReady:true}}));
  await page.route('**/api/payments/items',async route=>{
    expect(route.request().postDataJSON()).toEqual({itemKey:'car:falcon'});
    await route.fulfill({json:{balance:200,owned:['car:falcon'],recent:[],recoveryReady:true}});
  });
  await page.goto('/shop');
  await page.getByRole('button',{name:'Шонхор GT машиныг томоор харах',exact:true}).click();
  const preview=page.getByTestId('shop-car-preview');
  await preview.getByRole('button',{name:'ЦЭНЭГЛЭСЭН ◈ 300 ЗООСООР АВАХ',exact:true}).click();
  await expect(page.locator('.paid-shop-balance')).toContainText('200');
  await preview.getByRole('button',{name:'Машинд суух / Зүүх',exact:true}).click();
  await expect(preview.getByRole('button',{name:'✓ Сонгосон',exact:true})).toBeDisabled();
});
