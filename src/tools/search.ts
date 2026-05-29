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

export function registerSearchTools(server: McpServer, client: TaigaClient, cache: Cache): void {
  server.tool(
    'taiga_search',
    'Search across user stories, tasks, issues, and wiki pages in a project',
    {
      project_id: z.number().describe('Project ID'),
      text: z.string().describe('Search query text'),
    },
    async ({ project_id, text }) => {
      try {
        const results = await client.get('/search', { project: project_id, text });
        return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_resolve',
    'Resolve a project slug and ref number to internal IDs',
    {
      project_slug: z.string().describe('Project slug'),
      us: z.number().optional().describe('User story ref number'),
      issue: z.number().optional().describe('Issue ref number'),
      task: z.number().optional().describe('Task ref number'),
      milestone: z.number().optional().describe('Milestone/sprint ref number'),
      wikipage: z.string().optional().describe('Wiki page slug'),
    },
    async ({ project_slug, us, issue, task, milestone, wikipage }) => {
      try {
        const params: Record<string, unknown> = { project: project_slug };
        if (us !== undefined) params.us = us;
        if (issue !== undefined) params.issue = issue;
        if (task !== undefined) params.task = task;
        if (milestone !== undefined) params.milestone = milestone;
        if (wikipage !== undefined) params.wikipage = wikipage;

        const result = await client.get('/resolver', params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_list_userstory_statuses',
    'List all user story status options for a project',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const key = cacheKey.userstoryStatuses(project_id);
        const cached = cache.get(key);
        if (cached) return { content: [{ type: 'text' as const, text: JSON.stringify(cached, null, 2) }] };

        const statuses = await client.get('/userstory-statuses', { project: project_id });
        cache.set(key, statuses);
        return { content: [{ type: 'text' as const, text: JSON.stringify(statuses, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_list_task_statuses',
    'List all task status options for a project',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const key = cacheKey.taskStatuses(project_id);
        const cached = cache.get(key);
        if (cached) return { content: [{ type: 'text' as const, text: JSON.stringify(cached, null, 2) }] };

        const statuses = await client.get('/task-statuses', { project: project_id });
        cache.set(key, statuses);
        return { content: [{ type: 'text' as const, text: JSON.stringify(statuses, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_list_issue_statuses',
    'List all issue status options for a project',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const key = cacheKey.issueStatuses(project_id);
        const cached = cache.get(key);
        if (cached) return { content: [{ type: 'text' as const, text: JSON.stringify(cached, null, 2) }] };

        const statuses = await client.get('/issue-statuses', { project: project_id });
        cache.set(key, statuses);
        return { content: [{ type: 'text' as const, text: JSON.stringify(statuses, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_list_issue_types',
    'List all issue type options for a project (Bug, Question, Enhancement, etc.)',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const key = cacheKey.issueTypes(project_id);
        const cached = cache.get(key);
        if (cached) return { content: [{ type: 'text' as const, text: JSON.stringify(cached, null, 2) }] };

        const types = await client.get('/issue-types', { project: project_id });
        cache.set(key, types);
        return { content: [{ type: 'text' as const, text: JSON.stringify(types, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_list_priorities',
    'List all priority options for a project',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const key = cacheKey.priorities(project_id);
        const cached = cache.get(key);
        if (cached) return { content: [{ type: 'text' as const, text: JSON.stringify(cached, null, 2) }] };

        const priorities = await client.get('/priorities', { project: project_id });
        cache.set(key, priorities);
        return { content: [{ type: 'text' as const, text: JSON.stringify(priorities, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_list_severities',
    'List all severity options for a project',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const key = cacheKey.severities(project_id);
        const cached = cache.get(key);
        if (cached) return { content: [{ type: 'text' as const, text: JSON.stringify(cached, null, 2) }] };

        const severities = await client.get('/severities', { project: project_id });
        cache.set(key, severities);
        return { content: [{ type: 'text' as const, text: JSON.stringify(severities, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
