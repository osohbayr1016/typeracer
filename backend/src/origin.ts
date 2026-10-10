/**
 * Browser access is same-origin in production. Vite's local proxy is the only
 * deliberately accepted cross-port origin, and ONLY on localhost.
 * This is CSRF/drive-by-browser hardening, not authentication.
 */
export function originAllowed(origin: string | undefined, requestUrl: string): boolean {
  if (!origin) return true; // CLI/non-browser clients may omit Origin.
  try {
    const request = new URL(requestUrl);
    const claimed = new URL(origin);
    if (!['http:', 'https:'].includes(claimed.protocol) || claimed.origin !== origin) return false;
    if (claimed.origin === request.origin) return true;
    const localHosts = new Set(['localhost', '127.0.0.1']);
    return localHosts.has(request.hostname) && localHosts.has(claimed.hostname)
      && claimed.protocol === 'http:' && claimed.port === '5173';
  } catch {
    return false;
  }
}
