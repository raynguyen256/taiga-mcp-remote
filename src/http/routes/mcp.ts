import { Router, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { InMemorySessionStore } from '../../session/sessionStore.js';
import type { AppConfig } from '../../types/config.js';
import { SessionAuthManager } from '../../client/SessionAuthManager.js';
import { TaigaClient } from '../../client/TaigaClient.js';
import { createServer } from '../../server.js';
import { createBearerAuth } from '../middleware/bearerAuth.js';
import type { UserSession } from '../../session/types.js';

async function handleMcpRequest(
  session: UserSession,
  sessionStore: InMemorySessionStore,
  config: AppConfig,
  req: Request,
  res: Response,
  body?: unknown,
): Promise<void> {
  const sessionAuth = new SessionAuthManager(session, sessionStore, config);
  const taigaClient = new TaigaClient(sessionAuth, config);
  const mcpServer = createServer(taigaClient, sessionAuth, session.cache);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, body);
}

export function createMcpRouter(sessionStore: InMemorySessionStore, config: AppConfig): Router {
  const router = Router();
  const bearerAuth = createBearerAuth(sessionStore);

  router.post('/', bearerAuth, async (req, res) => {
    try {
      await handleMcpRequest(req.userSession!, sessionStore, config, req, res, req.body);
    } catch (err) {
      console.error('[MCP] POST error:', (err as Error).stack ?? (err as Error).message);
      if (!res.headersSent) {
        res.status(500).json({ error: (err as Error).message });
      }
    }
  });

  router.get('/', bearerAuth, async (req, res) => {
    try {
      await handleMcpRequest(req.userSession!, sessionStore, config, req, res);
    } catch (err) {
      console.error('[MCP] GET error:', (err as Error).stack ?? (err as Error).message);
      if (!res.headersSent) {
        res.status(500).json({ error: (err as Error).message });
      }
    }
  });

  router.delete('/', bearerAuth, async (req, res) => {
    try {
      await handleMcpRequest(req.userSession!, sessionStore, config, req, res);
    } catch (err) {
      console.error('[MCP] DELETE error:', (err as Error).stack ?? (err as Error).message);
      if (!res.headersSent) {
        res.status(500).json({ error: (err as Error).message });
      }
    }
  });

  return router;
}
