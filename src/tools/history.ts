import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios from 'axios';
import type { TaigaClient } from '../client/TaigaClient.js';

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

export function registerHistoryTools(server: McpServer, client: TaigaClient): void {
  server.tool(
    'taiga_get_project_timeline',
    'Get the activity feed for a project (recent events and changes)',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const timeline = await client.get(`/timeline/project/${project_id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(timeline, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_user_timeline',
    'Get the activity feed for a specific user',
    {
      user_id: z.number().describe('Taiga user ID'),
    },
    async ({ user_id }) => {
      try {
        const timeline = await client.get(`/timeline/user/${user_id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(timeline, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
