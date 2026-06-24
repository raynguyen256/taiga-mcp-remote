import type { Cache } from '../client/cache.js';

export interface UserSession {
  token: string;
  username: string;
  taigaToken: string;
  taigaRefreshToken: string;
  tokenCreatedAt: string;
  expiresAt: number;
  accessTokenExpiresAt?: number;
  oauthRefreshToken?: string;
  clientId?: string;
  scopes?: string[];
  resource?: string;
  cache: Cache;
}
