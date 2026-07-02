import fs from 'node:fs';
import path from 'node:path';
import { Cache } from '../client/cache.js';
import type { SessionStore } from './sessionStore.js';
import type { UserSession } from './types.js';

type SerializedSession = Omit<UserSession, 'cache'>;

export class FileSessionStore implements SessionStore {
  private sessions = new Map<string, UserSession>();
  private readonly filePath: string;
  private readonly tmpPath: string;

  constructor(storePath: string) {
    this.filePath = storePath;
    this.tmpPath = storePath + '.tmp';
    this.load();
  }

  set(token: string, session: UserSession): void {
    this.sessions.set(token, session);
    this.persist();
  }

  get(token: string): UserSession | undefined {
    const session = this.sessions.get(token);
    if (!session) return undefined;
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(token);
      this.persist();
      return undefined;
    }
    return session;
  }

  delete(token: string): void {
    this.sessions.delete(token);
    this.persist();
  }

  size(): number {
    return this.sessions.size;
  }

  startCleanup(intervalMs = 300_000): void {
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [token, session] of this.sessions) {
        if (session.expiresAt < now) {
          this.sessions.delete(token);
          changed = true;
        }
      }
      if (changed) this.persist();
    }, intervalMs).unref();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const records: SerializedSession[] = JSON.parse(raw);
      const now = Date.now();
      for (const record of records) {
        if (record.expiresAt < now) continue;
        this.sessions.set(record.token, { ...record, cache: new Cache() });
      }
      console.log(`[session-store] Loaded ${this.sessions.size} session(s) from disk`);
    } catch (err) {
      console.error('[session-store] Failed to load sessions from disk:', (err as Error).message);
    }
  }

  private persist(): void {
    try {
      const records: SerializedSession[] = [];
      for (const session of this.sessions.values()) {
        const { cache: _cache, ...rest } = session;
        records.push(rest);
      }
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.tmpPath, JSON.stringify(records, null, 2), 'utf-8');
      fs.renameSync(this.tmpPath, this.filePath);
    } catch (err) {
      console.error('[session-store] Failed to persist sessions to disk:', (err as Error).message);
    }
  }
}
