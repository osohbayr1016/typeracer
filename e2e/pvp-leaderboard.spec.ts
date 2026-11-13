import { expect, test } from '@playwright/test';

test('weekly leaderboard transparently separates human-v-human races from casual bot-filled races',async({page})=>{
  await page.goto('/leaderboard');
  const pvp=page.getByRole('button',{name:'ХҮН VS ХҮН · BETA'});
  await expect(pvp).toBeVisible();
  const response=page.waitForResponse(value=>value.url().includes('/api/leaderboard?') &&
    value.url().includes('mode=pvp'));
  await pvp.click();
  const result=await response;
  expect(result.ok()).toBe(true);
  const payload=await result.json() as {mode:string;total:number;players:unknown[]};
  expect(payload.mode).toBe('pvp');
  expect(payload.total).toBeGreaterThanOrEqual(0);
  expect(Array.isArray(payload.players)).toBe(true);
  await expect(pvp).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('heading',{name:/ХҮН VS ХҮН/})).toBeVisible();
  await page.getByRole('button',{name:'БҮХ УРАЛДААН'}).click();
  await expect(pvp).toHaveAttribute('aria-pressed','false');
});
