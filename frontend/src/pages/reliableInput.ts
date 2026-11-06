import { advanceTyping, characters, typingKey, type TypingProgress } from '@typeracer/shared';
type Socket = { readyState: number; bufferedAmount?: number; send: (value: string) => void } | null;
type Confirmation = { seq: number; progress: number; strokes: number; mistakes: number; wrong?: boolean };
export const MAX_PENDING_KEYS = 64;
export const MAX_SOCKET_BUFFER = 32_768;

/** In-memory resend queue belongs to one match. It never stores a finished passage. */
export class ReliableRaceInput {
  private letters: string[];
  private confirmed: Confirmation = { seq: 0, progress: 0, strokes: 0, mistakes: 0 };
  private pending: Array<{ seq: number; key: string; at: number }> = [];
  private nextSeq = 1;
  private lastFlush = -Infinity;
  private predicted: TypingProgress = { progress: 0, strokes: 0, mistakes: 0, wrong: false };
  constructor(readonly matchId: string, text: string) { this.letters = characters(text); }
  get prediction() { return this.predicted; }
  get pendingCount() { return this.pending.length; }
  get acknowledgedSeq() { return this.confirmed.seq; }
  delayed(now: number) { return !!this.pending.length && now - this.pending[0].at > 1500; }
  private canSend(socket: Socket) {
    return socket?.readyState === 1 && (socket.bufferedAmount ?? 0) < MAX_SOCKET_BUFFER;
  }
  private encode(seq: number, key: string) {
    return JSON.stringify({ type: 'key', key, seq, matchId: this.matchId });
  }
  enqueue(value: string, socket: Socket, now: number): boolean {
    const key = typingKey(value);
    if (key === null || !this.canSend(socket) || this.pending.length >= MAX_PENDING_KEYS ||
        this.predicted.progress >= this.letters.length) return false;
    const seq = this.nextSeq;
    try { socket!.send(this.encode(seq, key)); } catch { return false; }
    this.nextSeq++;
    this.pending.push({ seq, key, at: now });
    this.predicted = advanceTyping(this.letters, this.predicted, key);
    return true;
  }
  acknowledge(value: Confirmation) {
    if (!Number.isSafeInteger(value.seq) || value.seq < this.confirmed.seq || value.seq < 0 ||
        ![value.progress, value.strokes, value.mistakes].every(Number.isSafeInteger) ||
        value.progress < 0 || value.progress > this.letters.length || value.mistakes < 0 ||
        value.strokes < value.mistakes || value.progress > value.strokes - value.mistakes) return;
    this.confirmed = value;
    this.nextSeq = Math.max(this.nextSeq, value.seq + 1);
    this.pending = this.pending.filter(key => key.seq > value.seq);
    let next: TypingProgress = { progress: value.progress, strokes: value.strokes, mistakes: value.mistakes, wrong: value.wrong ?? false };
    for (const key of this.pending) next = advanceTyping(this.letters, next, key.key);
    const old = this.predicted;
    if (old.progress !== next.progress || old.strokes !== next.strokes || old.mistakes !== next.mistakes || old.wrong !== next.wrong)
      this.predicted = next;
  }
  flush(socket: Socket, now: number) {
    if (!this.canSend(socket) || now - this.lastFlush < 450) return;
    this.lastFlush = now;
    for (const key of this.pending.slice(0, 32)) {
      if (!this.canSend(socket)) break;
      try { socket!.send(this.encode(key.seq, key.key)); } catch { break; }
    }
  }
}
