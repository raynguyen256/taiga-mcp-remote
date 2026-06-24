import type { UserSession } from '../session/types.js';
import type { InMemorySessionStore } from '../session/sessionStore.js';
import type { AppConfig } from '../types/config.js';
import { refreshTaigaAccessToken } from '../session/sessionService.js';

export class SessionAuthManager {
  constructor(
    private session: UserSession,
    private store: InMemorySessionStore,
    private config: AppConfig,
  ) {}

  getToken(): string {
    return this.session.taigaToken;
  }

  async refresh(): Promise<void> {
    this.session.taigaToken = await refreshTaigaAccessToken(
      this.config,
      this.session.taigaRefreshToken,
    );
    this.store.set(this.session.token, this.session);
  }

  logout(): void {
    this.store.delete(this.session.token);
  }

  getStatus(): {
    authenticated: boolean;
    username: string;
    tokenCreatedAt: string;
    expiresAt: string;
    sessionExpiresAt?: string;
  } {
    const accessTokenExpiresAt = this.session.accessTokenExpiresAt ?? this.session.expiresAt;
    return {
      authenticated: true,
      username: this.session.username,
      tokenCreatedAt: this.session.tokenCreatedAt,
      expiresAt: new Date(accessTokenExpiresAt).toISOString(),
      sessionExpiresAt:
        accessTokenExpiresAt === this.session.expiresAt
          ? undefined
          : new Date(this.session.expiresAt).toISOString(),
    };
  }
}
