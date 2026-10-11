test('start lights do not enable typing until the server starts the race', async ({page}) => {
  await page.goto('/quick-race');
  await expect(page.getByTestId('quick-phase')).toHaveAttribute('data-phase', 'countdown', {timeout:11000});
  await expect(page.getByTestId('race-start-lights')).toHaveAttribute('data-signal', /red|yellow/);
  const geometry = await page.locator('.quick-start-lights').boundingBox();
  const track = await page.locator('.quick-track').boundingBox();
  expect(geometry).not.toBeNull();expect(track).not.toBeNull();
  expect(Math.abs((geometry!.x+geometry!.width/2)-(track!.x+track!.width/2))).toBeLessThan(7);
  await expect(page.locator('.quick-type-input')).toBeDisabled();
  await expect(page.getByTestId('quick-phase')).toHaveAttribute('data-phase','racing',{timeout:10000});
  await expect(page.locator('.quick-type-input')).toBeEditable();
});

test('server-synced car reaches the checkered finish marker instead of stopping at 71 percent', async ({ page }) => {
  await page.goto('/quick-race');
  const input = page.getByRole('textbox',{name:'Шууд уралдааны бичих талбар'});
  await expect(input).toBeEditable({timeout:14000});
  const prompt = (await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g,' ').trim();
  // Stay one character short so the live track remains mounted for geometry QA.
  await input.pressSequentially(prompt.slice(0,-1),{delay:44});
  await expect.poll(async () => Number((await page.locator('.quick-lane.me .quick-lane-meta b')
    .innerText()).replace('%','')),{timeout:5000}).toBeGreaterThan(90);
  // Let the short easing finish, then inspect actual browser layout rather than only CSS strings.
  await page.waitForTimeout(260);
  const geometry = await page.evaluate(() => {
    const road = document.querySelector('.quick-lane.me .quick-road')!;
    const car = road.querySelector('img')!.getBoundingClientRect();
    const flag = road.querySelector('.quick-flag')!.getBoundingClientRect();
    return {bumper:car.right,marker:flag.left,finish:flag.right};
  });
  expect(geometry.bumper,'Car front must reach checkerboard').toBeGreaterThan(geometry.marker-22);
  expect(geometry.bumper,'Car must not overshoot beyond checkerboard').toBeLessThan(geometry.finish+8);
});

import { test, expect } from '@playwright/test';

