import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaigaClient } from './client/TaigaClient.js';
import type { SessionAuthManager } from './client/SessionAuthManager.js';
import type { Cache } from './client/cache.js';
import { registerAuthTools } from './tools/auth.js';
import { registerProjectTools } from './tools/projects.js';
import { registerSprintTools } from './tools/sprints.js';
import { registerUserStoryTools } from './tools/userstories.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerIssueTools } from './tools/issues.js';
import { registerEpicTools } from './tools/epics.js';
import { registerMemberTools } from './tools/members.js';
import { registerHistoryTools } from './tools/history.js';
import { registerSearchTools } from './tools/search.js';
import { registerExportImportTools } from './tools/exportImport.js';
import { registerWikiTools } from './tools/wiki.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

export function createServer(
  client: TaigaClient,
  auth: SessionAuthManager,
  cache: Cache,
): McpServer {
  const server = new McpServer({
    name: 'taiga-mcp-remote',
    version: '1.0.0',
  });

  registerAuthTools(server, client, auth);
  registerProjectTools(server, client, cache);
  registerSprintTools(server, client, cache);
  registerUserStoryTools(server, client, cache);
  registerTaskTools(server, client, cache);
  registerIssueTools(server, client, cache);
  registerEpicTools(server, client, cache);
  registerMemberTools(server, client, cache);
  registerHistoryTools(server, client);
  registerSearchTools(server, client, cache);
  registerExportImportTools(server, client);
  registerWikiTools(server, client);
  registerResources(server, client);
  registerPrompts(server);

  return server;
}
