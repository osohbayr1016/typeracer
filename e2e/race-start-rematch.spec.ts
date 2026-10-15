import { test, expect } from '@playwright/test';

test('mobile can prepare its keyboard, ignore early input, and type on green despite clock skew and a late phase packet', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + 20 * 60_000;
    const events: Array<{ signal: string; at: number }> = [];
    (window as unknown as { lightEvents: typeof events }).lightEvents = events;
    new MutationObserver(() => {
      const signal = document.querySelector('[data-testid="race-start-lights"]')?.getAttribute('data-signal') ?? 'off';
      if (signal !== (events.at(-1)?.signal ?? 'off')) events.push({ signal, at: performance.now() });
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-signal'] });
  });
  await page.routeWebSocket('**/api/quickplay/ws*', socket => {
    const server = socket.connectToServer();
    server.onMessage(message => {
      const data = JSON.parse(String(message));
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
    await expect(page.getByTestId('race-start-lights')).toHaveAttribute('data-signal', 'red');
    await page.setViewportSize({ width: 390, height: 380 });
    await expect(page.getByTestId('race-start-lights')).toHaveAttribute('data-signal', 'yellow');
    await expect(page.getByTestId('race-start-lights')).toHaveAttribute('data-signal', 'green');
    await expect(page.getByTestId('quick-phase')).toHaveAttribute('data-phase', 'countdown');
    await expect(input).toBeFocused();
    const bounds = await page.getByTestId('race-start-lights').boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThan(380);
    await input.pressSequentially(text[0]);
    await expect(page.locator('.quick-phrase .typed')).toHaveCount(1);
    await expect(page.locator('.quick-lane.me b')).not.toHaveText('0%');
    await expect(page.getByTestId('race-start-lights')).toHaveCount(0);
    const events = await page.evaluate(() => (window as unknown as { lightEvents: Array<{ signal: string; at: number }> }).lightEvents);
    expect(events.map(e => e.signal)).toEqual(['red', 'yellow', 'green', 'off']);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].at - events[i - 1].at).toBeGreaterThan(700);
      expect(events[i].at - events[i - 1].at).toBeLessThan(1300);
    }
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
