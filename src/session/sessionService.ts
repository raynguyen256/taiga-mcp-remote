import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { Cache } from '../client/cache.js';
import type { AppConfig } from '../types/config.js';
import type { TaigaAuthResponse, TaigaRefreshResponse } from '../types/taiga.js';
import type { SessionStore } from './sessionStore.js';
import type { UserSession } from './types.js';

export class InvalidTaigaCredentialsError extends Error {
  constructor() {
    super('Invalid username or password');
  }
}

export class TaigaUpstreamError extends Error {
  constructor(message = 'Failed to reach Taiga server') {
    super(message);
  }
}

interface CreateSessionOptions {
  token?: string;
  username: string;
  taigaToken: string;
  taigaRefreshToken: string;
  expiresAt?: number;
  accessTokenExpiresAt?: number;
  oauthRefreshToken?: string;
  clientId?: string;
  scopes?: string[];
  resource?: string;
  cache?: Cache;
}

export async function loginToTaiga(
  config: AppConfig,
  username: string,
  password: string,
): Promise<TaigaAuthResponse> {
  try {
    const response = await axios.post<TaigaAuthResponse>(
      `${config.baseUrl}/auth`,
      { username, password, type: 'normal' },
    );
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && [400, 401].includes(err.response?.status ?? 0)) {
      throw new InvalidTaigaCredentialsError();
    }

    throw new TaigaUpstreamError();
  }
}

export async function refreshTaigaAccessToken(
  config: AppConfig,
  refreshToken: string,
): Promise<string> {
  try {
    const response = await axios.post<TaigaRefreshResponse>(
      `${config.baseUrl}/auth/refresh`,
      { refresh: refreshToken },
    );
    return response.data.auth_token;
  } catch {
    throw new TaigaUpstreamError('Failed to refresh Taiga token');
  }
}

export function createSession(config: AppConfig, options: CreateSessionOptions): UserSession {
  const now = Date.now();
  const sessionExpiresAt = options.expiresAt ?? now + config.sessionTtl * 1000;
  const accessTokenExpiresAt = options.accessTokenExpiresAt ?? sessionExpiresAt;

  return {
    token: options.token ?? randomUUID(),
    username: options.username,
    taigaToken: options.taigaToken,
    taigaRefreshToken: options.taigaRefreshToken,
    tokenCreatedAt: new Date(now).toISOString(),
    expiresAt: sessionExpiresAt,
    accessTokenExpiresAt,
    oauthRefreshToken: options.oauthRefreshToken,
    clientId: options.clientId,
    scopes: options.scopes,
    resource: options.resource,
    cache: options.cache ?? new Cache(config.cacheTtl),
  };
}

export function storeSession(
  sessionStore: SessionStore,
  session: UserSession,
): UserSession {
  sessionStore.set(session.token, session);
  return session;
}

export function createAndStoreSession(
  sessionStore: SessionStore,
  config: AppConfig,
  options: CreateSessionOptions,
): UserSession {
  return storeSession(sessionStore, createSession(config, options));
}
