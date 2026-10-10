import { describe, expect, it } from 'vitest';
import { originAllowed } from './origin';

describe('API browser origin policy', () => {
  const deployed = 'https://mongolian-typeracer-staging.example.workers.dev/api/rooms';
  it('accepts same-origin deployment requests', () => {
    expect(originAllowed('https://mongolian-typeracer-staging.example.workers.dev', deployed)).toBe(true);
  });
  it('rejects cross-origin, opaque and deceptively similar hosts', () => {
    expect(originAllowed('https://attacker.example', deployed)).toBe(false);
    expect(originAllowed('https://mongolian-typeracer-staging.example.workers.dev.evil.com', deployed)).toBe(false);
    expect(originAllowed('null', deployed)).toBe(false);
    expect(originAllowed('http://localhost:5173', deployed)).toBe(false);
  });
  it('permits Vite proxy only for a local target', () => {
    expect(originAllowed('http://localhost:5173', 'http://127.0.0.1:8787/api/rooms')).toBe(true);
    expect(originAllowed('http://127.0.0.1:5173', 'http://127.0.0.1:8787/api/rooms')).toBe(true);
  });
  it('does not mistake non-local endpoints for local ones', () => {
    expect(originAllowed('http://localhost:5173', 'https://production.workers.dev/api/rooms')).toBe(false);
    expect(originAllowed('https://attacker.example', 'http://127.0.0.1:8787/api/rooms')).toBe(false);
  });
  it('accepts clients without Origin while requiring browser origins to be valid', () => {
    expect(originAllowed(undefined, deployed)).toBe(true);
    expect(originAllowed('garbage', deployed)).toBe(false);
  });
});
