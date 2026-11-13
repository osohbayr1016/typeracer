import { expect, test } from '@playwright/test';

test('instant sprint accepts single Cyrillic keys without racing or payment setup', async ({page}) => {
  await page.goto('/sprint');
  await expect(page.getByTestId('sprint-page')).toBeVisible();
  const input = page.getByRole('textbox', {name:'Хурдны шалгалтын бичих талбар'});
  await expect(page.getByTestId('sprint-countdown')).toContainText('15.0');
  const first = await page.locator('.sprint-phrase span').first().textContent();
  expect(first).toBeTruthy();
  await input.fill(first!);
  await expect(page.locator('.sprint-phrase span').first()).toHaveClass(/typed/);
  await expect(page.getByTestId('sprint-countdown')).not.toContainText('15.0');
  await page.getByRole('button', {name:'30 сек'}).click();
  await expect(page.getByTestId('sprint-countdown')).toContainText('30.0');
  await expect(page.locator('.sprint-phrase .typed')).toHaveCount(0);
  await expect(page.getByTestId('sprint-page')).toBeVisible();
});

test('daily challenge text stays identical across independent visits', async ({page}) => {
  await page.goto('/daily');
  await expect(page.getByRole('heading',{name:/ӨНӨӨДРИЙН СОРИЛ/})).toBeVisible();
  const before = await page.getByTestId('sprint-passage').textContent();
  await page.reload();
  await expect(page.getByTestId('sprint-passage')).toHaveText(before!);
  await expect(page.getByTestId('sprint-countdown')).toContainText('30.0');
});

test('home provides instant online racing, quick practice and access to mode selection', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:/15 СЕК ТЕСТ/}).click();
  await expect(page).toHaveURL(/\/sprint$/);
  await expect(page.getByTestId('sprint-page')).toBeVisible();
  await page.goto('/');
  await page.getByTestId('home-instant-race').click();
  await expect(page).toHaveURL(/\/quick-race$/);
  await expect(page.getByTestId('quick-race')).toBeVisible();
  await page.goto('/');
  await page.getByRole('button',{name:/БУСАД ГОРИМ/}).click();
  await expect(page).toHaveURL(/\/play$/);
});


test('an open daily challenge resets to the new Mongolian day without refreshing', async ({page}) => {
  await page.clock.install({time: new Date('2026-11-13T15:59:40Z')});
  await page.goto('/daily');
  await expect(page.locator('.sprint-kicker')).toContainText('2026-11-13');
  const input=page.getByRole('textbox',{name:'Хурдны шалгалтын бичих талбар'});
  const letter=await page.locator('.sprint-phrase span').first().textContent();
  await input.fill(letter!);
  await expect(page.locator('.sprint-phrase span.typed')).toHaveCount(1);
  await page.clock.fastForward(60_000);
  await expect(page.locator('.sprint-kicker')).toContainText('2026-11-14');
  await expect(page.locator('.sprint-phrase span.typed')).toHaveCount(0);
  await expect(page.getByTestId('sprint-countdown')).toContainText('30.0');
});
