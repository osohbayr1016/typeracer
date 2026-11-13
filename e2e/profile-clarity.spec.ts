import {expect,test} from '@playwright/test';

test('profile clearly separates authenticated server progress from local practice',async({page})=>{
  await page.goto('/profile');
  await expect(page.getByTestId('online-progress')).toContainText('СЕРВЕРТ ХАДГАЛАГДСАН');
  await expect(page.getByTestId('online-progress')).toContainText('ОНЛАЙН XP');
  await expect(page.getByTestId('online-progress')).toContainText('ОЛСОН ЗООС');
  await expect(page.getByRole('heading',{name:'ЭНЭ ХӨТЧИЙН ДАСГАЛЫН АХИЦ'})).toBeVisible();
  await expect(page.getByText('ЭНЭ ХӨТЧИЙН ЗООС')).toBeVisible();
  await expect(page.locator('.social-profile-name')).toContainText('ОНЛАЙН ТҮВШИН');
  await expect(page.locator('.social-bottom-actions')).not.toContainText('Зочны профайл');
  await expect(page.locator('.social-bottom-actions')).toContainText('Онлайн шагнал серверт');
  await page.getByRole('button',{name:'СТАТИСТИК ХАРАХ →'}).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.locator('.social-heading')).toContainText('ЭНЭ ТӨХӨӨРӨМЖИЙН ДАСГАЛЫН ГҮЙЦЭТГЭЛ');
});

test('when server progress is unavailable, browser XP is explicitly local and no fake sync is shown',async({page})=>{
  await page.route('**/api/progression',route=>route.fulfill({status:503,json:{error:'offline'}}));
  await page.goto('/profile');
  await expect(page.getByTestId('online-progress')).toContainText('ХОЛБОЛТ ТАСАРСАН');
  await expect(page.getByTestId('online-progress')).toContainText('Онлайн ахиц түр боломжгүй');
  await expect(page.locator('.social-profile-name')).toContainText('ДАСГАЛЫН ТҮВШИН');
  await expect(page.getByText('ЭНЭ ХӨТЧИЙН ЗООС')).toBeVisible();
});
