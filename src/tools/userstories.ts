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

export function registerUserStoryTools(server: McpServer, client: TaigaClient, _cache: Cache): void {
  server.tool(
    'taiga_list_userstories',
    'List user stories with filters. Use milestone__isnull=true for backlog items.',
    {
      project_id: z.number().describe('Project ID'),
      milestone: z.number().optional().describe('Filter by sprint ID'),
      milestone__isnull: z.boolean().optional().describe('true = backlog only (not in any sprint)'),
      status: z.number().optional().describe('Filter by status ID'),
      assigned_to: z.number().optional().describe('Filter by assigned user ID'),
      epic: z.number().optional().describe('Filter by epic ID'),
      tags: z.string().optional().describe('Filter by tag name'),
      in_backlog: z.boolean().optional().describe('Filter by backlog flag'),
      is_closed: z.boolean().optional().describe('Filter by closed state'),
    },
    async ({ project_id, ...filters }) => {
      try {
        const params: Record<string, unknown> = { project: project_id };
        if (filters.milestone !== undefined) params.milestone = filters.milestone;
        if (filters.milestone__isnull !== undefined) params['milestone__isnull'] = filters.milestone__isnull;
        if (filters.status !== undefined) params.status = filters.status;
        if (filters.assigned_to !== undefined) params.assigned_to = filters.assigned_to;
        if (filters.epic !== undefined) params.epic = filters.epic;
        if (filters.tags !== undefined) params.tags = filters.tags;
        if (filters.in_backlog !== undefined) params.in_backlog = filters.in_backlog;
        if (filters.is_closed !== undefined) params.is_closed = filters.is_closed;

        const stories = await client.getAll('/userstories', params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(stories, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_userstory',
    'Get details of a user story by ID or by ref number within a project',
    {
      userstory_id: z.number().optional().describe('User story internal ID'),
      ref: z.number().optional().describe('User story reference number (e.g. #42)'),
      project_id: z.number().optional().describe('Project ID (required when using ref)'),
    },
    async ({ userstory_id, ref, project_id }) => {
      try {
        let path: string;
        let params: Record<string, unknown> | undefined;

        if (ref !== undefined && project_id !== undefined) {
          path = '/userstories/by_ref';
          params = { ref, project: project_id };
        } else if (userstory_id !== undefined) {
          path = `/userstories/${userstory_id}`;
        } else {
          return {
            content: [{ type: 'text' as const, text: 'Error: provide userstory_id, or ref + project_id' }],
            isError: true as const,
          };
        }

        const story = await client.get(path, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(story, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_create_userstory',
    'Create a new user story in a project',
    {
      project_id: z.number().describe('Project ID'),
      subject: z.string().describe('User story title'),
      description: z.string().optional().describe('Detailed description'),
      milestone: z.number().nullable().optional().describe('Sprint ID (null = backlog)'),
      status: z.number().optional().describe('Status ID'),
      assigned_to: z.number().nullable().optional().describe('User ID to assign'),
      tags: z.array(z.string()).optional().describe('List of tag names'),
    },
    async ({ project_id, subject, description, milestone, status, assigned_to, tags }) => {
      try {
        const story = await client.post('/userstories', {
          project: project_id,
          subject,
          description,
          milestone,
          status,
          assigned_to,
          tags,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(story, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_update_userstory',
    'Update a user story. Must include version for optimistic concurrency control.',
    {
      userstory_id: z.number().describe('User story internal ID'),
      version: z.number().describe('Current version number (required to prevent conflicts)'),
      subject: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      status: z.number().optional().describe('New status ID'),
      assigned_to: z.number().nullable().optional().describe('New assigned user ID'),
      milestone: z.number().nullable().optional().describe('New sprint ID'),
      tags: z.array(z.string()).optional().describe('New tags list'),
      is_blocked: z.boolean().optional().describe('Mark as blocked'),
      blocked_note: z.string().optional().describe('Reason for blocking'),
    },
    async ({ userstory_id, ...updates }) => {
      try {
        const story = await client.patch(`/userstories/${userstory_id}`, updates);
        return { content: [{ type: 'text' as const, text: JSON.stringify(story, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_move_userstory_to_sprint',
    'Move one or more user stories to a sprint',
    {
      project_id: z.number().describe('Project ID'),
      sprint_id: z.number().describe('Target sprint ID (milestone ID)'),
      userstory_ids: z.array(z.number()).describe('List of user story IDs to move'),
    },
    async ({ project_id, sprint_id, userstory_ids }) => {
      try {
        const bulk_stories = userstory_ids.map((us_id, i) => ({ us_id, order: i + 1 }));
        await client.post('/userstories/bulk_update_milestone', {
          project_id,
          milestone_id: sprint_id,
          bulk_stories,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Successfully moved ${userstory_ids.length} user stories to sprint ${sprint_id}`,
            },
          ],
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_userstory_history',
    'Get the change history and comments for a user story',
    {
      userstory_id: z.number().describe('User story internal ID'),
    },
    async ({ userstory_id }) => {
      try {
        const history = await client.get(`/history/userstory/${userstory_id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(history, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
