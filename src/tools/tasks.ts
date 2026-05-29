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

export function registerTaskTools(server: McpServer, client: TaigaClient, _cache: Cache): void {
  server.tool(
    'taiga_list_tasks',
    'List tasks with filters by project, sprint, user story, status, or assignee',
    {
      project_id: z.number().describe('Project ID'),
      milestone: z.number().optional().describe('Filter by sprint ID'),
      user_story: z.number().optional().describe('Filter by user story ID'),
      status: z.number().optional().describe('Filter by status ID'),
      assigned_to: z.number().optional().describe('Filter by assigned user ID'),
      tags: z.string().optional().describe('Filter by tag name'),
    },
    async ({ project_id, ...filters }) => {
      try {
        const params: Record<string, unknown> = { project: project_id };
        if (filters.milestone !== undefined) params.milestone = filters.milestone;
        if (filters.user_story !== undefined) params.user_story = filters.user_story;
        if (filters.status !== undefined) params.status = filters.status;
        if (filters.assigned_to !== undefined) params.assigned_to = filters.assigned_to;
        if (filters.tags !== undefined) params.tags = filters.tags;

        const tasks = await client.getAll('/tasks', params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(tasks, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_task',
    'Get details of a task by ID or by ref number',
    {
      task_id: z.number().optional().describe('Task internal ID'),
      ref: z.number().optional().describe('Task reference number'),
      project_id: z.number().optional().describe('Project ID (required when using ref)'),
    },
    async ({ task_id, ref, project_id }) => {
      try {
        let path: string;
        let params: Record<string, unknown> | undefined;

        if (ref !== undefined && project_id !== undefined) {
          path = '/tasks/by_ref';
          params = { ref, project: project_id };
        } else if (task_id !== undefined) {
          path = `/tasks/${task_id}`;
        } else {
          return {
            content: [{ type: 'text' as const, text: 'Error: provide task_id, or ref + project_id' }],
            isError: true as const,
          };
        }

        const task = await client.get(path, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_create_task',
    'Create a new task in a project',
    {
      project_id: z.number().describe('Project ID'),
      subject: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description'),
      user_story: z.number().nullable().optional().describe('Parent user story ID'),
      milestone: z.number().nullable().optional().describe('Sprint ID'),
      status: z.number().optional().describe('Status ID'),
      assigned_to: z.number().nullable().optional().describe('User ID to assign'),
      tags: z.array(z.string()).optional().describe('List of tag names'),
    },
    async ({ project_id, subject, description, user_story, milestone, status, assigned_to, tags }) => {
      try {
        const task = await client.post('/tasks', {
          project: project_id,
          subject,
          description,
          user_story,
          milestone,
          status,
          assigned_to,
          tags,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_update_task',
    'Update a task. Must include version for optimistic concurrency control.',
    {
      task_id: z.number().describe('Task internal ID'),
      version: z.number().describe('Current version number (required to prevent conflicts)'),
      subject: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      status: z.number().optional().describe('New status ID'),
      assigned_to: z.number().nullable().optional().describe('New assigned user ID'),
      milestone: z.number().nullable().optional().describe('New sprint ID'),
      user_story: z.number().nullable().optional().describe('New parent user story ID'),
      tags: z.array(z.string()).optional().describe('New tags list'),
      is_blocked: z.boolean().optional().describe('Mark as blocked'),
      blocked_note: z.string().optional().describe('Reason for blocking'),
    },
    async ({ task_id, ...updates }) => {
      try {
        const task = await client.patch(`/tasks/${task_id}`, updates);
        return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_task_history',
    'Get the change history and comments for a task',
    {
      task_id: z.number().describe('Task internal ID'),
    },
    async ({ task_id }) => {
      try {
        const history = await client.get(`/history/task/${task_id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(history, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
