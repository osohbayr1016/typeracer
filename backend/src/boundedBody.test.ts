import {describe,expect,it} from 'vitest';
import {readBoundedJsonObject,readBoundedText} from './boundedBody';

const encoder=new TextEncoder();
function streamed(chunks:Uint8Array[],headers?:HeadersInit):Request {
  const body=new ReadableStream<Uint8Array>({
    start(controller){for(const chunk of chunks)controller.enqueue(chunk);controller.close();}
  });
  return new Request('https://room.internal/progression/items',{
    method:'POST',headers,body,duplex:'half'
  } as RequestInit);
}

describe('bounded request body parser',()=>{
  it('reads an exact-size Unicode JSON object without splitting multi-byte characters',async()=>{
    const json=JSON.stringify({name:'Өлзий'});
    const bytes=encoder.encode(json);
    const request=streamed([bytes.slice(0,3),bytes.slice(3,7),bytes.slice(7)]);
    expect(await readBoundedJsonObject(request,bytes.length)).toEqual({ok:true,value:{name:'Өлзий'}});
  });
  it('rejects an oversized streamed body even without Content-Length',async()=>{
    const request=streamed([encoder.encode('{"name":"'),encoder.encode('Олон олон тэмдэгт"}')]);
    expect(await readBoundedJsonObject(request,16)).toEqual({ok:false,reason:'too_large'});
  });
  it('does not trust a claimed short Content-Length over observed bytes',async()=>{
    const request=streamed([encoder.encode('{"name":"extra"}')],{'Content-Length':'2'});
    expect(await readBoundedJsonObject(request,6)).toEqual({ok:false,reason:'too_large'});
  });
  it('rejects oversized advertised Content-Length before reading',async()=>{
    const request=streamed([encoder.encode('{}')],{'Content-Length':'999999'});
    expect(await readBoundedJsonObject(request,32)).toEqual({ok:false,reason:'too_large'});
  });
  it('rejects malformed JSON and scalar/array JSON instead of trusting them as request objects',async()=>{
    for(const input of ['{bad','[]','null','"string"','7']){
      expect(await readBoundedJsonObject(streamed([encoder.encode(input)]),100))
        .toEqual({ok:false,reason:'invalid_request'});
    }
  });
  it('rejects malformed UTF-8 rather than changing signed payload bytes',async()=>{
    expect(await readBoundedText(streamed([new Uint8Array([0xc3,0x28])]),10))
      .toEqual({ok:false,reason:'invalid_body'});
  });
  it('handles an empty request body',async()=>{
    expect(await readBoundedText(new Request('https://room.internal/test'),10))
      .toEqual({ok:true,text:''});
  });
});
