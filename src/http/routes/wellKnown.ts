import { Router } from 'express';
import type { AppConfig } from '../../types/config.js';
import { getAuthLoginUrl, getMcpEndpointUrl } from '../urls.js';

export function createWellKnownRouter(config: AppConfig): Router {
  const router = Router();

  router.get('/oauth-protected-resource', (_req, res) => {
    res.json({
      resource: getMcpEndpointUrl(config.mcpServerUrl),
      authorization_servers: [config.mcpServerUrl],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp'],
      resource_documentation: getAuthLoginUrl(config.mcpServerUrl),
    });
  });

  return router;
}
