/** Require a configured, absolute HTTPS origin for social-login redirects. */
export function strictHttpsOrigin(value: string | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.origin !== raw.replace(/\/$/, '')) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}
