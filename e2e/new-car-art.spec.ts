import {expect,test} from '@playwright/test';

const ids=[
  'side-common-graphite','side-uncommon-cobalt','side-rare-lightning',
  'side-epic-violet','side-mythic-emerald','side-legend-cyber'
] as const;

test('new original 2D rarity car assets are real WebP in shop and multiplayer sizes',async({page,request})=>{
  for(const id of ids){
    for(const path of ['/cars/','/cars/race/']){
      const url=path+id+'.webp';
      const response=await request.get(url);
      expect(response.ok(),url).toBeTruthy();
      const raw=await response.body();
      expect(raw.length,url).toBeGreaterThan(2500);
      expect(raw.toString('ascii',0,4),url).toBe('RIFF');
      expect(raw.toString('ascii',8,12),url).toBe('WEBP');
    }
  }
  await page.goto('/shop');
  await expect(page.locator('.shop-item-grid .shop-collectible')).toHaveCount(33);
  for(const id of ids) {
    await expect(page.locator('.shop-item-grid [data-item-id="'+id+'"]')).toHaveCount(1);
  }
  for(const width of [390,768,1380]){
    await page.setViewportSize({width,height:845});
    await page.goto('/shop');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(overflow,'shop viewport '+width).toBeLessThanOrEqual(1);
    await expect(page.locator('.shop-rarity-tabs .rarity-filter')).toHaveCount(6);
  }
  await page.locator('.shop-rarity-tabs .rarity-legendary').click();
  await expect(page.locator('.shop-item-grid .shop-collectible')).toHaveCount(4);
  await expect(page.locator('[data-item-id="side-legend-cyber"]')).toBeVisible();
});

test('new side-view cars appear in all garage tiers but remain level-gated',async({page})=>{
  await page.goto('/garage');
  await expect(page.locator('.garage-page-grid .garage-car-tile')).toHaveCount(35);
  const newCar=page.getByRole('button',{name:/Кибер Тэнгэр/});
  await expect(newCar).toBeDisabled();
  await page.goto('/shop');
  const legendary=page.locator('[data-item-id="side-legend-cyber"]');
  await expect(legendary.locator('.item-action')).toContainText('5,400');
  await expect(legendary.locator('.item-action button')).toBeDisabled();
});
