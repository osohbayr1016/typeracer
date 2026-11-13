import {test,expect} from '@playwright/test';

test('Season 02 replaces expired local Season 01, claims real server rewards and fits phones',async({page})=>{
  // Future dated browser UI; API fixture represents the real trusted Worker
  // season endpoint. Server calendar arithmetic is separately tested in SQLite.
  await page.clock.install({time:new Date('2026-12-01T06:00:00Z')});
  const from=Date.parse('2026-11-30T16:00:00Z');
  const until=Date.parse('2027-01-31T16:00:00Z');
  const thresholds=[350,850,1650,2800,4200,5900,8000,10500];
  const names=['120 зоос','Аянга','Шонхор GT','350 зоос','Мөсөн мөр',
    'Түргэн хуруу','Шөнийн хүлэг','Лууны дөл'];
  const rewards=thresholds.map((xp,i)=>({
    tier:i+1,xp,coins:i===0?120:i===3?350:0,itemKey:null,
    name:names[i],claimed:false,claimable:i<2
  }));
  const earned={xp:1800,coins:410,races:12,seasonXp:900,level:7,owned:[],
    recent:[],source:'server',starter:200,equipped:{
      car:'sunset',trail:'none',title:'rookie',sticker:'none'
    },daily:{day:'2026-12-01',quests:[]},
    season:{id:'season-02',number:2,name:'ӨВЛИЙН ГАРАА',from,until,
      xp:900,remainingDays:62,rewards}
  };
  await page.route('**/api/progression',route=>route.fulfill({json:earned}));
  await page.route('**/api/progression/season/claim',async route=>{
    expect(route.request().postDataJSON()).toEqual({tier:1});
    rewards[0].claimed=true;
    rewards[0].claimable=false;
    earned.coins+=120;
    await route.fulfill({json:{profile:earned}});
  });
  for(const size of [{width:390,height:844},{width:1380,height:900}]){
    await page.setViewportSize(size);
    await page.goto('/season');
    const screen=page.getByTestId('online-season');
    await expect(screen.getByRole('heading',{name:/ӨВЛИЙН ГАРАА/})).toBeVisible();
    await expect(screen).toContainText('SEASON 02');
    await expect(screen.locator('.online-season-tier')).toHaveCount(8);
    await expect(screen.getByRole('progressbar',{name:'Улирлын ахиц'}))
      .toHaveAttribute('aria-valuenow','900');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await page.getByTestId('online-season-claim').click();
  await expect(page.locator('.online-season-claimed')).toBeVisible();
  await expect(page.locator('.online-season-metrics')).toContainText('1 / 8');
  await page.reload();
  await expect(page.locator('.online-season-claimed')).toBeVisible();
  await page.locator('.online-season-tier[data-tier="2"]').click();
  await expect(page.getByTestId('online-season-claim')).toBeEnabled();
});

test('old Season 01 remains viewable and retains local claims before December 1',async({page})=>{
  await page.clock.install({time:new Date('2026-11-13T09:00:00Z')});
  await page.goto('/season');
  await expect(page.getByTestId('season-pass')).toBeVisible();
  await expect(page.getByTestId('online-season')).toHaveCount(0);
  await expect(page.getByTestId('season-pass')).toContainText('SEASON 01');
});
