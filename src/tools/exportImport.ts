import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
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

export function registerExportImportTools(server: McpServer, client: TaigaClient): void {
  server.tool(
    'taiga_export_project',
    'Export an entire project as a JSON dump and save to a local file',
    {
      project_id: z.number().describe('Project ID to export'),
      output_path: z.string().describe('Local file path to save the JSON dump (e.g. ~/backups/project.json)'),
    },
    async ({ project_id, output_path }) => {
      try {
        const resolvedPath = output_path.replace(/^~/, process.env.HOME ?? '');
        const dir = path.dirname(resolvedPath);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const dump = await client.getRaw<unknown>(
          `/exporter/${project_id}`,
          undefined,
          { timeout: 300_000 },
        );

        const json = JSON.stringify(dump, null, 2);
        fs.writeFileSync(resolvedPath, json, 'utf-8');

        const stats = fs.statSync(resolvedPath);
        const sizeKb = (stats.size / 1024).toFixed(1);

        const dumpData = dump as Record<string, unknown[]>;
        const summary = {
          file: resolvedPath,
          size_kb: sizeKb,
          userstories: Array.isArray(dumpData.userstories) ? dumpData.userstories.length : 'N/A',
          tasks: Array.isArray(dumpData.tasks) ? dumpData.tasks.length : 'N/A',
          issues: Array.isArray(dumpData.issues) ? dumpData.issues.length : 'N/A',
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: `Project exported successfully.\n${JSON.stringify(summary, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'taiga_import_project',
    'Import a project from a JSON dump file previously exported with taiga_export_project',
    {
      dump_file_path: z.string().describe('Path to the JSON dump file on disk'),
    },
    async ({ dump_file_path }) => {
      try {
        const resolvedPath = dump_file_path.replace(/^~/, process.env.HOME ?? '');

        if (!fs.existsSync(resolvedPath)) {
          return {
            content: [{ type: 'text' as const, text: `Error: File not found: ${resolvedPath}` }],
            isError: true as const,
          };
        }

        const form = new FormData();
        form.append('dump', fs.createReadStream(resolvedPath), {
          filename: path.basename(resolvedPath),
          contentType: 'application/json',
        });

        const result = await client.postFormData<{
          id: number;
          name: string;
          slug: string;
        }>('/importer/load_dump', form);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Project imported successfully.\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
