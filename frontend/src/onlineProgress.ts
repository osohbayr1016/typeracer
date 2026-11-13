export type EarnedOnlineProfile = {
  xp:number; coins:number; races:number; seasonXp:number; level:number;
  owned:string[]; source:'server'; starter:number;
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
      not_found:'Бараа олдсонгүй.'
    };
    throw Error(messages[payload.error??'']??'Онлайн ахицын сервертэй холбогдож чадсангүй.');
  }
  return payload as T;
}
