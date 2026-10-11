import { test, expect } from '@playwright/test';

test('Play Now leads to mode selection, solo countdown, results and replay', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /ХУРДАН БИЧ/ })).toBeVisible();
  await page.locator('.home-hero').getByRole('button', { name: /ТОГЛОХ/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('heading', { name: /УРАЛДАХАД/ })).toBeVisible();

  await page.getByRole('button', { name: /ГАНЦААРАА ЭХЛЭХ/ }).click();
  await expect(page).toHaveURL(/\/race$/);
  await expect(page.getByText('БЭЛДЭЭРЭЙ')).toBeVisible();
  const keyboard = page.getByRole('textbox', { name: 'Энд бичиж эхлээрэй' });
  await expect(keyboard).toBeEditable({ timeout: 8_000 });
  const text = (await page.locator('.typing-area .phrase').innerText()).replace(/\u00a0/g, ' ').trim();
  expect(text).toMatch(/[ӨөҮү]/);
  await keyboard.pressSequentially(text, { delay: 5 });
  await expect(page).toHaveURL(/\/results$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /БАРИАНД/ })).toBeVisible();
  await expect(page.locator('.results-score strong')).toContainText('WPM');

  await page.getByRole('button', { name: /ДАХИН УРАЛДАХ/ }).click();
  await expect(page).toHaveURL(/\/race$/);
  await expect(keyboard).toHaveValue('');
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

    await joiner.getByRole('textbox', { name: 'Өрөөний код' }).fill(code);
    await joiner.getByRole('button', { name: /НЭВТРЭХ/ }).click();
    await expect(creator.locator('.lobby-player:not(.empty)')).toHaveCount(2);
    await expect(joiner.locator('.lobby-player:not(.empty)')).toHaveCount(2);
    await creator.getByRole('button', { name: /БЭЛЭН/ }).click();
    await joiner.getByRole('button', { name: /БЭЛЭН/ }).click();
    await expect(creator).toHaveURL(/\/multiplayer\/race$/);
    await expect(joiner).toHaveURL(/\/multiplayer\/race$/);
    await expect(creator.locator('.multiplayer-track .lane')).toHaveCount(2);

    const input = creator.getByRole('textbox', { name: 'Онлайн уралдааны бичих хэсэг' });
    await expect(input).toBeEditable({ timeout: 12_000 });
    const prompt = (await creator.locator('.online-type .phrase').innerText()).replace(/\u00a0/g, ' ').trim();
    await input.pressSequentially(prompt.slice(0, 5), { delay: 10 });
    await expect(creator.locator('.online-type .typing-label')).toContainText('5 /');
  } finally {
    await Promise.allSettled([creator.close(), joiner.close()]);
  }
});

test('mobile garage selection persists and gameplay remains viewport-safe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/garage');
  await expect(page.getByRole('heading', { name: /МИНИЙ ГАРАЖ/ })).toBeVisible();
  const car = page.getByRole('button', { name: /Цэнхэр салхи/ });
  await car.click();
  await expect(car).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /ЭНЭ МАШИНААР УРАЛДАХ/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole('button', { name: /ГАНЦААРАА ЭХЛЭХ/ }).click();
  await expect(page.locator('.track-wrap .lane.you .lane-car')).toHaveAttribute('src', '/cars/blue-sprint.svg');
  await page.reload();
  await expect(page.locator('.track-wrap .lane.you .lane-car')).toHaveAttribute('src', '/cars/blue-sprint.svg');
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

test('Улирлын үнэгүй шагнал: дууссан уралдаанаар XP авч, шатны зоосыг нэг л удаа авна', async ({ page }) => {
  await page.goto('/play');
  await page.getByRole('button', { name: /ГАНЦААРАА ЭХЛЭХ/ }).click();
  const input = page.getByRole('textbox', { name: 'Энд бичиж эхлээрэй' });
  await expect(input).toBeEditable({ timeout: 9000 });
  const prompt = (await page.locator('.typing-area .phrase').innerText()).replace(/\u00a0/g,' ').trim();
  await input.pressSequentially(prompt, { delay: 4 });
  await expect(page).toHaveURL(/\/results$/, { timeout: 15000 });
  await expect(page.locator('.result-rewards')).toContainText('XP');
  await page.goto('/season');
  const firstTier = page.locator('.season-tier').first();
  await expect(firstTier.getByRole('button', { name: 'Шагнал авах' })).toBeEnabled();
  await firstTier.getByRole('button', { name: 'Шагнал авах' }).click();
  await expect(firstTier.getByRole('button', { name: /Авсан/ })).toBeDisabled();
  await page.reload();
  await expect(firstTier.getByRole('button', { name: /Авсан/ })).toBeDisabled();
  await expect(page.locator('.season-stats')).toContainText('1 / 8');
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
