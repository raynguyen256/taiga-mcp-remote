import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaigaClient } from '../client/TaigaClient.js';

export function registerResources(server: McpServer, client: TaigaClient): void {
  server.resource(
    'projects-list',
    'taiga://projects',
    async (uri) => {
      const projects = await client.getAll('/projects');
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(projects, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.resource(
    'project-detail',
    new ResourceTemplate('taiga://project/{slug}', { list: undefined }),
    async (uri, { slug }) => {
      const project = await client.get('/projects/by_slug', { slug: String(slug) });
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(project, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.resource(
    'project-sprints',
    new ResourceTemplate('taiga://project/{slug}/sprints', { list: undefined }),
    async (uri, { slug }) => {
      const project = await client.get<{ id: number }>('/projects/by_slug', { slug: String(slug) });
      const sprints = await client.getAll('/milestones', { project: project.id });
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(sprints, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.resource(
    'project-backlog',
    new ResourceTemplate('taiga://project/{slug}/backlog', { list: undefined }),
    async (uri, { slug }) => {
      const project = await client.get<{ id: number }>('/projects/by_slug', { slug: String(slug) });
      const backlog = await client.getAll('/userstories', {
        project: project.id,
        'milestone__isnull': true,
      });
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(backlog, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.resource(
    'project-members',
    new ResourceTemplate('taiga://project/{slug}/members', { list: undefined }),
    async (uri, { slug }) => {
      const project = await client.get<{ id: number }>('/projects/by_slug', { slug: String(slug) });
      const members = await client.getAll('/memberships', { project: project.id });
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(members, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.resource(
    'project-stats',
    new ResourceTemplate('taiga://project/{slug}/stats', { list: undefined }),
    async (uri, { slug }) => {
      const project = await client.get<{ id: number }>('/projects/by_slug', { slug: String(slug) });
      const stats = await client.get(`/projects/${project.id}/stats`);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(stats, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );
}
