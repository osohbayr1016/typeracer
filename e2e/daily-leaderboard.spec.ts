import {expect,test} from '@playwright/test';

test('public daily XP board uses real server endpoint and shows a clear beta reset rule',async({page})=>{
  const response=await page.request.get('/api/leaderboard/daily?limit=5');
  expect(response.ok()).toBeTruthy();
  const live=await response.json() as {period:string;mode:string;day:string;total:number;players:unknown[]};
  expect(live).toMatchObject({period:'day',mode:'daily'});
  expect(live.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Array.isArray(live.players)).toBe(true);

  let fetched=0;
  await page.route('**/api/leaderboard/daily?*',route=>{
    fetched++;
    return route.fulfill({json:{
      period:'day',mode:'daily',day:'2026-11-13',nextResetAt:Date.parse('2026-11-13T16:00:00Z'),
      limit:20,offset:0,total:1,players:[{
        rank:1,id:'daily-player',name:'Монгол аварга',points:185,races:2,
        wpm:87,accuracy:96,bestWpm:112,teamTag:null,guest:true
      }]
    }});
  });
  await page.goto('/leaderboard');
  const board=page.getByTestId('leaderboard-page');
  await expect(board).toBeVisible();
  await page.getByRole('button',{name:'ӨНӨӨДӨР · XP'}).click();
  await expect(page.locator('.social-card-heading')).toContainText('ӨНӨӨДРИЙН ОНЛАЙН XP');
  await expect(page.locator('.rank-scope-note')).toContainText('Улаанбаатарын цагаар 00:00');
  await expect(page.getByTestId('global-points-table')).toContainText('Монгол аварга');
  await expect(page.getByTestId('global-points-table')).toContainText('185');
  await expect(page.getByTestId('global-points-table')).toContainText('ОНЛАЙН XP');
  await expect(page.getByTestId('global-points-table')).not.toContainText('ХОЛБОСОН ACCOUNT');
  const previous=fetched;
  await page.getByRole('button',{name:'Чансааг шинэчлэх'}).click();
  await expect.poll(()=>fetched).toBeGreaterThan(previous);
  await page.getByRole('button',{name:'7 ХОНОГ'}).click();
  await expect(page.locator('.social-card-heading')).toContainText('ДОЛОО ХОНОГИЙН ЧАНСАА');
});

test('daily standings keep the mobile viewport clean and provide an actionable empty state',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/leaderboard/daily?*',route=>route.fulfill({json:{
    period:'day',mode:'daily',day:'2026-11-13',nextResetAt:Date.parse('2026-11-13T16:00:00Z'),
    limit:20,offset:0,total:0,players:[]
  }}));
  await page.goto('/leaderboard');
  await page.getByRole('button',{name:'ӨНӨӨДӨР · XP'}).click();
  await expect(page.getByText('Өнөөдөр серверт баталгаажсан дууссан уралдаан алга.')).toBeVisible();
  await expect(page.getByRole('button',{name:'▶ УРАЛДАХ'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
