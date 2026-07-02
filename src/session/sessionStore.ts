import type { UserSession } from './types.js';

export interface SessionStore {
  set(token: string, session: UserSession): void;
  get(token: string): UserSession | undefined;
  delete(token: string): void;
  size(): number;
  startCleanup(intervalMs?: number): void;
}

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, UserSession>();

  set(token: string, session: UserSession): void {
    this.sessions.set(token, session);
  }

  get(token: string): UserSession | undefined {
    const session = this.sessions.get(token);
    if (!session) return undefined;
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(token);
      return undefined;
    }
    return session;
  }

  delete(token: string): void {
    this.sessions.delete(token);
  }

  size(): number {
    return this.sessions.size;
  }

  startCleanup(intervalMs = 300_000): void {
    setInterval(() => {
      const now = Date.now();
      for (const [token, session] of this.sessions) {
        if (session.expiresAt < now) this.sessions.delete(token);
      }
    }, intervalMs).unref();
  }
}
