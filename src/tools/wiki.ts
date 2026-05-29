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

export function registerWikiTools(server: McpServer, client: TaigaClient): void {
  server.tool(
    'taiga_list_wiki_pages',
    'List all wiki pages in a project',
    {
      project_id: z.number().describe('Project ID'),
    },
    async ({ project_id }) => {
      try {
        const pages = await client.getAll('/wiki', { project: project_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(pages, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_get_wiki_page',
    'Get details of a wiki page by ID or by slug within a project',
    {
      wiki_id: z.number().optional().describe('Wiki page internal ID'),
      slug: z.string().optional().describe('Wiki page slug (e.g. "home")'),
      project_id: z.number().optional().describe('Project ID (required when using slug)'),
    },
    async ({ wiki_id, slug, project_id }) => {
      try {
        let path: string;
        let params: Record<string, unknown> | undefined;

        if (slug !== undefined && project_id !== undefined) {
          path = '/wiki/by_slug';
          params = { slug, project: project_id };
        } else if (wiki_id !== undefined) {
          path = `/wiki/${wiki_id}`;
        } else {
          return {
            content: [{ type: 'text' as const, text: 'Error: provide wiki_id, or slug + project_id' }],
            isError: true as const,
          };
        }

        const page = await client.get(path, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(page, null, 2) }] };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
