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

test('home has a one-click speed practice entry without breaking the original online play flow', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:/15 СЕК ТЕСТ/}).click();
  await expect(page).toHaveURL(/\/sprint$/);
  await expect(page.getByTestId('sprint-page')).toBeVisible();
  await page.goto('/');
  await page.locator('.home-hero').getByRole('button',{name:/ТОГЛОХ/}).click();
  await expect(page).toHaveURL(/\/play$/);
});
