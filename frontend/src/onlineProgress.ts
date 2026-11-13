export type EarnedOnlineProfile = {
  xp:number; coins:number; races:number; seasonXp:number; level:number;
  stats?:{bestWpm:number;avgWpm:number;avgAccuracy:number;lastRacedAt:number|null};
  owned:string[]; source:'server'; starter:number;
  season:{id:string;number:number;name:string;from:number;until:number;
    xp:number;remainingDays:number;rewards:Array<{
      tier:number;xp:number;coins:number;itemKey:string|null;name:string;
      claimed:boolean;claimable:boolean;
    }>};
  daily:{day:string;quests:Array<{
    id:'first-finish'|'precision'|'speed';name:string;detail:string;target:number;
    coins:number;progress:number;done:boolean;claimed:boolean;
  }>};
  equipped:{car:string;trail:string;title:string;sticker:string};
  recent:Array<{raceId:string;xp:number;coins:number;wpm:number;accuracy:number;finishedAt:number}>;
};
export async function onlineProgressApi<T>(path='',body?:object):Promise<T> {
  const response=await fetch('/api/progression'+path,{
    credentials:'same-origin',
    ...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})
  });
  const payload=await response.json() as {error?:string};
  if(!response.ok) {
    const messages:Record<string,string>={
      session_required:'Нэвтрэлтийн session олдсонгүй. Хуудсыг дахин нээнэ үү.',
      already_owned:'Энэ зүйл аль хэдийн таны цуглуулгад байна.',
      level_required:'Онлайн түвшин хүрэхгүй байна.',
      insufficient_earned_coins:'Онлайн уралдааны зоос хүрэлцэхгүй байна.',
      not_found:'Бараа олдсонгүй.',
      invalid_quest:'Өдрийн даалгавар олдсонгүй.',
      already_claimed:'Энэ даалгаврын шагналыг авсан байна.',
      not_complete:'Шагнал авахад шаардлагатай XP/даалгавар дуусаагүй.',
      legacy_season:'Энэ улирлын хуучин шагналыг тухайн төхөөрөмжөөс авна.',
      invalid_tier:'Улирлын шагналын шат хүчингүй.'
    };
    throw Error(messages[payload.error??'']??'Онлайн ахицын сервертэй холбогдож чадсангүй.');
  }
  return payload as T;
}
