import { describe, expect, it } from 'vitest';
import { QUICK_BOT_JOIN_MS, QUICK_BOT_ROSTER, QUICK_LANES, QUICK_MAX_HUMANS,
  QUICK_PRIZES, quickBotForSlot, quickPlacement, quickPrize, quickAwardCoins, connectedHumanCount } from './quick';

describe('five-racer quick lobby mechanics', () => {
  it('requires online unique accounts; duplicate tabs and disconnect grace are not PvP',()=>{
    const up={readyState:1},down={readyState:3};
    const racers=[
      {id:'a',accountId:'same',socket:up},
      {id:'b',accountId:'same',socket:up},
      {id:'c',accountId:'other',socket:down}
    ];
    expect(connectedHumanCount(racers)).toBe(1);
    expect(connectedHumanCount([...racers,{id:'d',accountId:'another',socket:up}])).toBe(2);
    expect(connectedHumanCount([{id:'guest1',accountId:null,socket:up},
      {id:'guest2',accountId:null,socket:up}])).toBe(2);
  });

  it('has enough distinct original bot identities to fill an otherwise empty five-racer queue', () => {
    expect(QUICK_LANES).toBe(5);
    expect(QUICK_MAX_HUMANS).toBe(5);
    expect(QUICK_BOT_JOIN_MS * 4).toBeLessThan(5000);
    expect(new Set(QUICK_BOT_ROSTER.map(bot => bot.name)).size).toBe(QUICK_BOT_ROSTER.length);
    for (let offset = 0; offset < QUICK_BOT_ROSTER.length; offset++) {
      const group = Array.from({ length: 4 }, (_, index) => quickBotForSlot(offset, index));
      expect(new Set(group.map(bot => bot.name)).size).toBe(4);
      expect(group.every(bot => bot.pace > 0)).toBe(true);
    }
  });
  it('awards five deterministic virtual prize positions and no uncompleted rewards', () => {
    expect(QUICK_PRIZES).toHaveLength(5);
    expect([...QUICK_PRIZES]).toEqual([30,27,24,21,18]);
    expect(QUICK_PRIZES.every(x=>x>=18&&x<=30)).toBe(true);
    expect(QUICK_PRIZES.every((x,i)=>i===0||x<QUICK_PRIZES[i-1])).toBe(true);
    for (let place = 1; place <= 5; place++) {
      expect(quickPrize(place, true)).toBe(QUICK_PRIZES[place - 1]);
      expect(quickPrize(place, false)).toBe(0);
    }
    expect(quickPrize(6, false)).toBe(0);
  });
  it('shows no phantom prize for a finish ineligible for authoritative XP/coins', () => {
    expect(quickAwardCoins(1,true,80,95)).toBe(30);
    expect(quickAwardCoins(3,true,80,70)).toBe(24);
    expect(quickAwardCoins(1,true,80,69)).toBe(0);
    expect(quickAwardCoins(1,true,211,95)).toBe(0);
    expect(quickAwardCoins(1,true,Number.NaN,95)).toBe(0);
    expect(quickAwardCoins(1,false,80,95)).toBe(0);
  });
  it('places racers by server-recorded completedAt and does not rank bots as players', () => {
    const racer = (id: string, at: number | null) => ({
      id, name: id, progress: 5, strokes: 5, mistakes: 0,
      ready: true, completedAt: at
    });
    expect(quickPlacement(racer('me', 200), [
      racer('fast', 150), racer('me', 200), racer('slow', 270)
    ])).toBe(2);
  });
});
