import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import axios from 'axios';
import type { TaigaClient } from '../client/TaigaClient.js';
import type { SessionAuthManager } from '../client/SessionAuthManager.js';

function toolError(err: unknown) {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail ?? err.message;
    return {
      content: [{ type: 'text' as const, text: `Taiga API error ${status}: ${detail}` }],
      isError: true as const,
    };
  }
  return {
    content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
    isError: true as const,
  };
}

export function registerAuthTools(
  server: McpServer,
  client: TaigaClient,
  auth: SessionAuthManager,
): void {
  server.tool(
    'taiga_auth_status',
    'Check the current authentication status and session info',
    {},
    async () => {
      try {
        const status = auth.getStatus();
        return { content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_current_user',
    'Get the profile of the currently authenticated Taiga user',
    {},
    async () => {
      try {
        const user = await client.get('/users/me');
        return { content: [{ type: 'text' as const, text: JSON.stringify(user, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_login',
    'Returns current session info. To create a new session, use POST /auth/login with username and password.',
    {},
    async () => {
      try {
        const status = auth.getStatus();
        return {
          content: [
            {
              type: 'text' as const,
              text: `Already authenticated as "${status.username}". Session expires at ${status.expiresAt}.\n\nTo login as a different user, use POST /auth/login endpoint with your credentials.`,
            },
          ],
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_logout',
    'Logout and invalidate the current session token',
    {},
    async () => {
      try {
        const status = auth.getStatus();
        auth.logout();
        return {
          content: [
            {
              type: 'text' as const,
              text: `Logged out successfully. Session for "${status.username}" has been invalidated.`,
            },
          ],
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );

}