test('main Play starts live matchmaking, adds bots and awards a finished match', async ({ page }) => {
  await page.goto('/');
  await page.locator('.home-hero').getByRole('button', { name: /ТОГЛОХ/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.locator('.play-choice-primary').click();
  await expect(page).toHaveURL(/\/quick-race$/);
  await expect(page.getByTestId('quick-race')).toBeVisible();
  await expect(page.locator('.quick-phrase')).toBeVisible();
  await expect(page.locator('.quick-type-input')).toBeDisabled();
  await expect(page.locator('.quick-lane')).toHaveCount(5, { timeout: 12000 });
  await expect(page.locator('.quick-lane').filter({ hasText: 'БОТ' })).toHaveCount(4);
  const input = page.getByRole('textbox', { name: 'Шууд уралдааны бичих талбар' });
  await expect(input).toBeEditable({ timeout: 13000 });
  const prompt = (await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g, ' ').trim();
  expect(prompt).toMatch(/[ӨөҮү]/);
  await input.pressSequentially(prompt, { delay: 44 });
  await expect(page.locator('.qr-results')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.qr-earned')).toContainText('120');
  await expect(page).toHaveURL(/\/quick-results$/);
  await expect(page.getByRole('heading',{name:/УРАЛДАГЧДЫН БАЙРЛАЛ/})).toBeVisible();
  await page.getByRole('button', { name: /ДАХИН УРАЛДАХ/ }).click();
  await expect(page.locator('.qr-results')).toHaveCount(0);
  await expect(page.locator('.quick-lane')).toHaveCount(5, { timeout: 12000 });
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
  await page.locator('.play-choice-primary').click();
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
  await expect(page.getByRole('heading', { name: 'ТОГЛОХ' })).toBeVisible();
});

test('solo opponents are labelled practice pace ghosts, garage progression is not fake multiplayer', async ({ page }) => {
  await page.goto('/race');
  await expect(page.locator('.track-wrap .lane')).toHaveCount(3);
  await expect(page.getByText('ЗОРИЛТОТ ХУРД · БОДИТ ТОГЛОГЧ БИШ')).toHaveCount(2);
  await page.goto('/garage');
  await expect(page.getByRole('button', { name: /Ногоон оч/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Сүүдэр/ })).toBeDisabled();
  await expect(page.locator('.garage-page-grid .garage-car-tile')).toHaveCount(29);
});

test('Монгол дэлгүүр: зоосоор мөр авч, гаражид зүүж, шинэчлэхэд хадгална', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: /ХҮЛГИЙН ЦУГЛУУЛГА/ })).toBeVisible();
  await expect(page.locator('.coin-counter strong')).toContainText('200');
  await page.getByRole('button', { name: 'Мөр', exact: true }).click();
  const ember = page.locator('.item-card').filter({ has: page.getByRole('heading', { name: 'Галын мөр' }) });
  await ember.getByRole('button', { name: /ХУДАЛДАН АВАХ/i }).click();
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
  await page.locator('.play-choice-primary').click();
  const input = page.getByRole('textbox', { name: 'Шууд уралдааны бичих талбар' });
  await expect(input).toBeEditable({ timeout: 13000 });
  const prompt = (await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g,' ').trim();
  await input.pressSequentially(prompt, { delay: 44 });
  await expect(page.locator('.qr-results')).toBeVisible({timeout:15000});
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
  await expect(page.locator('.garage-page-grid .garage-car-tile')).toHaveCount(29);
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
  await expect(page.getByRole('heading', { name: 'ТОГЛОХ' })).toBeVisible();
  await expect(page.locator('.play-choice-primary')).toContainText('УРАЛДАХ');
  await expect(page.locator('.play-choice-create')).toHaveCount(1);
  await expect(page.locator('.play-choice-public')).toContainText('5 УРАЛДАГЧ');
  await expect(page.getByText('ГАНЦААРАА ЭХЛЭХ')).toHaveCount(0);
  await page.locator('.play-choice-primary').click();
  await expect(page).toHaveURL(/\/quick-race$/);
  await expect(page.getByTestId('quick-race')).toBeVisible();
});
test('play page friend path opens the real lobby; equipped car appears in play preview', async ({ page }) => {
  await page.goto('/garage');
  await page.getByRole('button', { name: /Цэнхэр салхи/ }).click();
  await page.goto('/play');
  await expect(page.locator('.play-choice-public .play-choice-main-car')).toHaveAttribute('src', '/cars/blue-sprint.svg');
  await expect(page.locator('.play-choice-public .play-choice-main-car')).toHaveAttribute('alt','Цэнхэр салхи');
  await page.locator('.play-choice-bottom button').click();
  await expect(page).toHaveURL(/\/garage$/);
  await page.goto('/play');
  await page.locator('.play-choice-create').click();
  await expect(page).toHaveURL(/\/multiplayer$/);
  await expect(page.locator('.room-info strong')).toHaveText(/^[A-F0-9]{8}$/, { timeout: 10000 });
});

test('play page has safe Cyrillic headings and accessible primary CTA at phone, tablet and desktop sizes', async ({ page }) => {
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/play');
    const primary = page.locator('.play-choice-primary');
    await expect(primary).toBeVisible();
    await expect(primary).toBeInViewport({ ratio: 0.5 });
    const heading = page.locator('.play-choice-header h1');
    await expect(heading).toBeVisible();
    const font = await heading.evaluate(el => getComputedStyle(el).fontFamily);
    expect(font).toContain('Roboto Condensed');
    const measurements = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      windowWidth: window.innerWidth,
      buttonHeight: document.querySelector('.play-choice-primary')!.getBoundingClientRect().height
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
  await expect(page.locator('.play-choice-public .play-choice-main-car')).toHaveAttribute('src','/cars/blue-sprint.svg');
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
  await page.locator('.play-choice-primary').click();
  await expect(page).toHaveURL(/\/quick-race$/);
  await expect(page.getByTestId('race-route-motion')).toHaveCount(0);
  await expect(page.locator('.quick-lane')).toHaveCount(5,{timeout:12000});
});


test('two humans share public queue, see real players plus bots, and receive server progress', async ({ browser }) => {
  const first = await browser.newPage();
  const second = await browser.newPage();
  try {
    await Promise.all([first.goto('http://127.0.0.1:5173/quick-race'),
      second.goto('http://127.0.0.1:5173/quick-race')]);
    await expect(first.locator('.quick-lane')).toHaveCount(5,{timeout:12000});
    await expect(second.locator('.quick-lane')).toHaveCount(5,{timeout:12000});
    await expect(first.locator('.quick-lane').filter({hasText:'БОТ'})).toHaveCount(3);
    await expect(first.locator('.quick-lane').filter({hasText:'ТОГЛОГЧ'})).toHaveCount(2);
    const input = first.getByRole('textbox',{name:'Шууд уралдааны бичих талбар'});
    await expect(input).toBeEditable({timeout:12000});
    const prompt=(await first.locator('.quick-phrase').innerText()).replace(/\u00a0/g,' ').trim();
    await input.pressSequentially(prompt.slice(0,5),{delay:45});
    await expect(second.locator('.quick-lane').filter({hasText:'ТОГЛОГЧ'}).first()).toContainText(/\d+%/, {timeout:5000});
    await expect(first.getByTestId('race-boot')).toHaveCount(0);
  } finally { await Promise.allSettled([first.close(), second.close()]); }
});


