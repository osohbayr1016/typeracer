import { test, expect } from '@playwright/test';

test('Play Now leads to mode selection, solo countdown, results and replay', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /TYPE FAST/ })).toBeVisible();
  await page.getByRole('button', { name: /PLAY NOW/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('heading', { name: /READY TO RACE/ })).toBeVisible();

  await page.getByRole('button', { name: /START SOLO RACE/ }).click();
  await expect(page).toHaveURL(/\/race$/);
  await expect(page.getByText('GET READY')).toBeVisible();
  const keyboard = page.getByRole('textbox', { name: 'Энд бичиж эхлээрэй' });
  await expect(keyboard).toBeEditable({ timeout: 8_000 });
  const text = (await page.locator('.typing-area .phrase').innerText()).replace(/\u00a0/g, ' ').trim();
  expect(text).toMatch(/[ӨөҮү]/);
  await keyboard.pressSequentially(text, { delay: 5 });
  await expect(page).toHaveURL(/\/results$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /FINISH LINE/ })).toBeVisible();
  await expect(page.locator('.results-score strong')).toContainText('WPM');

  await page.getByRole('button', { name: /RACE AGAIN/ }).click();
  await expect(page).toHaveURL(/\/race$/);
  await expect(keyboard).toHaveValue('');
});

test('two real browsers create a waiting lobby, join, ready and race live', async ({ browser }) => {
  const creator = await browser.newPage();
  const joiner = await browser.newPage();
  try {
    await Promise.all([creator.goto('http://127.0.0.1:5173/multiplayer'), joiner.goto('http://127.0.0.1:5173/multiplayer')]);
    await creator.getByRole('button', { name: /CREATE LOBBY/ }).click();
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
    await creator.getByRole('button', { name: /READY TO RACE/ }).click();
    await joiner.getByRole('button', { name: /READY TO RACE/ }).click();
    await expect(creator).toHaveURL(/\/multiplayer\/race$/);
    await expect(joiner).toHaveURL(/\/multiplayer\/race$/);
    await expect(creator.locator('.multiplayer-track .lane')).toHaveCount(2);

    const input = creator.getByRole('textbox', { name: 'Онлайн уралдааны бичих хэсэг' });
    await expect(input).toBeEditable({ timeout: 12_000 });
    const prompt = (await creator.locator('.online-type .phrase').innerText()).replace(/\u00a0/g, ' ').trim();
    await input.pressSequentially(prompt.slice(0, 5), { delay: 10 });
    await expect(creator.locator('.online-type .typing-label')).toContainText('5 /');
  } finally {
    await Promise.all([creator.close(), joiner.close()]);
  }
});

test('mobile garage selection persists and gameplay remains viewport-safe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/garage');
  await expect(page.getByRole('heading', { name: /MY GARAGE/ })).toBeVisible();
  const car = page.getByRole('button', { name: /Blue Sprint/ });
  await car.click();
  await expect(car).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /PLAY WITH THIS CAR/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole('button', { name: /START SOLO RACE/ }).click();
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
  await page.getByRole('button', { name: 'Garage', exact: true }).click();
  await expect(page).toHaveURL(/\/garage$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /TYPE FAST/ })).toBeVisible();
  await page.goto('/play');
  await expect(page.getByRole('heading', { name: /READY TO RACE/ })).toBeVisible();
});

test('solo opponents are labelled practice pace ghosts, garage progression is not fake multiplayer', async ({ page }) => {
  await page.goto('/race');
  await expect(page.locator('.track-wrap .lane')).toHaveCount(3);
  await expect(page.getByText('PACE GHOST · БОДИТ ТОГЛОГЧ БИШ')).toHaveCount(2);
  await page.goto('/garage');
  await expect(page.getByRole('button', { name: /Volt/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Phantom/ })).toBeDisabled();
  await expect(page.locator('.garage-page-grid .garage-car-tile')).toHaveCount(5);
});
