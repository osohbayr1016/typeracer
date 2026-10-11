import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const panel = readFileSync(fileURLToPath(new URL('./QuickTypingPanel.tsx', import.meta.url)), 'utf8');
const race = readFileSync(fileURLToPath(new URL('./QuickRacePage.tsx', import.meta.url)), 'utf8');

describe('quick race disconnected typing guard', () => {
  it('does not commit optimistic progress until sendKey succeeds', () => {
    expect(panel).toContain('if (!sendKey(key)) return;');
    expect(panel.indexOf('if (!sendKey(key)) return;')).toBeLessThan(panel.indexOf('localRef.current = next;', panel.indexOf('function acceptInput')));
  });
  it('does not send on closed sockets and catches send exceptions', () => {
    expect(race).toContain('socket.readyState !== WebSocket.OPEN) return false');
    expect(race).toContain('catch { return false; }');
  });
});