test('four distinct bots join, with ONE start countdown after matchmaking', async ({ page }) => {
  await page.goto('/quick-race');
  await expect(page.locator('.quick-type-panel.prepare .quick-phrase')).toBeVisible();
  await expect(page.getByTestId('quick-phase')).toHaveAttribute('data-phase', 'waiting');
  await expect(page.getByTestId('race-start-lights')).toHaveCount(0);
  await expect(page.getByTestId('quick-phase')).toContainText('ТОГЛОГЧ ЦУГЛУУЛЖ БАЙНА');
  await expect(page.locator('.quick-lane')).toHaveCount(5, { timeout: 11000 });
  const bots = page.locator('.quick-lane').filter({ hasText: 'БОТ' });
  await expect(bots).toHaveCount(4);
  const names = await bots.locator('.quick-lane-meta strong').allInnerTexts();
  expect(new Set(names).size).toBe(4);
  await expect(page.getByTestId('quick-phase')).toHaveAttribute('data-phase', 'countdown', { timeout: 11000 });
  await expect(page.getByTestId('race-start-lights')).toBeVisible();
  await expect(page.getByTestId('race-start-lights')).toHaveAttribute('data-signal', /red|yellow/);
  await expect(page.locator('.quick-type-input')).toBeDisabled();
  await expect(page.getByTestId('race-start-lights')).toHaveAttribute('data-signal', 'yellow', {timeout: 3500});
  await expect(page.locator('.quick-type-panel.prepare .quick-phrase')).toBeVisible();
  await expect(page.locator('.quick-type-input')).toBeDisabled();
  await expect(page.getByTestId('quick-phase')).toHaveAttribute('data-phase', 'racing', { timeout: 13000 });
  await expect(page.locator('.quick-type-input')).toBeEditable();
});

test('all five racer positions and typing text fit desktop and phone without page scrolling', async ({ page }) => {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/quick-race');
    await expect(page.locator('.quick-lane')).toHaveCount(5, { timeout: 11000 });
    await expect(page.locator('.quick-phrase')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Шууд уралдааны бичих талбар' })).toBeVisible();
    const v = await page.evaluate(() => {
      const road = document.querySelector('.quick-track')!.getBoundingClientRect();
      const input = document.querySelector('.quick-type-input')!.getBoundingClientRect();
      const prompt = document.querySelector('.quick-phrase')!.getBoundingClientRect();
      const cars = Array.from(document.querySelectorAll('.quick-road img')).map(el => el.getBoundingClientRect().width);
      return { roadTop: road.top, roadBottom: road.bottom, promptTop: prompt.top, inputBottom: input.bottom,
        maxCarWidth: Math.max(...cars), scrollWidth: document.documentElement.scrollWidth, innerWidth, innerHeight };
    });
    expect(v.roadTop).toBeGreaterThan(0);
    expect(v.roadBottom).toBeLessThan(v.promptTop);
    expect(v.inputBottom, JSON.stringify(viewport)).toBeLessThanOrEqual(v.innerHeight + 2);
    expect(v.scrollWidth).toBeLessThanOrEqual(v.innerWidth + 1);
    expect(v.maxCarWidth).toBeLessThanOrEqual(75);
  }
});

test('typing caret updates locally and highlights mistakes without blocking input', async ({ page }) => {
  await page.goto('/quick-race');
  const input = page.getByRole('textbox', { name: 'Шууд уралдааны бичих талбар' });
  await expect(input).toBeEditable({ timeout: 14000 });
  const phrase = page.locator('.quick-phrase');
  const first = (await phrase.innerText()).replace(/\u00a0/g, ' ')[0];
  await input.pressSequentially(first, { delay: 0 });
  await expect(phrase.locator('span.typed')).toHaveCount(1, { timeout: 700 });
  await input.pressSequentially(first === 'x' ? 'z' : 'x', { delay: 0 });
  await expect(phrase.locator('span.incorrect')).toHaveCount(1);
  await expect(phrase.locator('span.typed')).toHaveCount(1);
});


