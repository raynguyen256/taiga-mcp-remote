import express from 'express';
import cors from 'cors';
import { InMemorySessionStore } from '../session/sessionStore.js';
import { bootstrapSession } from '../session/bootstrap.js';
import type { AppConfig } from '../types/config.js';
import { createAuthRouter } from './routes/auth.js';
import { createMcpRouter } from './routes/mcp.js';
import { createWellKnownRouter } from './routes/wellKnown.js';

export function createApp(config: AppConfig) {
  const app = express();
  const sessionStore = new InMemorySessionStore();
  sessionStore.startCleanup();

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

  app.use('/auth', createAuthRouter(sessionStore, config));
  app.use('/mcp', createMcpRouter(sessionStore, config));
  app.use('/.well-known', createWellKnownRouter(config));

  return { app, sessionStore };
}
