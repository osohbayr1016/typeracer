import { test, expect } from '@playwright/test';

test('mobile can prepare its keyboard, ignore early input, and type on green despite clock skew and a late phase packet', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  let playerId = '';
  let serverProgress = 0;
  await page.addInitScript(() => {
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + 20 * 60_000;
  });
  await page.routeWebSocket('**/api/quickplay/ws*', socket => {
    const server = socket.connectToServer();
    server.onMessage(message => {
      const data = JSON.parse(String(message));
      if (data.type === 'welcome') playerId = String(data.id);
      if (data.type === 'state' && playerId && Array.isArray(data.players)) {
        const racer = data.players.find((p: {id:string;progress:number}) => p.id === playerId);
        if (racer && typeof racer.progress === 'number')
          serverProgress = Math.max(serverProgress,racer.progress);
      }
      // Keep the old countdown phase on screen through the first green keystroke.
      if (data.type === 'state' && data.phase === 'racing') setTimeout(() => socket.send(message), 600);
      else socket.send(message);
    });
  });
  try {
    await page.goto('/quick-race');
    const input = page.locator('.quick-type-input');
    await expect(input).toBeEditable();
    await expect(input).toHaveAttribute('data-race-enabled', 'false');
    await input.tap();
    await expect(input).toBeFocused();
    const text = (await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g, ' ');
    await input.pressSequentially(text[0]);
    await expect(input).toHaveValue('');
    await expect(page.locator('.quick-phrase .typed')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 380 });
    await expect(input).toBeFocused();
    // CI can miss a one-second red/yellow light due to browser scheduling.
    // Exact boundary + late-phase semantics are tested deterministically in
    // raceStartSignal.test.ts. This browser test verifies keyboard readiness,
    // early-key rejection and a real post-deadline keystroke on mobile.
    await expect(input).toHaveAttribute('data-race-enabled', 'true', { timeout: 15000 });
    await input.pressSequentially(text[0]);
    await expect(page.locator('.quick-phrase .typed')).toHaveCount(1);
    // The visual lane may round 1/205 characters to 0%; require an actual
    // server progress event rather than a rounded percentage or local prediction.
    await expect.poll(() => serverProgress, {timeout:10000}).toBeGreaterThan(0);
    await expect(page.getByTestId('race-start-lights')).toHaveCount(0, { timeout: 5000 });
  } finally { await context.close(); }
});

test('a slow display-name update cannot block entering the live lobby', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/account/name', async route => { await gate; await route.continue().catch(() => {}); });
  try {
    await page.goto('/quick-race');
    await expect(page.locator('.quick-lane.me')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.quick-phrase')).toBeVisible();
  } finally { release(); }
});

test('two custom-match players finish, rematch in the same room and start a clean second race', async ({ browser }) => {
  const first = await browser.newPage();
  const second = await browser.newPage();
  try {
    await first.goto('/multiplayer');
    await first.getByRole('button', { name: /ӨРӨӨ ҮҮСГЭХ/ }).click();
    const code = await first.locator('.room-info strong').innerText();
    await second.goto('/multiplayer?room=' + code);
    await second.getByRole('button', { name: /НЭВТРЭХ/ }).click();
    await expect(first.locator('.lobby-player:not(.empty)')).toHaveCount(2);
    await first.getByRole('button', { name: /БЭЛЭН/ }).click();
    await second.getByRole('button', { name: /БЭЛЭН/ }).click();
    const a = first.getByRole('textbox', { name: 'Онлайн уралдааны бичих хэсэг' });
    const b = second.getByRole('textbox', { name: 'Онлайн уралдааны бичих хэсэг' });
    await expect(a).toHaveAttribute('data-race-enabled', 'true');
    await expect(b).toHaveAttribute('data-race-enabled', 'true');
    const text = (await first.locator('.online-type .phrase').innerText()).replace(/\u00a0/g, ' ');
    await Promise.all([a.pressSequentially(text, { delay: 40 }), b.pressSequentially(text, { delay: 40 })]);
    await expect(first.getByRole('button', { name: /ДАХИН ТОГЛОХ/ })).toBeVisible();
    await expect(second.getByRole('button', { name: /ДАХИН ТОГЛОХ/ })).toBeVisible();
    await first.getByRole('button', { name: /ДАХИН ТОГЛОХ/ }).click();
    await expect(first.locator('.room-info strong')).toHaveText(code);
    await expect(second.locator('.room-info strong')).toHaveText(code);
    await expect(first.locator('.lobby-player:not(.empty)')).toHaveCount(2);
    await expect(second.locator('.lobby-player:not(.empty)')).toHaveCount(2);
    await expect(first.getByRole('button', { name: /ДАХИН ТОГЛОХ/ })).toHaveCount(0);
    await second.getByRole('button', { name: /БЭЛЭН/ }).click();
    await expect(a).toHaveAttribute('data-race-enabled', 'true');
    await expect(b).toHaveAttribute('data-race-enabled', 'true');
    const nextText = (await first.locator('.online-type .phrase').innerText()).replace(/\u00a0/g, ' ');
    expect(nextText).not.toBe(text);
    await expect(first.locator('.online-type .typing-label')).toContainText('0 /');
    await a.pressSequentially(nextText[0]);
    await expect(first.locator('.online-type .typing-label')).toContainText('1 /');
  } finally { await Promise.allSettled([first.close(), second.close()]); }
});
