import axios from 'axios';
import type { InMemorySessionStore } from './sessionStore.js';
import type { AppConfig } from '../types/config.js';
import { Cache } from '../client/cache.js';

interface TaigaAuthResponse {
  auth_token: string;
  refresh: string;
  username: string;
}

export async function bootstrapSession(
  sessionStore: InMemorySessionStore,
  config: AppConfig,
): Promise<void> {
  const { bootstrapToken, taigaUsername, taigaPassword } = config;
  if (!bootstrapToken || !taigaUsername || !taigaPassword) return;

  const login = async (): Promise<TaigaAuthResponse> => {
    const res = await axios.post<TaigaAuthResponse>(
      `${config.baseUrl}/auth`,
      { username: taigaUsername, password: taigaPassword, type: 'normal' },
    );
    return res.data;
  };

  const refreshTaigaToken = async (refreshToken: string): Promise<string> => {
    const res = await axios.post<{ auth_token: string }>(
      `${config.baseUrl}/auth/refresh`,
      { refresh: refreshToken },
    );
    return res.data.auth_token;
  };

  try {
    const auth = await login();

    sessionStore.set(bootstrapToken, {
      token: bootstrapToken,
      username: auth.username,
      taigaToken: auth.auth_token,
      taigaRefreshToken: auth.refresh,
      tokenCreatedAt: new Date().toISOString(),
      expiresAt: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000, // 100 years
      cache: new Cache(config.cacheTtl),
    });

    console.log(`[bootstrap] Session ready — user: ${auth.username}, token: ${bootstrapToken}`);
  } catch (err) {
    console.error('[bootstrap] Initial login failed:', (err as Error).message);
    return;
  }

  // Refresh Taiga token in the background every tokenRefreshThreshold/2 seconds
  const intervalMs = Math.max((config.tokenRefreshThreshold / 2) * 1000, 60_000);

  const tick = async () => {
    const session = sessionStore.get(bootstrapToken);
    if (!session) {
      console.warn('[bootstrap] Session missing — re-logging in');
      try {
        const auth = await login();
        sessionStore.set(bootstrapToken, {
          token: bootstrapToken,
          username: auth.username,
          taigaToken: auth.auth_token,
          taigaRefreshToken: auth.refresh,
          tokenCreatedAt: new Date().toISOString(),
          expiresAt: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
          cache: new Cache(config.cacheTtl),
        });
        console.log('[bootstrap] Re-logged in successfully');
      } catch (err) {
        console.error('[bootstrap] Re-login failed:', (err as Error).message);
      }
      return;
    }

    try {
      const newToken = await refreshTaigaToken(session.taigaRefreshToken);
      session.taigaToken = newToken;
      session.tokenCreatedAt = new Date().toISOString();
      console.log('[bootstrap] Taiga token refreshed');
    } catch {
      // Refresh token invalid — fall back to full re-login
      console.warn('[bootstrap] Refresh failed — re-logging in');
      try {
        const auth = await login();
        session.taigaToken = auth.auth_token;
        session.taigaRefreshToken = auth.refresh;
        session.tokenCreatedAt = new Date().toISOString();
        console.log('[bootstrap] Re-logged in after refresh failure');
      } catch (err) {
        console.error('[bootstrap] Re-login failed:', (err as Error).message);
      }
    }
  };

  setInterval(tick, intervalMs).unref();
}
