import { describe,expect,it } from 'vitest';
import { type Racer, type RoomSnapshot } from '@typeracer/shared';
import { raceStandings, type QuickRaceOutcome } from './quickResultsModel';

function racer(id:string, progress:number, completedAt:number|null, bot=false): Racer {
  return {id,name:id,car:'sunset',trail:'none',sticker:'none',progress,
    mistakes:0,strokes:progress,completedAt,ready:true,bot};
}
const time = 1_760_000_000_000;
function result(players:Racer[], place:number|null, withFinal=false):QuickRaceOutcome {
  const snapshot = {type:'state',mode:'quick',matchId:'sample',phase:'racing',
    prompt:{id:'sample',text:'Өвөл',language:'mn'},startAt:time-60000,players} as RoomSnapshot;
  return {snapshot, playerId:'mine',at:time,
    result:{type:'quick-result',raceId:'00000000-0000-4000-8000-000000000000',place,
      coins:place?120:0,wpm:82,accuracy:98,elapsedMs:60000,verified:false,
      standings:withFinal?players:undefined}};
}
describe('real server-backed quick match rankings', () => {
  it('ranks completed racers by finish time, unfinished racers by progress',()=>{
    const players=[racer('mine',4,time-1000),racer('earlier',4,time-3000,true),
      racer('typing',3,null,true),racer('later',4,time-500,true)];
    const rank=raceStandings(result(players,2));
    expect(rank.map(x=>x.player.id)).toEqual(['earlier','mine','later','typing']);
    expect(rank.map(x=>x.finished)).toEqual([true,true,true,false]);
    expect(rank[3].percent).toBe(75);
    expect(rank[1].percent).toBe(100);
  });
  it('officially completed self remains at finish even when result precedes state broadcast',()=>{
    const resultBeforeState=result([racer('mine',3,null),racer('bot',2,null,true)],1);
    const rank=raceStandings(resultBeforeState);
    expect(rank[0].player.id).toBe('mine');
    expect(rank[0]).toMatchObject({finished:true,percent:100});
    expect(rank[1]).toMatchObject({finished:false,percent:50});
  });
  it('does not pretend an unfinished player crossed finish',()=>{
    const rank=raceStandings(result([racer('mine',2,null),racer('fastbot',4,time-1000,true)],null));
    expect(rank[0].player.id).toBe('fastbot');
    expect(rank[1]).toMatchObject({finished:false,percent:50});
  });
});
