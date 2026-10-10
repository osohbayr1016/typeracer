import { test, expect } from '@playwright/test';

test('solo Mongolian typing can be completed and restarted', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Үсэг бүр/ })).toBeVisible();
  const text = (await page.locator('.typing-area .phrase').innerText()).trim();
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
    await Promise.all([creator.goto('/'), joiner.goto('/')]);
    await creator.getByRole('button', { name: /Найзуудтай уралдах/ }).click();
    await creator.getByRole('button', { name: /ШИНЭ ӨРӨӨ ҮҮСГЭХ/ }).click();
    const codeNode = creator.locator('.room-info strong');
    await expect(codeNode).toBeVisible();
    const code = await codeNode.innerText();
    expect(code).toMatch(/^[A-F0-9]{8}$/);

    await joiner.getByRole('button', { name: /Найзуудтай уралдах/ }).click();
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
    const text = (await creator.locator('.online-type .phrase').innerText()).trim();
    await input.pressSequentially(text.slice(0, 5), { delay: 10 });
    await expect(creator.locator('.online-type .typing-label')).toContainText('5 /');
  } finally {
    await Promise.all([creator.close(), joiner.close()]);
  }
});
