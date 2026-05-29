import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios from 'axios';
import type { TaigaClient } from '../client/TaigaClient.js';
import type { Cache } from '../client/cache.js';
import { cacheKey } from '../client/cache.js';

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

export function registerMemberTools(server: McpServer, client: TaigaClient, cache: Cache): void {
  server.tool(
    'taiga_list_members',
    'List all members of a project with their roles',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const key = cacheKey.members(project_id);
        const cached = cache.get(key);
        if (cached) return { content: [{ type: 'text' as const, text: JSON.stringify(cached, null, 2) }] };

        const members = await client.getAll('/memberships', { project: project_id });
        cache.set(key, members);
        return { content: [{ type: 'text' as const, text: JSON.stringify(members, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_user',
    'Get the profile of a Taiga user by ID',
    {
      user_id: z.number().describe('Taiga user ID'),
    },
    async ({ user_id }) => {
      try {
        const user = await client.get(`/users/${user_id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(user, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_user_stats',
    'Get activity statistics for a Taiga user',
    {
      user_id: z.number().describe('Taiga user ID'),
    },
    async ({ user_id }) => {
      try {
        const stats = await client.get(`/users/${user_id}/stats`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