test('rarity shop has six distinct tiers, 18 original vehicle assets and responsive catalog', async ({page,request}) => {
  const names = ['falcon','nomad','rover','sunflare','dune','cobalt','glacier','fox','streak',
    'ghost','onyx','meteor','temple','nebula','eagle','royal','aurora-x','dragon'];
  for (const id of names) {
    const asset = await request.get('/cars/' + id + '.svg');
    expect(asset.ok(), id).toBeTruthy();
    expect(await asset.text()).toContain('<svg');
  }
  for (const width of [390,768,1440]) {
    await page.setViewportSize({width,height:845});
    await page.goto('/shop');
    await expect(page.locator('.shop-rarity-tabs .rarity-filter')).toHaveCount(6);
    await expect(page.locator('.shop-item-grid .shop-collectible')).toHaveCount(27);
    await expect(page.locator('.shop-daily-item')).toHaveCount(3);
    const dimensions = await page.evaluate(() => ({document:document.documentElement.scrollWidth, window:innerWidth}));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.window+1);
    await page.locator('.shop-rarity-tabs .rarity-legendary').click();
    await expect(page.locator('.shop-item-grid .shop-collectible')).toHaveCount(3);
    await expect(page.locator('.shop-item-grid [data-item-id="royal"]')).toBeVisible();
    await expect(page.locator('.shop-item-grid [data-item-id="royal"] .item-action button')).toBeDisabled();
  }
});

test('collection purchase spends coins once, equips in garage and level-gates legendary cars', async ({page}) => {
  await page.goto('/shop');
  await page.evaluate(() => localStorage.setItem('racer.profile.v1', JSON.stringify({xp:0,coins:50000,owned:[]})));
  await page.reload();
  const start = page.locator('[data-item-id="falcon"]');
  await expect(start.locator('.item-action')).toContainText('300');
  await start.locator('.item-action button').click();
  await expect(start.locator('.item-action')).toContainText('ТАНЫХ');
  await expect(page.locator('.coin-counter')).toContainText('49,700');
  const legendary = page.locator('[data-item-id="dragon"]');
  await expect(legendary.locator('.item-action button')).toBeDisabled();
  await page.goto('/garage');
  await page.getByRole('button',{name:/Шонхор GT/}).click();
  await expect(page.locator('.garage-feature h2')).toContainText('Шонхор GT');
  await expect(page.locator('.garage-preview-car img')).toHaveAttribute('src','/cars/falcon.svg');
  await page.reload();
  await expect(page.locator('.garage-feature h2')).toContainText('Шонхор GT');
});

test('level 35 veteran may buy and equip a legendary car, accessible on shop and garage', async ({page}) => {
  await page.goto('/shop');
  await page.evaluate(() => localStorage.setItem('racer.profile.v1', JSON.stringify({xp:10200,coins:8000,owned:[]})));
  await page.reload();
  const dragon = page.locator('[data-item-id="dragon"]');
  await expect(dragon.locator('.item-action button')).toBeEnabled();
  await dragon.locator('.item-action button').click();
  await expect(dragon.locator('.item-action')).toContainText('ТАНЫХ');
  await dragon.locator('.item-action button').click();
  await page.goto('/garage');
  await expect(page.locator('.garage-feature h2')).toContainText('Лууны дөл');
  await expect(page.locator('.garage-preview-car')).toHaveClass(/garage-rarity-Домогт/);
});


test('battle pass presents next milestone, 8 readable rewards and original shop collection on all screens', async ({ page }) => {
  for (const width of [360, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/season');
    await expect(page.getByTestId('season-pass')).toBeVisible();
    await expect(page.getByRole('heading', { name: /ЭХНИЙ ГАРАА/ })).toBeVisible();
    await expect(page.getByTestId('season-spotlight')).toContainText('120 зоос');
    await expect(page.locator('.season-tier')).toHaveCount(8);
    await expect(page.getByRole('progressbar', { name: 'Улирлын нийт ахиц' })).toHaveAttribute('aria-valuenow', '0');
    await expect(page.getByTestId('season-claim-all')).toHaveCount(0);
    const bounds = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: innerWidth,
      buttonsTooSmall: [...document.querySelectorAll('.pass-tier button')].some(
        button => button.getBoundingClientRect().height < 40)
    }));
    expect(bounds.document, String(width)).toBeLessThanOrEqual(bounds.viewport + 1);
    expect(bounds.buttonsTooSmall).toBe(false);
  }
  await page.getByRole('button', { name: /ДЭЛГҮҮР ҮЗЭХ/ }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.locator('.shop-item-grid .shop-collectible')).toHaveCount(27);
  await expect(page.locator('[data-item-id="dragon"]')).toBeVisible();
});

