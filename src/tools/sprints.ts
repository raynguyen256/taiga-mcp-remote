import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios from 'axios';
import type { TaigaClient } from '../client/TaigaClient.js';
import type { Cache } from '../client/cache.js';

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

export function registerSprintTools(server: McpServer, client: TaigaClient, _cache: Cache): void {
  server.tool(
    'taiga_list_sprints',
    'List sprints (milestones) for a project',
    {
      project_id: z.number().describe('Project ID'),
      closed: z.boolean().optional().describe('true = only closed sprints, false = only open'),
    },
    async ({ project_id, closed }) => {
      try {
        const sprints = await client.getAll('/milestones', { project: project_id, closed });
        return { content: [{ type: 'text' as const, text: JSON.stringify(sprints, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_sprint',
    'Get details of a sprint by ID',
    {
      sprint_id: z.number().describe('Sprint (milestone) ID'),
    },
    async ({ sprint_id }) => {
      try {
        const sprint = await client.get(`/milestones/${sprint_id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(sprint, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_sprint_stats',
    'Get burndown statistics for a sprint',
    {
      sprint_id: z.number().describe('Sprint (milestone) ID'),
    },
    async ({ sprint_id }) => {
      try {
        const stats = await client.get(`/milestones/${sprint_id}/stats`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_create_sprint',
    'Create a new sprint in a project',
    {
      project_id: z.number().describe('Project ID'),
      name: z.string().describe('Sprint name'),
      estimated_start: z.string().describe('Start date (YYYY-MM-DD)'),
      estimated_finish: z.string().describe('End date (YYYY-MM-DD)'),
    },
    async ({ project_id, name, estimated_start, estimated_finish }) => {
      try {
        const sprint = await client.post('/milestones', {
          project: project_id,
          name,
          estimated_start,
          estimated_finish,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(sprint, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_update_sprint',
    'Update sprint details (name, dates, closed status)',
    {
      sprint_id: z.number().describe('Sprint (milestone) ID'),
      name: z.string().optional().describe('New sprint name'),
      estimated_start: z.string().optional().describe('New start date (YYYY-MM-DD)'),
      estimated_finish: z.string().optional().describe('New end date (YYYY-MM-DD)'),
      closed: z.boolean().optional().describe('Mark sprint as closed/open'),
    },
    async ({ sprint_id, ...updates }) => {
      try {
        const sprint = await client.patch(`/milestones/${sprint_id}`, updates);
        return { content: [{ type: 'text' as const, text: JSON.stringify(sprint, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
