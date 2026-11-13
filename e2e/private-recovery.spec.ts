import {expect,test} from '@playwright/test';

test('private invite room preserves the same racer and track after a page reload',async({page,browser})=>{
  const second=await browser.newContext();
  const friend=await second.newPage();
  try{
    await page.goto('/multiplayer');
    await page.getByRole('textbox',{name:'Тоглогчийн нэр'}).fill('Driver One');
    await page.getByRole('button',{name:/ӨРӨӨ ҮҮСГЭХ/}).click();
    const code=page.locator('.room-info strong');
    await expect(code).toHaveText(/^[A-F0-9]{8}$/,{timeout:10000});
    const room=(await code.textContent())!.trim();
    const token=await page.evaluate(code=>sessionStorage.getItem('typeracer.private.'+code+'.resume'),room);
    expect(token).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await page.evaluate(()=>sessionStorage.getItem('typeracer.private.active'))).toBe(room);

    await friend.goto('/multiplayer?room='+room);
    await friend.getByRole('textbox',{name:'Тоглогчийн нэр'}).fill('Driver Two');
    await friend.getByRole('button',{name:/НЭВТРЭХ/}).click();
    await expect(friend.locator('.room-info strong')).toHaveText(room,{timeout:10000});
    await expect(page.locator('.room-meta')).toContainText('2 / 6');

    await page.getByRole('button',{name:/БЭЛЭН/}).click();
    await friend.getByRole('button',{name:/БЭЛЭН/}).click();
    await expect(page).toHaveURL(/\/multiplayer\/race$/,{timeout:10000});
    await expect(page.locator('.multiplayer-track')).toBeVisible();
    const progress=page.locator('.room-meta');
    await expect(progress).toContainText('2 / 6');
    // Reload tears down the browser WebSocket. The same sessionStorage token
    // must restore this slot before the 15-second reconnect grace expires.
    await page.reload();
    await expect(page.locator('.room-info strong')).toHaveText(room,{timeout:10000});
    await expect(page.locator('.room-meta')).toContainText('2 / 6');
    await expect(page.locator('.multiplayer-track')).toBeVisible();
    expect(await page.evaluate(code=>sessionStorage.getItem('typeracer.private.'+code+'.resume'),room))
      .toBe(token);
    await expect(friend.locator('.room-meta')).toContainText('2 / 6');
    const body=await page.locator('.room-active').innerText();
    expect(body).not.toContain(token!);
  }finally{await second.close();}
});
