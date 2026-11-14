import {expect,test} from '@playwright/test';

test('online quick race explains an unauthorized locally owned legendary car', async ({page}) => {
  await page.addInitScript(() => {
    // A browser can modify local practice inventory, but cannot grant itself a
    // server-owned legendary car in multiplayer.
    localStorage.setItem('racer.profile.v1', JSON.stringify({
      xp:99999,coins:99999,races:100,seasonXp:0,claimed:[],
      owned:['car:dragon'],car:'dragon',trail:'none',title:'rookie',
      sticker:'none',history:[],questClaims:[]
    }));
  });
  await page.goto('/quick-race');
  await expect(page.locator('.quick-lane.me')).toBeVisible({timeout:12000});
  await expect(page.getByTestId('quick-appearance-warning')).toBeVisible();
  await expect(page.locator('.quick-lane.me .quick-car-sprite img'))
    .toHaveAttribute('src','/cars/race/sunset.webp');
});
