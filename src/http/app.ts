import express from 'express';
import cors from 'cors';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { InMemorySessionStore } from '../session/sessionStore.js';
import { bootstrapSession } from '../session/bootstrap.js';
import type { AppConfig } from '../types/config.js';
import { createAuthRouter } from './routes/auth.js';
import { createMcpRouter } from './routes/mcp.js';
import { createOAuthInteractionRouter } from './routes/oauth.js';
import { createWellKnownRouter } from './routes/wellKnown.js';
import { TaigaOAuthProvider } from '../oauth/TaigaOAuthProvider.js';
import { getAuthLoginUrl, getMcpEndpointUrl } from './urls.js';

export function createApp(config: AppConfig) {
  const app = express();
  const sessionStore = new InMemorySessionStore();
  const oauthProvider = new TaigaOAuthProvider(sessionStore, config);
  sessionStore.startCleanup();
  oauthProvider.startCleanup();

  bootstrapSession(sessionStore, config).catch(err =>
    console.error('[bootstrap] Unexpected error:', (err as Error).message),
  );

  const origin = config.corsOrigins.length === 1 && config.corsOrigins[0] === '*'
    ? '*'
    : config.corsOrigins;

  app.use(cors({ origin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', sessions: sessionStore.size() });
  });

  app.use(mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: new URL(config.mcpServerUrl),
    resourceServerUrl: new URL(getMcpEndpointUrl(config.mcpServerUrl)),
    serviceDocumentationUrl: new URL(getAuthLoginUrl(config.mcpServerUrl)),
    scopesSupported: ['mcp'],
    resourceName: 'Taiga MCP',
  }));
  app.use(createOAuthInteractionRouter(oauthProvider));
  app.use('/auth', createAuthRouter(sessionStore, config));
  app.use('/mcp', createMcpRouter(sessionStore, config, oauthProvider));
  app.use('/.well-known', createWellKnownRouter(config));

  return { app, sessionStore, oauthProvider };
}
