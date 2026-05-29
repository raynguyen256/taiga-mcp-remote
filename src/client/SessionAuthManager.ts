import axios from 'axios';
import type { UserSession } from '../session/types.js';
import type { InMemorySessionStore } from '../session/sessionStore.js';
import type { AppConfig } from '../types/config.js';

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
    const response = await axios.post<{ auth_token: string }>(
      `${this.config.baseUrl}/auth/refresh`,
      { refresh: this.session.taigaRefreshToken },
    );
    this.session.taigaToken = response.data.auth_token;
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
  } {
    return {
      authenticated: true,
      username: this.session.username,
      tokenCreatedAt: this.session.tokenCreatedAt,
      expiresAt: new Date(this.session.expiresAt).toISOString(),
    };
  }
}