test('battle pass claims all earned tiers once and keeps cars, coins and progress after reload', async ({ page }) => {
  await page.goto('/season');
  await page.evaluate(() => localStorage.setItem('racer.profile.v1',
    JSON.stringify({ xp: 1800, seasonXp: 1800, coins: 200, races: 17, claimed: [], owned: [] })));
  await page.reload();
  const claimAll = page.getByTestId('season-claim-all');
  await expect(claimAll).toContainText('7 ШАГНАЛ');
  await expect(page.locator('.season-tier.available')).toHaveCount(7);
  await expect(page.getByTestId('season-spotlight')).toContainText('120 зоос');
  await claimAll.click();
  await expect(page.locator('.season-tier.received')).toHaveCount(7);
  await expect(page.getByTestId('season-claim-all')).toHaveCount(0);
  await expect(page.locator('.season-tier.locked')).toHaveCount(1);
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('racer.profile.v1') || '{}'));
  expect(profile.coins).toBe(670);
  expect(profile.claimed).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(profile.owned).toContain('car:dawn');
  expect(profile.owned).toContain('car:khan');
  expect(profile.owned).not.toContain('car:cosmic');
  await page.reload();
  await expect(page.locator('.season-tier.received')).toHaveCount(7);
  await expect(page.getByTestId('season-spotlight')).toContainText('Оддын зам');
  await expect(page.locator('.pass-progress-card')).toContainText('500 XP');
  await page.getByRole('button', { name: /УРАЛДАЖ XP ОЛОХ/ }).click();
  await expect(page).toHaveURL(/\/play$/);
});

test('claiming one season reward preserves other available rewards and accessible claim-all action', async ({page}) => {
  await page.goto('/season');
  await page.evaluate(() => localStorage.setItem('racer.profile.v1',
    JSON.stringify({ xp: 400, seasonXp: 400, coins: 200, claimed: [], owned: [] })));
  await page.reload();
  await expect(page.locator('.season-tier.available')).toHaveCount(2);
  const first = page.locator('.season-tier').first();
  await first.getByRole('button', { name: 'Шагнал авах' }).click();
  await expect(first.getByRole('button', { name: /Авсан/ })).toBeDisabled();
  await expect(page.getByTestId('season-claim-all')).toContainText('1 ШАГНАЛ');
  await page.getByTestId('season-claim-all').click();
  await expect(page.locator('.season-tier.received')).toHaveCount(2);
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('racer.profile.v1') || '{}'));
  expect(profile.coins).toBe(320);
  expect(profile.claimed).toEqual([1, 2]);
});


test('all 18 rarity collectible cars serve their own detailed self-contained art', async ({ page, request }) => {
  const tiers = [
    ['falcon', 'nomad', 'rover'],
    ['sunflare', 'dune', 'cobalt'],
    ['glacier', 'fox', 'streak'],
    ['ghost', 'onyx', 'meteor'],
    ['temple', 'nebula', 'eagle'],
    ['royal', 'aurora-x', 'dragon']
  ];
  const uniqueBodies = new Set<string>();
  const wheelCounts = new Set<number>();
  for (const id of tiers.flat()) {
    const response = await request.get('/cars/' + id + '.svg');
    expect(response.status(), id).toBe(200);
    expect(response.headers()['content-type'], id).toMatch(/image\/svg\+xml/);
    const art = await response.text();
    expect(art, id).toContain('viewBox="0 0 680 260"');
    expect(art, id).toContain('<title>');
    expect(art, id).toContain('url(#paint)');
    expect(art, id).toContain('url(#glass)');
    expect(art.length, id).toBeGreaterThan(3000);
    expect(art, id).not.toMatch(/<(?:image|script|foreignObject)\b|(?:href|xlink:href)=["']https?:\/\//i);
    const body = art.match(/<path d="([^"]+)" fill="url\(#paint\)"/);
    expect(body, id).not.toBeNull();
    uniqueBodies.add(body![1]);
    wheelCounts.add((art.match(/<g transform="translate\(\d+ \d+\)"><circle r=/g) || []).length);
  }
  expect(uniqueBodies.size).toBe(18);
  // Cars, buggies, six-wheel rigs and hover vehicles must not share one silhouette.
  expect(wheelCounts.size).toBeGreaterThanOrEqual(3);
  await page.goto('/shop');
  await expect(page.getByTestId('shop-tier-explanation')).toContainText('МИНИЙ ТҮВШИН');
  await expect(page.getByTestId('shop-tier-explanation')).toContainText('ЗООС');
  await expect(page.locator('.shop-rarity-tabs .rarity-filter')).toHaveCount(6);
  await page.locator('.shop-rarity-tabs .rarity-legendary').click();
  await expect(page.locator('.shop-item-grid .shop-collectible')).toHaveCount(3);
  await expect.poll(async () =>
    page.locator('.shop-item-grid img').evaluateAll(images =>
      images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)
    ), { timeout: 7000 }
  ).toBe(true);
});


test('shop car viewer makes each shape easy to inspect, closes with Escape, and keeps level rules', async ({ page }) => {
  for (const size of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.goto('/shop');
    const item = page.locator('[data-item-id="nomad"]');
    await expect(item).toBeVisible();
    await item.getByRole('button', { name: 'Говийн нүүдэл машиныг томоор харах' }).click();
    const viewer = page.getByTestId('shop-car-preview');
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('Говийн нүүдэл');
    await expect(viewer).toContainText('НЭЭХ ТҮВШИН 1');
    await expect(viewer.locator('.shop-preview-stage img')).toHaveAttribute('src', '/cars/nomad.svg');
    await expect(viewer.locator('.shop-preview-stage img')).toBeVisible();
    const geometry = await page.evaluate(() => {
      const v = document.querySelector('[data-testid="shop-car-preview"]')!.getBoundingClientRect();
      return { left:v.left,right:v.right,top:v.top,bottom:v.bottom,innerWidth,innerHeight };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.innerWidth+1);
    expect(geometry.top).toBeGreaterThanOrEqual(-1);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.innerHeight+1);
    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);
  }
  // A new player cannot bypass rarity-level checks through the enlarged preview.
  await page.locator('.shop-rarity-tabs .rarity-legendary').click();
  await page.locator('[data-item-id="dragon"] .shop-inspect-button').click();
  const legendary = page.getByTestId('shop-car-preview');
  await expect(legendary).toContainText('НЭЭХ ТҮВШИН 35');
  await expect(legendary).toContainText('◈ 5,000');
  await expect(legendary.getByRole('button', { name: /ТҮВШИН 35/ })).toBeDisabled();
  await legendary.getByRole('button', { name: /УРАЛДАЖ XP, ЗООС ОЛОХ/ }).click();
  await expect(page).toHaveURL(/\/play$/);
});


