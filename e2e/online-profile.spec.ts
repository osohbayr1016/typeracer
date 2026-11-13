import {expect,test} from '@playwright/test';

test('cloud-backed profile shows true online personal best and expandable race receipts',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/progression',route=>route.fulfill({json:{
    xp:250,coins:290,races:2,seasonXp:250,level:1,owned:[],
    source:'server',starter:200,
    stats:{bestWpm:112,avgWpm:91,avgAccuracy:97,lastRacedAt:Date.parse('2026-11-13T11:00:00Z')},
    equipped:{car:'sunset',trail:'none',title:'rookie',sticker:'none'},
    recent:[
      {raceId:'11111111-1111-4111-8111-111111111111',xp:130,coins:30,wpm:112,accuracy:99,finishedAt:Date.parse('2026-11-13T11:00:00Z')},
      {raceId:'22222222-2222-4222-8222-222222222222',xp:120,coins:30,wpm:70,accuracy:95,finishedAt:Date.parse('2026-11-13T10:00:00Z')}
    ],
    daily:{day:'2026-11-13',quests:[]},
    season:{id:'season-01',number:1,name:'ЭХНИЙ ГАРАА',from:0,until:1,
      xp:250,remainingDays:17,rewards:[]}
  }}));
  await page.goto('/profile');
  await expect(page.getByTestId('online-progress')).toContainText('СЕРВЕРТ ХАДГАЛАГДСАН');
  await expect(page.getByText('ОНЛАЙН ХУВИЙН РЕКОРД')).toBeVisible();
  await expect(page.getByText('ОНЛАЙН ДУНДАЖ ХУРД')).toBeVisible();
  await expect(page.locator('.social-online-records')).toContainText('112');
  await expect(page.locator('.social-online-records')).toContainText('91');
  await expect(page.locator('.social-online-records')).toContainText('97%');
  const details=page.getByTestId('online-history');
  await expect(details).not.toHaveAttribute('open','');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open','');
  await expect(details.getByRole('listitem')).toHaveCount(2);
  await expect(details).toContainText('+130 XP');
  await expect(details).toContainText('112 WPM');
  await expect(details).toContainText('◈ +30');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.reload();
  await expect(page.getByText('ОНЛАЙН ХУВИЙН РЕКОРД')).toBeVisible();
  await expect(page.locator('.social-online-records')).toContainText('112');
});

test('fresh new player keeps only compact cloud record stats and gets no fabricated history',async({page})=>{
  await page.goto('/profile');
  await expect(page.getByTestId('online-progress')).toContainText('СЕРВЕРТ ХАДГАЛАГДСАН');
  await expect(page.getByText('ОНЛАЙН ХУВИЙН РЕКОРД')).toBeVisible();
  await expect(page.getByTestId('online-history')).toHaveCount(0);
  await expect(page.locator('.social-online-records')).toContainText('0');
});
