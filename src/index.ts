import 'dotenv/config';
import { loadAppConfig } from './types/config.js';
import { createApp } from './http/app.js';

async function main() {
  const config = loadAppConfig();
  const { app } = createApp(config);

  app.listen(config.port, () => {
    console.log(`[taiga-mcp-remote] Server listening on port ${config.port}`);
    console.log(`[taiga-mcp-remote] MCP endpoint: ${config.mcpServerUrl}/mcp`);
    console.log(`[taiga-mcp-remote] Auth endpoint: ${config.mcpServerUrl}/auth/login`);
  });
}

main().catch(err => {
  console.error('[taiga-mcp-remote] Fatal error:', (err as Error).message);
  process.exit(1);
});
