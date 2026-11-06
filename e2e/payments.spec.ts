import { test, expect } from '@playwright/test';

test('coin button opens a real payment page and honestly reports unconfigured local credentials', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /зоос · Зоос цэнэглэх/ }).click();
  await expect(page).toHaveURL(/\/coins$/);
  await expect(page.getByRole('heading', { name: 'ЗООС ЦЭНЭГЛЭХ.' })).toBeVisible();
  await expect(page.getByRole('button', { name: '100 ₮ · ТӨЛӨХ →' })).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveText('Төлбөрийн холболт хараахан бэлэн болоогүй байна.');
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
