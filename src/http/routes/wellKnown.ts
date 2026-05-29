import { Router } from 'express';
import type { AppConfig } from '../../types/config.js';

export function createWellKnownRouter(config: AppConfig): Router {
  const router = Router();

  router.get('/oauth-protected-resource', (_req, res) => {
    res.json({
      resource: config.mcpServerUrl,
      bearer_methods_supported: ['header'],
      resource_documentation: `${config.mcpServerUrl}/auth/login`,
    });
  });

  return router;
}
