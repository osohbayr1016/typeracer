import { test, expect } from '@playwright/test';

test('main Play starts live matchmaking, adds bots and awards a finished match', async ({ page }) => {
  await page.goto('/');
  await page.locator('.home-hero').getByRole('button', { name: /ТОГЛОХ/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.locator('.play-start-button').click();
  await expect(page).toHaveURL(/\/quick-race$/);
  await expect(page.getByTestId('quick-race')).toBeVisible();
  await expect(page.locator('.quick-lane')).toHaveCount(4, { timeout: 12000 });
  await expect(page.locator('.quick-lane').filter({ hasText: 'БОТ УРАЛДАГЧ' })).toHaveCount(3);
  const input = page.getByRole('textbox', { name: 'Шууд уралдааны бичих талбар' });
  await expect(input).toBeEditable({ timeout: 13000 });
  const prompt = (await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g, ' ').trim();
  expect(prompt).toMatch(/[ӨөҮү]/);
  await input.pressSequentially(prompt, { delay: 44 });
  await expect(page.locator('.quick-result-panel')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.quick-result-score')).toContainText('120');
  await page.getByRole('button', { name: /ДАХИН УРАЛДАХ/ }).click();
  await expect(page.locator('.quick-result-panel')).toHaveCount(0);
  await expect(page.locator('.quick-lane')).toHaveCount(4, { timeout: 12000 });
});
test('two real browsers create a waiting lobby, join, ready and race live', async ({ browser }) => {
  const creator = await browser.newPage();
  const joiner = await browser.newPage();
  try {
    await Promise.all([creator.goto('http://127.0.0.1:5173/multiplayer'), joiner.goto('http://127.0.0.1:5173/multiplayer')]);
    await creator.getByRole('button', { name: /ӨРӨӨ ҮҮСГЭХ/ }).click();
    const codeNode = creator.locator('.room-info strong');
    await expect(codeNode).toBeVisible();
    const code = await codeNode.innerText();
    expect(code).toMatch(/^[A-F0-9]{8}$/);
    await expect(creator.locator('.lobby-player')).toHaveCount(2); // one racer + one empty invite slot
    await expect(creator.getByRole('button', { name: /НАЙЗАА ХҮЛЭЭЖ БАЙНА/ })).toBeDisabled();

    await joiner.goto('http://127.0.0.1:5173/garage');
    await joiner.getByRole('button', { name: /Цэнхэр салхи/ }).click();
    await joiner.goto('http://127.0.0.1:5173/multiplayer');
    await joiner.getByRole('textbox', { name: 'Өрөөний код' }).fill(code);
    await joiner.getByRole('button', { name: /НЭВТРЭХ/ }).click();
    await expect(creator.locator('.lobby-player:not(.empty)')).toHaveCount(2);
    await expect(joiner.locator('.lobby-player:not(.empty)')).toHaveCount(2);
    await creator.getByRole('button', { name: /БЭЛЭН/ }).click();
    await joiner.getByRole('button', { name: /БЭЛЭН/ }).click();
    await expect(creator).toHaveURL(/\/multiplayer\/race$/);
    await expect(joiner).toHaveURL(/\/multiplayer\/race$/);
    await expect(creator.locator('.multiplayer-track .lane')).toHaveCount(2);
    await expect(creator.locator('.multiplayer-track .lane').nth(1).locator('.lane-car'))
      .toHaveAttribute('src', '/cars/blue-sprint.svg');

    const input = creator.getByRole('textbox', { name: 'Онлайн уралдааны бичих хэсэг' });
    await expect(input).toBeEditable({ timeout: 12_000 });
    const prompt = (await creator.locator('.online-type .phrase').innerText()).replace(/\u00a0/g, ' ').trim();
    await input.pressSequentially(prompt.slice(0, 5), { delay: 10 });
    await expect(creator.locator('.online-type .typing-label')).toContainText('5 /');
  } finally {
    await Promise.allSettled([creator.close(), joiner.close()]);
  }
});

test('mobile equipped vehicle appears in live public matchmaking', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/garage');
  const car = page.getByRole('button', { name: /Цэнхэр салхи/ });
  await car.click();
  await expect(car).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /ЭНЭ МАШИНААР УРАЛДАХ/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.locator('.play-start-button').click();
  await expect(page).toHaveURL(/\/quick-race$/);
  await expect(page.locator('.quick-lane.me .quick-road img')).toHaveAttribute('src', '/cars/blue-sprint.svg',{timeout:12000});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
test('invitation links, history and deep-link pages resolve correctly', async ({ page }) => {
  await page.goto('/multiplayer?room=ABCDEF12');
  await expect(page.getByRole('textbox', { name: 'Өрөөний код' })).toHaveValue('ABCDEF12');
  await page.goto('/');
  await page.getByRole('button', { name: 'Гараж', exact: true }).click();
  await expect(page).toHaveURL(/\/garage$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /ХУРДАН БИЧ/ })).toBeVisible();
  await page.goto('/play');
  await expect(page.getByRole('heading', { name: /УРАЛДАХАД/ })).toBeVisible();
});

test('solo opponents are labelled practice pace ghosts, garage progression is not fake multiplayer', async ({ page }) => {
  await page.goto('/race');
  await expect(page.locator('.track-wrap .lane')).toHaveCount(3);
  await expect(page.getByText('ЗОРИЛТОТ ХУРД · БОДИТ ТОГЛОГЧ БИШ')).toHaveCount(2);
  await page.goto('/garage');
  await expect(page.getByRole('button', { name: /Ногоон оч/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Сүүдэр/ })).toBeDisabled();
  await expect(page.locator('.garage-page-grid .garage-car-tile')).toHaveCount(11);
});

test('Монгол дэлгүүр: зоосоор мөр авч, гаражид зүүж, шинэчлэхэд хадгална', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: /ТОГЛООМЫН ДЭЛГҮҮР/ })).toBeVisible();
  await expect(page.locator('.coin-counter strong')).toContainText('200');
  await page.getByRole('button', { name: 'Мөр', exact: true }).click();
  const ember = page.locator('.item-card').filter({ has: page.getByRole('heading', { name: 'Галын мөр' }) });
  await ember.getByRole('button', { name: 'Худалдан авах' }).click();
  await expect(page.locator('.coin-counter strong')).toContainText('80');
  await ember.getByRole('button', { name: 'Зүүх' }).click();
  await page.goto('/garage');
  await page.getByRole('button', { name: 'Гэрлийн мөр' }).click();
  await expect(page.getByRole('button', { name: /Галын мөр/ })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('.garage-preview-car')).toHaveClass(/trail-ember/);
  await page.goto('/shop');
  await expect(page.locator('.coin-counter strong')).toContainText('80');
});

