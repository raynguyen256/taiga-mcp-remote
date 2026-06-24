import { Router, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { InMemorySessionStore } from '../../session/sessionStore.js';
import type { AppConfig } from '../../types/config.js';
import { SessionAuthManager } from '../../client/SessionAuthManager.js';
import { TaigaClient } from '../../client/TaigaClient.js';
import { createServer } from '../../server.js';
import type { UserSession } from '../../session/types.js';
import type { TaigaOAuthProvider } from '../../oauth/TaigaOAuthProvider.js';
import { getMcpEndpointUrl } from '../urls.js';

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

export function createMcpRouter(
  sessionStore: InMemorySessionStore,
  config: AppConfig,
  oauthProvider: TaigaOAuthProvider,
): Router {
  const router = Router();
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(
    new URL(getMcpEndpointUrl(config.mcpServerUrl)),
  );
  const bearerAuth = requireBearerAuth({
    verifier: oauthProvider,
    requiredScopes: ['mcp'],
    resourceMetadataUrl,
  });

  router.post('/', bearerAuth, async (req, res) => {
    try {
      const session = sessionStore.get(req.auth!.token);
      if (!session) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
      await handleMcpRequest(session, sessionStore, config, req, res, req.body);
    } catch (err) {
      console.error('[MCP] POST error:', (err as Error).stack ?? (err as Error).message);
      if (!res.headersSent) {
        res.status(500).json({ error: (err as Error).message });
      }
    }
  });

  router.get('/', bearerAuth, async (req, res) => {
    try {
      const session = sessionStore.get(req.auth!.token);
      if (!session) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
      await handleMcpRequest(session, sessionStore, config, req, res);
    } catch (err) {
      console.error('[MCP] GET error:', (err as Error).stack ?? (err as Error).message);
      if (!res.headersSent) {
        res.status(500).json({ error: (err as Error).message });
      }
    }
  });

  router.delete('/', bearerAuth, async (req, res) => {
    try {
      const session = sessionStore.get(req.auth!.token);
      if (!session) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
      await handleMcpRequest(session, sessionStore, config, req, res);
    } catch (err) {
      console.error('[MCP] DELETE error:', (err as Error).stack ?? (err as Error).message);
      if (!res.headersSent) {
        res.status(500).json({ error: (err as Error).message });
      }
    }
  });

  return router;
}
