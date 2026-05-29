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

export function registerIssueTools(server: McpServer, client: TaigaClient, _cache: Cache): void {
  server.tool(
    'taiga_list_issues',
    'List issues with filters by status, type, severity, priority, or assignee',
    {
      project_id: z.number().describe('Project ID'),
      status: z.number().optional().describe('Filter by status ID'),
      type: z.number().optional().describe('Filter by issue type ID'),
      severity: z.number().optional().describe('Filter by severity ID'),
      priority: z.number().optional().describe('Filter by priority ID'),
      assigned_to: z.number().optional().describe('Filter by assigned user ID'),
      tags: z.string().optional().describe('Filter by tag name'),
      order_by: z.string().optional().describe('Sort: created_date, modified_date, priority, severity'),
    },
    async ({ project_id, ...filters }) => {
      try {
        const params: Record<string, unknown> = { project: project_id };
        if (filters.status !== undefined) params.status = filters.status;
        if (filters.type !== undefined) params.type = filters.type;
        if (filters.severity !== undefined) params.severity = filters.severity;
        if (filters.priority !== undefined) params.priority = filters.priority;
        if (filters.assigned_to !== undefined) params.assigned_to = filters.assigned_to;
        if (filters.tags !== undefined) params.tags = filters.tags;
        if (filters.order_by !== undefined) params.order_by = filters.order_by;

        const issues = await client.getAll('/issues', params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(issues, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_issue',
    'Get details of an issue by ID or by ref number',
    {
      issue_id: z.number().optional().describe('Issue internal ID'),
      ref: z.number().optional().describe('Issue reference number'),
      project_id: z.number().optional().describe('Project ID (required when using ref)'),
    },
    async ({ issue_id, ref, project_id }) => {
      try {
        let path: string;
        let params: Record<string, unknown> | undefined;

        if (ref !== undefined && project_id !== undefined) {
          path = '/issues/by_ref';
          params = { ref, project: project_id };
        } else if (issue_id !== undefined) {
          path = `/issues/${issue_id}`;
        } else {
          return {
            content: [{ type: 'text' as const, text: 'Error: provide issue_id, or ref + project_id' }],
            isError: true as const,
          };
        }

        const issue = await client.get(path, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(issue, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_create_issue',
    'Create a new issue in a project',
    {
      project_id: z.number().describe('Project ID'),
      subject: z.string().describe('Issue title'),
      description: z.string().optional().describe('Issue description'),
      priority: z.number().describe('Priority ID (use taiga_list_priorities to get IDs)'),
      status: z.number().describe('Status ID (use taiga_list_issue_statuses to get IDs)'),
      type: z.number().describe('Issue type ID (use taiga_list_issue_types to get IDs)'),
      severity: z.number().describe('Severity ID (use taiga_list_severities to get IDs)'),
      assigned_to: z.number().nullable().optional().describe('User ID to assign'),
      milestone: z.number().nullable().optional().describe('Sprint ID'),
      tags: z.array(z.string()).optional().describe('List of tag names'),
    },
    async ({
      project_id, subject, description, priority, status, type, severity, assigned_to, milestone, tags,
    }) => {
      try {
        const issue = await client.post('/issues', {
          project: project_id,
          subject,
          description,
          priority,
          status,
          type,
          severity,
          assigned_to,
          milestone,
          tags,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(issue, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_update_issue',
    'Update an issue. Must include version for optimistic concurrency control.',
    {
      issue_id: z.number().describe('Issue internal ID'),
      version: z.number().describe('Current version number (required to prevent conflicts)'),
      subject: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      status: z.number().optional().describe('New status ID'),
      priority: z.number().optional().describe('New priority ID'),
      type: z.number().optional().describe('New type ID'),
      severity: z.number().optional().describe('New severity ID'),
      assigned_to: z.number().nullable().optional().describe('New assigned user ID'),
      milestone: z.number().nullable().optional().describe('New sprint ID'),
      tags: z.array(z.string()).optional().describe('New tags list'),
    },
    async ({ issue_id, ...updates }) => {
      try {
        const issue = await client.patch(`/issues/${issue_id}`, updates);
        return { content: [{ type: 'text' as const, text: JSON.stringify(issue, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_issue_history',
    'Get the change history and comments for an issue',
    {
      issue_id: z.number().describe('Issue internal ID'),
    },
    async ({ issue_id }) => {
      try {
        const history = await client.get(`/history/issue/${issue_id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(history, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
