import { describe, expect, it, vi } from 'vitest';
import { applyLocalKey, INITIAL_LOCAL_PROGRESS, sendRaceKey } from './typingSync';

describe('quick race local typing and WebSocket failure recovery', () => {
  it('keeps local progress unchanged if a disconnected socket refuses the send', () => {
    const send = vi.fn(() => false);
    const next = applyLocalKey(INITIAL_LOCAL_PROGRESS, 'Өвөл', 'Ө', true, send);
    expect(send).toHaveBeenCalledExactlyOnceWith('Ө');
    expect(next).toBe(INITIAL_LOCAL_PROGRESS);
  });
  it('sends one real Cyrillic key and shows the caret immediately for a connected socket', () => {
    const send = vi.fn();
    const socket = { readyState: 1, send };
    const keySender = (key: string) => sendRaceKey(socket, key);
    const first = applyLocalKey(INITIAL_LOCAL_PROGRESS, 'Өвөл', 'Ө', true, keySender);
    expect(first).toEqual({ progress: 1, strokes: 1, mistakes: 0, wrong: false });
    const wrong = applyLocalKey(first, 'Өвөл', 'x', true, keySender);
    expect(wrong).toEqual({ progress: 1, strokes: 2, mistakes: 1, wrong: true });
    expect(send).toHaveBeenNthCalledWith(1, JSON.stringify({type:'key', key:'Ө'}));
    expect(send).toHaveBeenNthCalledWith(2, JSON.stringify({type:'key', key:'x'}));
  });
  it('rejects paste, disabled input, closed sockets and throwing send without phantom progress', () => {
    const send = vi.fn(() => true);
    expect(applyLocalKey(INITIAL_LOCAL_PROGRESS, 'Өвөл', 'Өв', true, send)).toBe(INITIAL_LOCAL_PROGRESS);
    expect(applyLocalKey(INITIAL_LOCAL_PROGRESS, 'Өвөл', 'Ө', false, send)).toBe(INITIAL_LOCAL_PROGRESS);
    expect(send).not.toHaveBeenCalled();
    expect(sendRaceKey(null, 'Ө')).toBe(false);
    expect(sendRaceKey({readyState: 3, send: vi.fn()}, 'Ө')).toBe(false);
    expect(sendRaceKey({readyState: 1, send: () => {throw new Error('closed during send');}}, 'Ө')).toBe(false);
  });
});
