import type { SessionStore } from './sessionStore.js';
import type { AppConfig } from '../types/config.js';
import { createAndStoreSession, loginToTaiga, refreshTaigaAccessToken } from './sessionService.js';
import { getMcpEndpointUrl } from '../http/urls.js';

export async function bootstrapSession(
  sessionStore: SessionStore,
  config: AppConfig,
): Promise<void> {
  const { bootstrapToken, taigaUsername, taigaPassword } = config;
  if (!bootstrapToken || !taigaUsername || !taigaPassword) return;

  const bootstrapExpiresAt = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;

  try {
    const auth = await loginToTaiga(config, taigaUsername, taigaPassword);

    createAndStoreSession(sessionStore, config, {
      token: bootstrapToken,
      username: auth.username,
      taigaToken: auth.auth_token,
      taigaRefreshToken: auth.refresh,
      expiresAt: bootstrapExpiresAt,
      accessTokenExpiresAt: bootstrapExpiresAt,
      clientId: 'bootstrap-client',
      scopes: ['mcp'],
      resource: getMcpEndpointUrl(config.mcpServerUrl),
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
        const auth = await loginToTaiga(config, taigaUsername, taigaPassword);
        createAndStoreSession(sessionStore, config, {
          token: bootstrapToken,
          username: auth.username,
          taigaToken: auth.auth_token,
          taigaRefreshToken: auth.refresh,
          expiresAt: bootstrapExpiresAt,
          accessTokenExpiresAt: bootstrapExpiresAt,
          clientId: 'bootstrap-client',
          scopes: ['mcp'],
          resource: getMcpEndpointUrl(config.mcpServerUrl),
        });
        console.log('[bootstrap] Re-logged in successfully');
      } catch (err) {
        console.error('[bootstrap] Re-login failed:', (err as Error).message);
      }
      return;
    }

    try {
      const newToken = await refreshTaigaAccessToken(config, session.taigaRefreshToken);
      session.taigaToken = newToken;
      session.tokenCreatedAt = new Date().toISOString();
      sessionStore.set(session.token, session);
      console.log('[bootstrap] Taiga token refreshed');
    } catch {
      // Refresh token invalid — fall back to full re-login
      console.warn('[bootstrap] Refresh failed — re-logging in');
      try {
        const auth = await loginToTaiga(config, taigaUsername, taigaPassword);
        session.taigaToken = auth.auth_token;
        session.taigaRefreshToken = auth.refresh;
        session.tokenCreatedAt = new Date().toISOString();
        sessionStore.set(session.token, session);
        console.log('[bootstrap] Re-logged in after refresh failure');
      } catch (err) {
        console.error('[bootstrap] Re-login failed:', (err as Error).message);
      }
    }
  };

  setInterval(tick, intervalMs).unref();
}
