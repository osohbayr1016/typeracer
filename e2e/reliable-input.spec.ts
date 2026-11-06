import { test, expect } from '@playwright/test';

test('a dropped first key is retransmitted and server progress catches the immediate caret',async({page})=>{
  await page.addInitScript(()=>{
    const Native=window.WebSocket;
    class DroppedKeySocket extends Native {
      private dropped=false;
      private playerId='';
      constructor(url:string|URL,protocols?:string|string[]){
        super(url,protocols);
        this.addEventListener('message',event=>{
          const value=JSON.parse(String(event.data));
          if(value.type==='welcome')this.playerId=value.id;
          if(value.type==='state'){
            const self=value.players.find((player:{id:string})=>player.id===this.playerId);
            (window as Window & {confirmedInputSeq?:number}).confirmedInputSeq=self?.inputSeq;
          }
        });
      }
      send(raw:string|ArrayBufferLike|Blob|ArrayBufferView){
        if(typeof raw==='string'){
          const value=JSON.parse(raw);
          if(value.type==='key' && !this.dropped){this.dropped=true;return;}
        }
        super.send(raw);
      }
    }
    window.WebSocket=DroppedKeySocket;
  });
  await page.goto('/quick-race');
  const input=page.getByRole('textbox',{name:'Шууд уралдааны бичих талбар'});
  await expect(input).toHaveAttribute('data-race-enabled','true',{timeout:14000});
  const text=await page.locator('.quick-phrase').innerText();
  await input.pressSequentially(text.slice(0,3),{delay:50});
  await expect(page.locator('.quick-phrase .typed')).toHaveCount(3,{timeout:1000});
  const expected=Math.round(3/Array.from(text.normalize('NFC')).length*100)+'%';
  await expect(page.locator('.quick-lane.me .quick-lane-meta b')).toHaveText(expected,{timeout:2000});
  await expect.poll(()=>page.evaluate(()=>(window as Window & {confirmedInputSeq?:number}).confirmedInputSeq),{timeout:3000}).toBe(3);
  // Disconnect/reconnect clears the prediction component and exposes the server's confirmed prefix.
  await page.reload();
  await expect(input).toHaveAttribute('data-race-enabled','true',{timeout:5000});
  await expect(page.locator('.quick-phrase .typed')).toHaveCount(3,{timeout:2000});
});
