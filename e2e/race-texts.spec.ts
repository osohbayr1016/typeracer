import { test, expect } from '@playwright/test';

test('API generates coherent story passages with context plus a random-words mode', async ({ request }) => {
  const first = await (await request.get('/api/texts?seed=7')).json();
  const again = await (await request.get('/api/texts?seed=7')).json();
  expect(first.prompt.text).toBe(again.prompt.text);
  expect(first.prompt.mode).toBe('story');
  expect(first.prompt.title).toBeTruthy();
  expect(first.prompt.part).toMatch(/^\d+(–\d+)?\/\d+$/);
  const length = Array.from(String(first.prompt.text).normalize('NFC')).length;
  expect(length).toBeGreaterThanOrEqual(130);
  expect(length).toBeLessThanOrEqual(205);
  expect(first.prompt.text).toMatch(/[ӨөҮү]/);
  expect(first.passages).toBeGreaterThan(150);
  const random = await (await request.get('/api/texts')).json();
  expect(random.prompt.title).toBeTruthy();
  const words = await (await request.get('/api/texts?mode=words&seed=3')).json();
  expect(words.prompt.mode).toBe('words');
  expect(String(words.prompt.text).split(' ').length).toBeGreaterThan(15);
  expect(words.prompt.text).toMatch(/[ӨөҮү]/);
});

test('race page explains each step, names the story, shows live lane speeds, holds the finish, then Enter races again', async ({ page }) => {
  await page.goto('/quick-race');
  const input = page.getByRole('textbox', { name: 'Шууд уралдааны бичих талбар' });
  await expect(page.locator('.quick-steps li.active')).toHaveText('ЦУГЛУУЛГА');
  await expect(page.locator('.quick-type-source')).toContainText('«');
  await expect(input).toHaveAttribute('data-race-enabled', 'true', { timeout: 14000 });
  await expect(page.locator('.quick-steps li.active')).toHaveText('УРАЛДААН');
  await expect(page.locator('.quick-steps li.done')).toHaveCount(2);
  const prompt = (await page.locator('.quick-phrase').innerText()).replace(/ /g, ' ').trim();
  expect(Array.from(prompt).length).toBeGreaterThanOrEqual(130);
  await expect(page.locator('.quick-phrase span.word').first()).toBeVisible();
  await input.pressSequentially(prompt.slice(0, 12), { delay: 40 });
  await expect(page.locator('.quick-phrase span.typed')).toHaveCount(12);
  // Opponents are moving: lanes report a real live speed, not a placeholder.
  await expect.poll(async () => (await page.locator('.quick-lane-wpm').allInnerTexts())
    .filter(text => /^[1-9]\d*WPM$/.test(text.replace(/\s/g, ''))).length, { timeout: 6000 }).toBeGreaterThan(1);
  await expect(page.locator('.quick-metric-rank b')).toContainText('#');
  await input.pressSequentially(prompt.slice(12), { delay: 30 });
  const finish = page.getByTestId('quick-finish');
  await expect(finish).toBeVisible({ timeout: 8000 });
  await expect(finish).toContainText('байр');
  await expect(finish).toContainText('WPM');
  await expect(page).toHaveURL(/\/quick-results$/, { timeout: 8000 });
  await expect(page.getByTestId('quick-results-text')).toContainText('«');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/quick-race$/);
  await expect(page.locator('.quick-lane')).toHaveCount(5, { timeout: 12000 });
});

test('solo practice offers story and random-word texts and never repeats the previous passage', async ({ page }) => {
  await page.goto('/race');
  const label = page.locator('.typing-label span').first();
  await expect(label).toContainText('«');
  const first = await page.locator('.phrase').innerText();
  await page.getByRole('button', { name: 'ҮГС' }).click();
  await expect(page.getByRole('button', { name: 'ҮГС' })).toHaveAttribute('aria-pressed', 'true');
  await expect(label).toContainText('САНАМСАРГҮЙ ҮГС');
  const words = await page.locator('.phrase').innerText();
  expect(words).not.toBe(first);
  expect(words).not.toMatch(/[.,!?]/);
  await page.getByRole('button', { name: 'ӨГҮҮЛЛЭГ' }).click();
  const story = await page.locator('.phrase').innerText();
  expect(story).not.toBe(words);
  expect(story).toMatch(/\.$/);
  await page.getByRole('button', { name: 'Шинэ текст' }).click();
  expect(await page.locator('.phrase').innerText()).not.toBe(story);
});
