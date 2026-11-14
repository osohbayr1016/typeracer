/** Enforce a byte limit while reading, rather than after Request.text()/json()
 * has already buffered an arbitrarily large upload. Safe for streamed bodies
 * without Content-Length, including Cloudflare's chunked requests.
 */
export type BoundedText =
  | {ok:true;text:string}
  | {ok:false;reason:'too_large'|'invalid_body'};

export async function readBoundedText(request:Request,maxBytes:number):Promise<BoundedText> {
  if(!Number.isSafeInteger(maxBytes)||maxBytes<0)throw Error('Invalid request body limit');
  const declared=request.headers.get('Content-Length');
  if(declared!==null && /^\\d+$/.test(declared) && Number(declared)>maxBytes)
    return {ok:false,reason:'too_large'};
  if(!request.body)return {ok:true,text:''};
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let size=0;
  try {
    for(;;){
      const next=await reader.read();
      if(next.done)break;
      size+=next.value.byteLength;
      if(size>maxBytes){
        await reader.cancel();
        return {ok:false,reason:'too_large'};
      }
      chunks.push(next.value);
    }
    const bytes=new Uint8Array(size);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return {ok:true,text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};
  }catch{return {ok:false,reason:'invalid_body'};}
  finally{reader.releaseLock();}
}

export type BoundedJson =
  | {ok:true;value:Record<string,unknown>}
  | {ok:false;reason:'too_large'|'invalid_request'};

export async function readBoundedJsonObject(request:Request,maxBytes:number):Promise<BoundedJson>{
  const body=await readBoundedText(request,maxBytes);
  if(!body.ok)return {ok:false,reason:body.reason==='too_large'?'too_large':'invalid_request'};
  try{
    const value:unknown=JSON.parse(body.text);
    if(!value||typeof value!=='object'||Array.isArray(value))
      return {ok:false,reason:'invalid_request'};
    return {ok:true,value:value as Record<string,unknown>};
  }catch{return {ok:false,reason:'invalid_request'};}
}
