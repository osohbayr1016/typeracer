import {expect,test} from '@playwright/test';

test('room quota error explains when to retry without creating a ghost lobby',async({page})=>{
  await page.route('**/api/rooms',route=>route.fulfill({
    status:429,headers:{'Retry-After':'42','Content-Type':'application/json'},
    json:{error:'rate_limit_exceeded'}
  }));
  await page.goto('/multiplayer');
  await page.getByRole('button',{name:/ӨРӨӨ ҮҮСГЭХ/}).click();
  await expect(page.getByRole('alert')).toContainText('42 секундын дараа');
  await expect(page.locator('.room-info strong')).toHaveCount(0);
  await expect(page).toHaveURL(/\/multiplayer$/);
});

test('shared coordinator unavailability fails closed with a helpful retry message',async({page})=>{
  await page.route('**/api/rooms',route=>route.fulfill({
    status:503,json:{error:'room_service_unavailable'}
  }));
  await page.goto('/multiplayer');
  await page.getByRole('button',{name:/ӨРӨӨ ҮҮСГЭХ/}).click();
  await expect(page.getByRole('alert')).toContainText('Өрөөний сервер түр боломжгүй');
  await expect(page.locator('.room-info strong')).toHaveCount(0);
});
