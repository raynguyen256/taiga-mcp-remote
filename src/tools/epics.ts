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

export function registerEpicTools(server: McpServer, client: TaigaClient, _cache: Cache): void {
  server.tool(
    'taiga_list_epics',
    'List epics for a project',
    {
      project_id: z.number().describe('Project ID'),
      assigned_to: z.number().optional().describe('Filter by assigned user ID'),
      status: z.number().optional().describe('Filter by status ID'),
      tags: z.string().optional().describe('Filter by tag name'),
    },
    async ({ project_id, assigned_to, status, tags }) => {
      try {
        const params: Record<string, unknown> = { project: project_id };
        if (assigned_to !== undefined) params.assigned_to = assigned_to;
        if (status !== undefined) params.status = status;
        if (tags !== undefined) params.tags = tags;

        const epics = await client.getAll('/epics', params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(epics, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_epic',
    'Get details of an epic by ID',
    {
      epic_id: z.number().describe('Epic internal ID'),
    },
    async ({ epic_id }) => {
      try {
        const epic = await client.get(`/epics/${epic_id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(epic, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_epic_userstories',
    'Get user stories associated with an epic',
    {
      epic_id: z.number().describe('Epic internal ID'),
    },
    async ({ epic_id }) => {
      try {
        const stories = await client.get(`/epics/${epic_id}/related_userstories`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(stories, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_create_epic',
    'Create a new epic in a project',
    {
      project_id: z.number().describe('Project ID'),
      subject: z.string().describe('Epic title'),
      description: z.string().optional().describe('Epic description'),
      status: z.number().optional().describe('Status ID'),
      assigned_to: z.number().nullable().optional().describe('User ID to assign'),
      color: z.string().optional().describe('Color hex code (e.g. #ff8000)'),
      tags: z.array(z.string()).optional().describe('List of tag names'),
    },
    async ({ project_id, subject, description, status, assigned_to, color, tags }) => {
      try {
        const epic = await client.post('/epics', {
          project: project_id,
          subject,
          description,
          status,
          assigned_to,
          color,
          tags,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(epic, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
