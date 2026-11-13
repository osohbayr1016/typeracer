import {expect,test} from '@playwright/test';

test('one-tap focus mode hides rival lanes but preserves live race typing and ranking',async({page})=>{
  await page.goto('/quick-race');
  const toggle=page.getByTestId('quick-focus-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.quick-lane')).toHaveCount(5,{timeout:12000});
  await expect(page.locator('.quick-type-input')).toHaveAttribute('data-race-enabled','true',{timeout:15000});
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('quick-race')).toHaveAttribute('data-focus','true');
  await expect(page.locator('.quick-lane.me')).toBeVisible();
  for(const other of await page.locator('.quick-lane:not(.me)').all())
    await expect(other).toBeHidden();
  await expect(page.getByTestId('quick-type-panel')).toBeVisible();
  await expect(page.locator('.quick-type-input')).toBeFocused();
  const text=(await page.locator('.quick-phrase').innerText()).replace(/\u00a0/g,' ').trim();
  await page.locator('.quick-type-input').pressSequentially(text.slice(0,4),{delay:130});
  await expect.poll(async()=>Number((await page.locator('.quick-lane.me .quick-lane-meta b')
    .innerText()).replace('%',''))).toBeGreaterThan(0);
  await toggle.click();
  await expect(page.getByTestId('quick-race')).toHaveAttribute('data-focus','false');
  await expect(page.locator('.quick-lane')).toHaveCount(5);
  for(const other of await page.locator('.quick-lane:not(.me)').all())
    await expect(other).toBeVisible();
});

test('focus preference survives page refresh; mobile typography stays readable without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/quick-race');
  const toggle=page.getByTestId('quick-focus-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>localStorage.getItem('typeracer.quick.focus.v1'))).toBe('1');
  await page.reload();
  await expect(page.getByTestId('quick-focus-toggle')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('quick-race')).toHaveAttribute('data-focus-preferred','true');
  await expect(page.locator('.quick-type-input')).toHaveAttribute('data-race-enabled','true',{timeout:15000});
  await expect(page.getByTestId('quick-race')).toHaveAttribute('data-focus','true');
  const metrics=await page.evaluate(()=>{
    const phrase=document.querySelector('.quick-phrase');
    const line=document.querySelector('.quick-lane-meta small');
    const toggle=document.querySelector('.quick-focus-toggle');
    return {
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      phrasePx:Number.parseFloat(getComputedStyle(phrase!).fontSize),
      lanePx:Number.parseFloat(getComputedStyle(line!).fontSize),
      hitSize:toggle!.getBoundingClientRect().height
    };
  });
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.phrasePx).toBeGreaterThanOrEqual(18);
  expect(metrics.lanePx).toBeGreaterThanOrEqual(10);
  expect(metrics.hitSize).toBeGreaterThanOrEqual(44);
});
