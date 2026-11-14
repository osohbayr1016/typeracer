import {expect,test} from '@playwright/test';

test('Shop preview traps keyboard focus and restores the opener on Escape',async({page})=>{
  await page.goto('/shop');
  const opener=page.locator('.shop-collectible .shop-inspect-button').first();
  await opener.focus();
  await opener.press('Enter');
  const dialog=page.getByTestId('shop-car-preview');
  await expect(dialog).toBeVisible();
  const close=dialog.locator('.shop-preview-close');
  await expect(close).toBeFocused();
  const last=dialog.locator('button:not([disabled])').last();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('Shop preview restores page scrolling after it closes',async({page})=>{
  await page.goto('/shop');
  const opener=page.locator('.shop-collectible .shop-inspect-button').first();
  await opener.click();
  await expect(page.getByTestId('shop-car-preview')).toBeVisible();
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
  await page.getByTestId('shop-car-preview').locator('.shop-preview-close').click();
  await expect(page.getByTestId('shop-car-preview')).toHaveCount(0);
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
});