test('public multiplayer finish credits season XP once and supports a one-time season claim', async ({ page }) => {
  await page.goto('/play');
  await page.locator('.play-start-button').click();
  const input = page.getByRole('textbox', { name: 'Шууд уралдааны бичих талбар' });
  await expect(input).toBeEditable({ timeout: 13000 });
  const prompt = (await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g,' ').trim();
  await input.pressSequentially(prompt, { delay: 44 });
  await expect(page.locator('.quick-result-panel')).toBeVisible({timeout:15000});
  await page.goto('/season');
  const firstTier = page.locator('.season-tier').first();
  await expect(firstTier.getByRole('button', { name: 'Шагнал авах' })).toBeEnabled();
  await firstTier.getByRole('button', { name: 'Шагнал авах' }).click();
  await expect(firstTier.getByRole('button', { name: /Авсан/ })).toBeDisabled();
  await page.reload();
  await expect(firstTier.getByRole('button', { name: /Авсан/ })).toBeDisabled();
});
test('Зургаан анхны тусгай машины зураг ажиллаж байна', async ({ request, page }) => {
  await page.goto('/garage');
  for (const name of ['steppe','thunder','midnight','khan','dawn','cosmic']) {
    const response = await request.get('/cars/' + name + '.svg');
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).toContain('<svg');
  }
  await expect(page.locator('.garage-page-grid .garage-car-tile')).toHaveCount(11);
});

test('Ө Ү typography uses Cyrillic-safe display, body and typing fonts without clipping', async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    for (const route of ['/shop', '/play', '/season', '/garage']) {
      await page.goto(route);
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible();
      const displayFamily = await heading.evaluate(el => getComputedStyle(el).fontFamily);
      expect(displayFamily).toContain('Roboto Condensed');
      const { documentWidth, windowWidth } = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        windowWidth: innerWidth
      }));
      expect(documentWidth, route + ' at ' + width + 'px should not overflow').toBeLessThanOrEqual(windowWidth + 1);
    }
  }
  await page.goto('/race');
  const typingFamily = await page.locator('.phrase').first().evaluate(el => getComputedStyle(el).fontFamily);
  expect(typingFamily).toContain('Roboto Mono');
  await page.goto('/shop');
  await expect(page.locator('h1').first()).toContainText('Ү');
});

