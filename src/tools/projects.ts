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

export function registerProjectTools(server: McpServer, client: TaigaClient, cache: Cache): void {
  server.tool(
    'taiga_list_projects',
    'List all Taiga projects accessible to the current user',
    {
      member: z.number().optional().describe('Filter by member user ID'),
      order_by: z.string().optional().describe('Sort: memberships_count, fanpages, name'),
    },
    async ({ member, order_by }) => {
      try {
        const projects = await client.getAll('/projects', { member, order_by });
        return { content: [{ type: 'text' as const, text: JSON.stringify(projects, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_project',
    'Get project details by ID or slug',
    {
      project_id: z.number().optional().describe('Project ID'),
      slug: z.string().optional().describe('Project slug (use instead of project_id)'),
    },
    async ({ project_id, slug }) => {
      try {
        if (!project_id && !slug) {
          return {
            content: [{ type: 'text' as const, text: 'Error: provide project_id or slug' }],
            isError: true as const,
          };
        }
        const path = slug ? '/projects/by_slug' : `/projects/${project_id}`;
        const params = slug ? { slug } : undefined;
        const project = await client.get(path, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(project, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_project_stats',
    'Get overall statistics for a project (total US, tasks, issues, points)',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const key = cacheKey.projectStats(project_id);
        const cached = cache.get(key);
        if (cached) return { content: [{ type: 'text' as const, text: JSON.stringify(cached, null, 2) }] };

        const stats = await client.get(`/projects/${project_id}/stats`);
        cache.set(key, stats);
        return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_project_issues_stats',
    'Get issues statistics breakdown by type, status, priority, severity for a project',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const key = cacheKey.projectIssuesStats(project_id);
        const cached = cache.get(key);
        if (cached) return { content: [{ type: 'text' as const, text: JSON.stringify(cached, null, 2) }] };

        const stats = await client.get(`/projects/${project_id}/issues_stats`);
        cache.set(key, stats);
        return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
