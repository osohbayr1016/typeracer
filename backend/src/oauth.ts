/** Confidential Google/Facebook OAuth. Client secrets never reach the browser. */
export type OAuthProvider = 'google'|'facebook';
export type OAuthEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  OAUTH_REDIRECT_ORIGIN?: string;
};
export function isOAuthProvider(x:string):x is OAuthProvider {return x==='google'||x==='facebook';}
export function providerReady(env:OAuthEnv,p:OAuthProvider):boolean {
  return p==='google'?!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET):
    !!(env.FACEBOOK_APP_ID&&env.FACEBOOK_APP_SECRET);
}
export function callbackUrl(provider:OAuthProvider,origin:string):string {
  return origin.replace(/\/$/,'')+'/api/auth/'+provider+'/callback';
}
export function authorizeUrl(provider:OAuthProvider,env:OAuthEnv,origin:string,state:string):string {
  if (!providerReady(env,provider) || !/^[0-9a-f-]{36}$/.test(state))
    throw Error('Provider is not configured or state invalid');
  if (provider==='google'){
    const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search=new URLSearchParams({
      client_id:env.GOOGLE_CLIENT_ID!,redirect_uri:callbackUrl(provider,origin),
      response_type:'code',scope:'openid profile',state,
      access_type:'online',prompt:'select_account'
    }).toString();return u.toString();
  }
  const u=new URL('https://www.facebook.com/v21.0/dialog/oauth');
  u.search=new URLSearchParams({
    client_id:env.FACEBOOK_APP_ID!,redirect_uri:callbackUrl(provider,origin),
    response_type:'code',scope:'public_profile',state
  }).toString();return u.toString();
}
type Token = {access_token?:unknown};
type Userinfo = {sub?:unknown;id?:unknown;name?:unknown};
const checkedJSON = async <T>(response:Response):Promise<T>=>{
  if(!response.ok)throw Error('OAuth provider rejected the code');
  const obj:unknown=await response.json();
  if(!obj||typeof obj!=='object')throw Error('OAuth provider returned invalid JSON');
  return obj as T;
};
/** Never trust a callback-provided user ID. Fetch identity from provider using
 * an access token received through a confidential server-to-server exchange.
 */
export async function exchangeProviderIdentity(provider:OAuthProvider,env:OAuthEnv,origin:string,code:string):
 Promise<{providerSubject:string;displayName:string}> {
  if (!providerReady(env,provider)||!code||code.length>4096)throw Error('OAuth code/config invalid');
  const callback=callbackUrl(provider,origin);
  let token:Token;
  if(provider==='google'){
    token=await checkedJSON<Token>(await fetch('https://oauth2.googleapis.com/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID!,
        client_secret:env.GOOGLE_CLIENT_SECRET!,redirect_uri:callback,grant_type:'authorization_code'})
    }));
  }else{
    // Facebook Graph accepts app credentials and authorization code over HTTPS.
    const url=new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    url.search=new URLSearchParams({client_id:env.FACEBOOK_APP_ID!,
      client_secret:env.FACEBOOK_APP_SECRET!,redirect_uri:callback,code}).toString();
    token=await checkedJSON<Token>(await fetch(url));
  }
  if(typeof token.access_token!=='string'||token.access_token.length<10)
    throw Error('OAuth token exchange failed');
  const endpoint=provider==='google'
    ?'https://openidconnect.googleapis.com/v1/userinfo':'https://graph.facebook.com/v21.0/me?fields=id,name';
  const who=await checkedJSON<Userinfo>(await fetch(endpoint,{
    headers:{Authorization:'Bearer '+token.access_token}
  }));
  const id=provider==='google'?who.sub:who.id;
  if(typeof id!=='string'||!id||id.length>128||!/[\w.:-]+/.test(id))throw Error('Provider identity absent');
  return {providerSubject:id,displayName:typeof who.name==='string'?who.name.slice(0,80):'Тоглогч'};
}