test('Play presents live matchmaking rather than a solo practice choice', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByRole('heading', { name: /УРАЛДАХАД БЭЛЭН ҮҮ/ })).toBeVisible();
  await expect(page.locator('.play-start-button')).toContainText('УРАЛДААНД ОРОХ');
  await expect(page.locator('.play-friends-button')).toHaveCount(1);
  await expect(page.locator('.play-quick-payout')).toContainText('120');
  await expect(page.getByText('ГАНЦААРАА ЭХЛЭХ')).toHaveCount(0);
  await page.locator('.play-start-button').click();
  await expect(page).toHaveURL(/\/quick-race$/);
  await expect(page.getByTestId('quick-race')).toBeVisible();
});
test('play page friend path opens the real lobby; equipped car appears in play preview', async ({ page }) => {
  await page.goto('/garage');
  await page.getByRole('button', { name: /Цэнхэр салхи/ }).click();
  await page.goto('/play');
  await expect(page.locator('.play-preview-lane-you img')).toHaveAttribute('src', '/cars/blue-sprint.svg');
  await expect(page.locator('.play-preview-bottom')).toContainText('Цэнхэр салхи');
  await page.locator('.play-preview-bottom button').click();
  await expect(page).toHaveURL(/\/garage$/);
  await page.goto('/play');
  await page.locator('.play-friends-button').click();
  await expect(page).toHaveURL(/\/multiplayer$/);
  await expect(page.getByRole('button', { name: /ӨРӨӨ ҮҮСГЭХ/ })).toBeVisible();
});

test('play page has safe Cyrillic headings and accessible primary CTA at phone, tablet and desktop sizes', async ({ page }) => {
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/play');
    const primary = page.locator('.play-start-button');
    await expect(primary).toBeVisible();
    await expect(primary).toBeInViewport({ ratio: 0.5 });
    const heading = page.locator('.play-entry-heading h1');
    await expect(heading).toBeVisible();
    const font = await heading.evaluate(el => getComputedStyle(el).fontFamily);
    expect(font).toContain('Roboto Condensed');
    const measurements = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      windowWidth: window.innerWidth,
      buttonHeight: document.querySelector('.play-start-button')!.getBoundingClientRect().height
    }));
    expect(measurements.documentWidth).toBeLessThanOrEqual(measurements.windowWidth + 1);
    expect(measurements.buttonHeight).toBeGreaterThanOrEqual(44);
  }
});

test('removed both the startup loader and animated page wipes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('race-boot')).toHaveCount(0);
  await page.getByRole('button', { name: 'Гараж', exact: true }).click();
  await expect(page).toHaveURL(/\/garage$/);
  await expect(page.getByTestId('race-route-motion')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('race-route-motion')).toHaveCount(0);
  await expect(page.locator('main')).not.toHaveClass(/route-page-enter/);
});
test('normal navigation stays instant and no vehicle wipe returns on browser history', async ({ page }) => {
  await page.goto('/garage');
  await page.getByRole('button', { name: /Цэнхэр салхи/ }).click();
  await page.getByRole('button', { name: 'Тоглох', exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.locator('.play-preview-lane-you img')).toHaveAttribute('src','/cars/blue-sprint.svg');
  await page.getByRole('button', { name: 'Дэлгүүр', exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByTestId('race-route-motion')).toHaveCount(0);
});
test('reduced motion still supports live public Play without loading animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('race-boot')).toHaveCount(0);
  await page.getByRole('button', { name: 'Тоглох', exact: true }).click();
  await page.locator('.play-start-button').click();
  await expect(page).toHaveURL(/\/quick-race$/);
  await expect(page.getByTestId('race-route-motion')).toHaveCount(0);
  await expect(page.locator('.quick-lane')).toHaveCount(4,{timeout:12000});
});


test('two humans share public queue, see real players plus bots, and receive server progress', async ({ browser }) => {
  const first = await browser.newPage();
  const second = await browser.newPage();
  try {
    await Promise.all([first.goto('http://127.0.0.1:5173/quick-race'),
      second.goto('http://127.0.0.1:5173/quick-race')]);
    await expect(first.locator('.quick-lane')).toHaveCount(4,{timeout:13000});
    await expect(second.locator('.quick-lane')).toHaveCount(4,{timeout:13000});
    await expect(first.locator('.quick-lane').filter({hasText:'БОТ УРАЛДАГЧ'})).toHaveCount(2);
    await expect(first.locator('.quick-lane').filter({hasText:'БОДИТ ТОГЛОГЧ'})).toHaveCount(2);
    const input = first.getByRole('textbox',{name:'Шууд уралдааны бичих талбар'});
    await expect(input).toBeEditable({timeout:12000});
    const prompt=(await first.locator('.quick-phrase').innerText()).replace(/\u00a0/g,' ').trim();
    await input.pressSequentially(prompt.slice(0,5),{delay:45});
    await expect(second.locator('.quick-lane').filter({hasText:'БОДИТ ТОГЛОГЧ'}).first()).toContainText(/\d+%/, {timeout:5000});
    await expect(first.getByTestId('race-boot')).toHaveCount(0);
  } finally { await Promise.allSettled([first.close(), second.close()]); }
});
