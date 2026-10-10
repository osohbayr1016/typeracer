import { test, expect } from '@playwright/test';

test('solo Mongolian typing can be completed and restarted', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Хурд, нарийвчлалаа сорь/ })).toBeVisible();
  const text = (await page.locator('.typing-area .phrase').innerText()).replace(/\u00a0/g, ' ').trim();
  expect(text).toMatch(/[ӨөҮү]/);
  const keyboard = page.getByRole('textbox', { name: 'Энд бичиж эхлээрэй' });
  await keyboard.pressSequentially(text, { delay: 5 });
  await expect(page.getByText(/Баяр хүргэе!/)).toBeVisible();
  await page.getByRole('button', { name: /ДАХИН УРАЛДАХ/ }).click();
  await expect(keyboard).toHaveValue('');
  await expect(page.getByText('SOLO RACE')).toBeVisible();
});

test('two browsers can create, join, ready and start a guest race', async ({ browser }) => {
  const creator = await browser.newPage();
  const joiner = await browser.newPage();
  try {
    await Promise.all([creator.goto('http://127.0.0.1:5173'), joiner.goto('http://127.0.0.1:5173')]);
    await creator.getByRole('button', { name: /Multiplayer/ }).click();
    await creator.getByRole('button', { name: /ШИНЭ ӨРӨӨ ҮҮСГЭХ/ }).click();
    const codeNode = creator.locator('.room-info strong');
    await expect(codeNode).toBeVisible();
    const code = await codeNode.innerText();
    expect(code).toMatch(/^[A-F0-9]{8}$/);

    await joiner.getByRole('button', { name: /Multiplayer/ }).click();
    await joiner.getByRole('textbox', { name: 'Өрөөний код' }).fill(code);
    await joiner.getByRole('button', { name: /НЭВТРЭХ/ }).click();

    await expect(creator.locator('.multiplayer-track .lane')).toHaveCount(2);
    await expect(joiner.locator('.multiplayer-track .lane')).toHaveCount(2);
    await creator.getByRole('button', { name: /БЭЛЭН БОЛОХ/ }).click();
    await joiner.getByRole('button', { name: /БЭЛЭН БОЛОХ/ }).click();

    const input = creator.getByRole('textbox', { name: 'Онлайн уралдааны бичих хэсэг' });
    await expect(input).toBeEditable({ timeout: 12_000 });
    const progressBefore = await creator.locator('.multiplayer-track .lane.you .lane-detail').innerText();
    expect(progressBefore).toBe('READY');
    const text = (await creator.locator('.online-type .phrase').innerText()).replace(/\u00a0/g, ' ').trim();
    await input.pressSequentially(text.slice(0, 5), { delay: 10 });
    await expect(creator.locator('.online-type .typing-label')).toContainText('5 /');
  } finally {
    await Promise.all([creator.close(), joiner.close()]);
  }
});

test('responsive race page and garage work without extra dashboard controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Хурд, нарийвчлалаа сорь/ })).toBeVisible();
  await expect(page.locator('.track-wrap .lane-car')).toHaveAttribute('src', '/cars/coral-gt.svg');
  const car = page.getByRole('button', { name: /Blue Sprint/ });
  await car.click();
  await expect(page.locator('.track-wrap .lane-car')).toHaveAttribute('src', '/cars/blue-sprint.svg');
  await page.reload();
  await expect(page.locator('.track-wrap .lane-car')).toHaveAttribute('src', '/cars/blue-sprint.svg');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('.typing-area .typing-input')).toBeVisible();
});

test('friend invitation URL prefills room code', async ({ page }) => {
  await page.goto('/?room=ABCDEF12');
  await expect(page.getByRole('button', { name: 'НЭВТРЭХ →' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Өрөөний код' })).toHaveValue('ABCDEF12');
});

test('solo pace opponents are clearly identified as ghosts, and new garage cars are gated', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.track-wrap .lane')).toHaveCount(3);
  await expect(page.getByText('PACE GHOST · БОДИТ ТОГЛОГЧ БИШ')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Volt/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Phantom/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Garage' }).click();
  await expect(page.locator('#garage')).toBeInViewport();
});