test('closed and throwing public WebSockets cannot create phantom local typing', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    const target = window as typeof window & { __activeQuickSocket?: WebSocket };
    window.WebSocket = new Proxy(NativeSocket, {
      construct(ctor, args) {
        const socket = Reflect.construct(ctor, args) as WebSocket;
        if (String(args[0]).includes('/api/quickplay/ws')) target.__activeQuickSocket = socket;
        return socket;
      }
    });
  });
  await page.goto('/quick-race');
  const input = page.getByRole('textbox', { name: 'Шууд уралдааны бичих талбар' });
  await expect(input).toBeEditable({ timeout: 13_000 });
  const letter = (await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g, ' ')[0];
  await page.evaluate(() => {
    const socket = (window as typeof window & { __activeQuickSocket?: WebSocket }).__activeQuickSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('No active quick socket');
    socket.send = () => { throw new Error('Simulated send failure'); };
  });
  await input.fill(letter);
  await expect(page.locator('.quick-type-head span')).toContainText(/^0\s*\//);
  await page.evaluate(() => {
    const socket = (window as typeof window & { __activeQuickSocket?: WebSocket }).__activeQuickSocket;
    if (!socket) throw new Error('No quick socket');
    Object.defineProperty(socket, 'readyState', { configurable: true, value: WebSocket.CLOSED });
  });
  await input.fill(letter);
  await expect(page.locator('.quick-type-head span')).toContainText(/^0\s*\//);
});

