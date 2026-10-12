import { afterEach, describe, expect, it, vi } from 'vitest';
import app from './index';
import { strictHttpsOrigin } from './oauth-origin';

// Exercise Hono HTTP routes: checking source text would not catch insecure
// runtime fallback to the request Host or an enabled but unusable login button.
const endpoint = 'https://race.example';
const providerSecrets = {
  GOOGLE_CLIENT_ID: 'google-client',
  GOOGLE_CLIENT_SECRET: 'google-private-secret',
  FACEBOOK_APP_ID: 'facebook-client',
  FACEBOOK_APP_SECRET: 'facebook-private-secret',
};

function stubEnvironment(configuredOrigin?: string) {
  const fetchRoom = vi.fn(async () => new Response(null, { status: 200 }));
  const idFromName = vi.fn(() => 'room-id');
  const get = vi.fn(() => ({ fetch: fetchRoom }));
  const env = {
    ...providerSecrets,
    OAUTH_REDIRECT_ORIGIN: configuredOrigin,
    RACE_ROOMS: { idFromName, get },
  } as unknown as NonNullable<Parameters<typeof app.request>[2]>;
  return { env, fetchRoom, idFromName, get };
}

afterEach(() => vi.unstubAllGlobals());

describe('OAuth configured origin validation', () => {
  it('accepts only an absolute configured HTTPS origin', () => {
    expect(strictHttpsOrigin('https://race.example')).toBe(endpoint);
    expect(strictHttpsOrigin(' https://race.example/ ')).toBe(endpoint);
    for (const value of [
      undefined, '', 'http://race.example', '//race.example', 'https://race.example.evil.test/path',
      'https://race.example/callback', 'https://race.example?redirect=evil',
      'https://user:pass@race.example', 'https://race.example#fragment',
      'javascript:alert(1)',
    ]) expect(strictHttpsOrigin(value)).toBeNull();
  });

  it('keeps provider buttons disabled unless matching HTTPS origin and secrets exist', async () => {
    for (const [origin, requestUrl] of [
      [undefined, endpoint], ['http://race.example', endpoint],
      [endpoint, 'https://evil.example'], [endpoint, 'http://race.example'],
    ] as const) {
      const { env } = stubEnvironment(origin);
      const response = await app.request(requestUrl + '/api/auth/providers', undefined, env);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ google: false, facebook: false });
    }
    const { env } = stubEnvironment(endpoint);
    const response = await app.request(endpoint + '/api/auth/providers', undefined, env);
    expect(await response.json()).toEqual({ google: true, facebook: true });
  });

  it('rejects missing or mismatched origin BEFORE opening a Durable Object session', async () => {
    for (const [origin, requestUrl] of [
      [undefined, endpoint], ['http://race.example', endpoint],
      [endpoint, 'https://untrusted.example'],
    ] as const) {
      const { env, idFromName, get } = stubEnvironment(origin);
      const response = await app.request(requestUrl + '/api/auth/google/start', undefined, env);
      expect(response.status).toBe(403);
      expect(idFromName).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
      expect(response.headers.get('location')).toBeNull();
    }
  });

  it('uses the configured origin in the actual Google authorization redirect', async () => {
    const { env, fetchRoom } = stubEnvironment(endpoint);
    const response = await app.request(endpoint + '/api/auth/google/start', undefined, env);
    expect(response.status).toBe(302);
    const redirected = new URL(response.headers.get('location')!);
    expect(redirected.origin).toBe('https://accounts.google.com');
    expect(redirected.searchParams.get('redirect_uri'))
      .toBe(endpoint + '/api/auth/google/callback');
    expect(redirected.searchParams.get('state')).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchRoom).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid callback origin before contacting the OAuth provider', async () => {
    const providerFetch = vi.fn();
    vi.stubGlobal('fetch', providerFetch);
    const { env, fetchRoom } = stubEnvironment(endpoint);
    const response = await app.request(
      'https://untrusted.example/api/auth/google/callback?state=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&code=test-code',
      undefined, env
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/profile?auth=origin');
    expect(providerFetch).not.toHaveBeenCalled();
    expect(fetchRoom).not.toHaveBeenCalled();
  });
});
