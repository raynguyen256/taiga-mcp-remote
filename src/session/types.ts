import type { Cache } from '../client/cache.js';

export interface UserSession {
  token: string;
  username: string;
  taigaToken: string;
  taigaRefreshToken: string;
  tokenCreatedAt: string;
  expiresAt: number;
  cache: Cache;
}