test('Durable Object resumes the same public race and confirmed typing after socket loss', async ({ page }) => {
  await page.addInitScript(() => {
    type RaceDebug = {
      sockets: WebSocket[];
      welcomes: Array<{ id: string; resumeToken: string; resumed: boolean }>;
    };
    const target = window as typeof window & { __quickRaceDebug?: RaceDebug };
    const NativeWebSocket = window.WebSocket;
    target.__quickRaceDebug = { sockets: [], welcomes: [] };
    window.WebSocket = new Proxy(NativeWebSocket, {
      construct(ctor, args) {
        const socket = Reflect.construct(ctor, args) as WebSocket;
        if (!String(args[0]).includes('/api/quickplay/ws')) return socket;
        target.__quickRaceDebug!.sockets.push(socket);
        socket.addEventListener('message', event => {
          try {
            const message = JSON.parse(String(event.data));
            if (message.type === 'welcome') target.__quickRaceDebug!.welcomes.push(message);
          } catch { /* the real app owns protocol validation */ }
        });
        return socket;
      }
    });
  });
  await page.goto('/quick-race');
  const input = page.getByRole('textbox', { name: 'Шууд уралдааны бичих талбар' });
  await expect(input).toBeEditable({ timeout: 13_000 });
  const letter = (await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g, ' ')[0];
  await input.fill(letter);
  await expect(page.locator('.quick-type-head span')).toContainText(/^1\s*\//);
  // Wait for a SERVER-confirmed road position, not just the optimistic caret.
  await expect.poll(async () => Number((await page.locator('.quick-lane.me .quick-lane-meta b')
    .innerText()).replace('%', '')), { timeout: 5_000 }).toBeGreaterThan(0);
  const first = await page.evaluate(() =>
    (window as typeof window & { __quickRaceDebug: {
      welcomes: Array<{id:string;resumeToken:string;resumed:boolean}>
    }}).__quickRaceDebug.welcomes.at(-1)!);
  expect(first.resumeToken).toMatch(/^[0-9a-f-]{36}$/);
  const welcomeCountBeforeDrop = await page.evaluate(() =>
    (window as typeof window & { __quickRaceDebug: { welcomes: unknown[] } })
      .__quickRaceDebug.welcomes.length);
  await page.evaluate(() => {
    const sockets = (window as typeof window & { __quickRaceDebug: {
      sockets: WebSocket[]
    }}).__quickRaceDebug.sockets;
    const active = sockets.filter(socket => socket.readyState === WebSocket.OPEN).at(-1);
    if (!active) throw new Error('No active socket');
    // Native closing handshake through the Vite dev WS proxy can remain in
    // CLOSING state for >10 seconds. Model a sudden transport drop explicitly
    // so the client close handler fires, then verify a *real* new WS handshake
    // and authoritative Durable Object resume on the replacement connection.
    active.dispatchEvent(new CloseEvent('close', { code: 1006, wasClean: false }));
    active.close(4001, 'Simulated dropped connection');
  });
  await expect.poll(async () => JSON.stringify(await page.evaluate(() => {
    const debug = (window as typeof window & { __quickRaceDebug: {
      sockets: WebSocket[]; welcomes: unknown[]
    }}).__quickRaceDebug;
    return {
      welcomes: debug.welcomes.length,
      sockets: debug.sockets.length,
      states: debug.sockets.map(socket => socket.readyState),
      connection: document.querySelector('.quick-connection')?.textContent?.trim() || '',
      banner: document.querySelector('.quick-state-panel')?.textContent?.trim() || '',
      phase: document.querySelector('.quick-phase')?.getAttribute('data-phase'),
      resumeStored: !!window.sessionStorage.getItem('typeracer.quick.resume.v1')
    };
  })), { timeout: 10_000 }).toContain('"welcomes":' + (welcomeCountBeforeDrop + 1));
  const second = await page.evaluate(() =>
    (window as typeof window & { __quickRaceDebug: {
      welcomes: Array<{id:string;resumeToken:string;resumed:boolean}>
    }}).__quickRaceDebug.welcomes.at(-1)!);
  expect(second.id).toBe(first.id);
  expect(second.resumeToken).toBe(first.resumeToken);
  expect(second.resumed).toBe(true);
  await expect(page.locator('.quick-connection')).toContainText('ОНЛАЙН');
  await expect(page.locator('.quick-type-head span')).toContainText(/^1\s*\//);
  await expect(page.locator('.quick-lane.me')).toHaveCount(1);
});


test('play choices are compact and friends create/join can be reached without explanatory walls', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByTestId('play-choices')).toBeVisible();
  await expect(page.getByRole('heading', {name:'ТОГЛОХ'})).toBeVisible();
  await expect(page.getByText('УРАЛДАХАД БЭЛЭН ҮҮ?')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'ШУУД УРАЛДАХ'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'НАЙЗУУДТАЙГАА'})).toBeVisible();
  await expect(page.locator('.play-choice-grid > section')).toHaveCount(2);
  await expect(page.getByTestId('quick-play-button')).toBeVisible();
  await expect(page.getByTestId('create-friends-room')).toBeVisible();
  await expect(page.getByRole('button',{name:'Кодоор нэгдэх'})).toBeDisabled();
  await page.getByRole('textbox',{name:'Өрөөний код'}).fill('ab12cd34');
  await expect(page.getByRole('button',{name:'Кодоор нэгдэх'})).toBeEnabled();
});

test('profile nickname persists and profile, stats, friends, leaderboard are real routes', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.getByTestId('profile-page')).toBeVisible();
  await page.getByRole('textbox',{name:'Тоглогчийн нэр'}).fill('Өлзий');
  await page.reload();
  await expect(page.getByRole('textbox',{name:'Тоглогчийн нэр'})).toHaveValue('Өлзий');
  await page.goto('/stats');
  await expect(page.getByTestId('stats-page')).toBeVisible();
  await expect(page.getByText('Өгөгдөл алга.')).toBeVisible();
  await page.goto('/leaderboard');
  await expect(page.getByTestId('leaderboard-page')).toBeVisible();
  await page.getByRole('button',{name:'МИНИЙ РЕКОРД'}).click();
  await expect(page.getByText('Таны бүртгэсэн уралдаан алга.')).toBeVisible();
  await page.goto('/friends');
  await expect(page.getByTestId('friends-page')).toBeVisible();
  await expect(page.getByRole('button',{name:/ӨРӨӨНД НЭГДЭХ/})).toBeDisabled();
  await page.getByRole('textbox',{name:'Найзын өрөөний код'}).fill('ABCDEF12');
  await expect(page.getByRole('button',{name:/ӨРӨӨНД НЭГДЭХ/})).toBeEnabled();
});

