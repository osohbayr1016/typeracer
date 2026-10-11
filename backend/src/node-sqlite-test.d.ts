/**
 * Test-only declarations for Node 22's built-in node:sqlite (no dependency).
 * Worker compilation targets Cloudflare types, not @types/node; runtime source
 * does not import node:sqlite. This file is strictly a test adapter contract.
 */
declare module 'node:sqlite' {
  type SqliteParameter = string | number | bigint | null;
  export class DatabaseSync {
    constructor(filename: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
  export class StatementSync {
    all(...params: SqliteParameter[]): Array<Record<string, unknown>>;
    get(...params: SqliteParameter[]): Record<string, unknown> | undefined;
    run(...params: SqliteParameter[]): unknown;
  }
}
