import { describe,expect,it,vi,afterEach } from 'vitest';
import { authorizeUrl,callbackUrl,exchangeProviderIdentity,isOAuthProvider,providerReady } from './oauth';
const env={
  GOOGLE_CLIENT_ID:'google-public-id',GOOGLE_CLIENT_SECRET:'never-expose-google-secret',
  FACEBOOK_APP_ID:'fb-public-id',FACEBOOK_APP_SECRET:'never-expose-fb-secret'
};
const state='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
afterEach(()=>vi.unstubAllGlobals());
describe('Google and Facebook OAuth confidential flow',()=>{
  it('fails closed if provider credentials are missing and validates provider identifiers',()=>{
    expect(providerReady({},'google')).toBe(false);
    expect(providerReady({GOOGLE_CLIENT_ID:'public'},'google')).toBe(false);
    expect(providerReady({},'facebook')).toBe(false);
    expect(isOAuthProvider('google')).toBe(true);
    expect(isOAuthProvider('facebook')).toBe(true);
    expect(isOAuthProvider('evil.com')).toBe(false);
    expect(()=>authorizeUrl('google',{},'https://typeracer.example',state)).toThrow();
    expect(()=>authorizeUrl('google',env,'https://typeracer.example','evil')).toThrow();
  });
  it('uses a fixed callback and state, and never leaks client secrets in the authorize redirect',()=>{
    const google=new URL(authorizeUrl('google',env,'https://typeracer.example',state));
    expect(google.hostname).toBe('accounts.google.com');
    expect(google.searchParams.get('state')).toBe(state);
    expect(google.searchParams.get('scope')).toBe('openid profile');
    expect(google.searchParams.get('redirect_uri')).toBe(callbackUrl('google','https://typeracer.example'));
    expect(google.toString()).not.toContain(env.GOOGLE_CLIENT_SECRET);
    const fb=new URL(authorizeUrl('facebook',env,'https://typeracer.example',state));
    expect(fb.hostname).toBe('www.facebook.com');
    expect(fb.searchParams.get('redirect_uri')).toContain('facebook/callback');
    expect(fb.toString()).not.toContain(env.FACEBOOK_APP_SECRET);
  });
  it('exchanges codes confidentially and reads identity ONLY from authenticated provider userinfo',async()=>{
    const requests:Array<{url:string;headers?:HeadersInit;body?:BodyInit|null}>=[];
    vi.stubGlobal('fetch',vi.fn(async(input:string|URL,init?:RequestInit)=>{
      requests.push({url:String(input),headers:init?.headers,body:init?.body});
      if(String(input).includes('oauth2.googleapis.com/token'))
        return new Response(JSON.stringify({access_token:'real-token-123456789'}),{status:200});
      if(String(input).includes('openidconnect.googleapis.com'))
        return new Response(JSON.stringify({sub:'verified-google-identity',name:'Өлзий'}),{status:200});
      throw Error('unexpected endpoint');
    }));
    const identity=await exchangeProviderIdentity('google',env,'https://typeracer.example','abc123');
    expect(identity).toEqual({providerSubject:'verified-google-identity',displayName:'Өлзий'});
    expect(requests[0].url).toBe('https://oauth2.googleapis.com/token');
    expect(String(requests[0].body)).toContain('never-expose-google-secret');
    expect(requests[1].url).toBe('https://openidconnect.googleapis.com/v1/userinfo');
    expect(JSON.stringify(requests)).not.toContain('client_secret=evil');
  });
  it('rejects malformed userinfo and never accepts user identity directly from browser callback',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(input:string|URL)=>{
      if(String(input).includes('/token'))return new Response(JSON.stringify({access_token:'real-token-123456789'}));
      return new Response(JSON.stringify({sub:'bad id with spaces',name:'Fake'}));
    }));
    await expect(exchangeProviderIdentity('google',env,'https://typeracer.example','abc')).rejects.toThrow('Provider identity absent');
  });
});