test('completed quickplay opens post-race standings and claims daily goals only once', async ({ page }) => {
  await page.goto('/quick-race');
  const input = page.getByRole('textbox',{name:'Шууд уралдааны бичих талбар'});
  await expect(input).toBeEditable({timeout:13000});
  const prompt = (await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g,' ').trim();
  await input.pressSequentially(prompt,{delay:44});
  await expect(page).toHaveURL(/\/quick-results$/,{timeout:15000});
  await expect(page.getByTestId('quick-results')).toBeVisible();
  await expect(page.locator('.qr-standings li')).toHaveCount(5);
  await expect(page.locator('.qr-standing.own')).toContainText('ТА');
  await expect(page.locator('.qr-earned')).toContainText('120');
  await expect(page.locator('.qr-pass-panel')).toBeVisible();
  await expect(page.locator('.qr-stats-panel')).toBeVisible();
  const claim = page.locator('[data-quest-id="first-finish"] button');
  await expect(claim).toBeEnabled();
  const before = await page.locator('.profile-name small').innerText();
  await claim.click();
  await expect(claim).toBeDisabled();
  await expect(claim).toContainText('АВСАН');
  const after = await page.locator('.profile-name small').innerText();
  expect(after).not.toBe(before);
  await page.getByRole('button',{name:'НҮҮР ХУУДАС'}).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/profile');
  await expect(page.locator('.social-stats-row')).toBeVisible();
});

test('mobile post-race styles and social pages avoid horizontal overflow', async ({ page }) => {
  for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:850});
    for(const route of ['/play','/profile','/leaderboard','/stats','/friends','/quick-results']){
      await page.goto(route);
      const overshoot = await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      expect(overshoot,route+' at '+width+'px').toBeLessThanOrEqual(1);
    }
  }
});

test('guest racing contributes authenticated-by-cookie server points to ALL players leaderboard, never bots', async ({ page, request }) => {
  await page.goto('/quick-race');
  const input=page.getByRole('textbox',{name:'Шууд уралдааны бичих талбар'});
  await expect(input).toBeEditable({timeout:14000});
  const prompt=(await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g,' ').trim();
  await input.pressSequentially(prompt,{delay:82});
  await expect(page).toHaveURL(/\/quick-results$/,{timeout:15000});
  const response=await page.request.get('/api/leaderboard?limit=20&offset=0');
  expect(response.status()).toBe(200);
  const data=await response.json() as {players:Array<{rank:number;name:string;points:number;races:number;wpm:number;accuracy:number;guest:boolean}>};
  expect(data.players.length).toBeGreaterThan(0);
  const own=data.players.find(p=>p.name.includes('Зочин'));
  expect(own).toBeDefined();
  expect(own!.points).toBeGreaterThan(0);
  expect(own!.races).toBeGreaterThanOrEqual(1);
  expect(own!.accuracy).toBeGreaterThanOrEqual(70);
  // All public quickmatch bots have distinctive names and MUST NOT appear as accounts.
  expect(data.players.some(p=>p.name==='Талын аянга')).toBe(false);
  await page.goto('/leaderboard');
  await expect(page.getByTestId('global-points-table')).toContainText(own!.name);
  await expect(page.getByTestId('global-points-table')).toContainText(String(own!.points));
});

test('team create, invite-only join and member roster persist in SQLite DO across distinct browsers', async ({ browser }) => {
  const captain=await browser.newPage();
  const teammate=await browser.newPage();
  try {
    await captain.goto('http://127.0.0.1:5173/teams');
    await expect(captain.getByTestId('teams-page')).toBeVisible();
    const tag='T'+Math.random().toString(16).slice(2,5).toUpperCase();
    await captain.getByRole('textbox',{name:'БАГИЙН НЭР'}).fill('Хурдны баг');
    await captain.getByRole('textbox',{name:/TAG/}).fill(tag);
    await captain.getByRole('button',{name:/БАГ ҮҮСГЭХ/}).click();
    await expect(captain.locator('.rank-invite strong')).toBeVisible();
    const code=(await captain.locator('.rank-invite strong').innerText()).trim();
    expect(code).toMatch(/^[A-F0-9]{8}$/);
    await teammate.goto('http://127.0.0.1:5173/teams');
    await teammate.getByRole('button',{name:'КОДООР НЭГДЭХ'}).click();
    await teammate.getByRole('textbox',{name:'УРЬХ КОД'}).fill(code);
    await teammate.getByRole('button',{name:/БАГТ НЭГДЭХ/}).click();
    await expect(captain.locator('.rank-roster li')).toHaveCount(1);
    await captain.reload();
    await expect(captain.locator('.rank-roster li')).toHaveCount(2);
    await expect(teammate.locator('.rank-roster li')).toHaveCount(2);
    await expect(captain.getByTestId('team-points-table')).toContainText('Хурдны баг');
    await expect(captain.getByTestId('team-points-table')).toContainText(tag);
  } finally {await Promise.allSettled([captain.close(),teammate.close()]);}
});
