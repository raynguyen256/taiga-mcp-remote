export interface AppConfig {
  baseUrl: string;
  tokenRefreshThreshold: number;
  cacheTtl: number;
  requestTimeout: number;
  maxRetries: number;
  port: number;
  sessionTtl: number;
  mcpServerUrl: string;
  corsOrigins: string[];
  bootstrapToken?: string;
  taigaUsername?: string;
  taigaPassword?: string;
}

export function loadAppConfig(): AppConfig {
  const baseUrl = process.env.TAIGA_BASE_URL;
  if (!baseUrl) throw new Error('TAIGA_BASE_URL environment variable is required');

  const corsRaw = process.env.CORS_ORIGINS ?? '*';
  const corsOrigins = corsRaw === '*' ? ['*'] : corsRaw.split(',').map(s => s.trim());

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    tokenRefreshThreshold: parseInt(process.env.TAIGA_TOKEN_REFRESH_THRESHOLD ?? '72000', 10),
    cacheTtl: parseInt(process.env.TAIGA_CACHE_TTL ?? '300', 10),
    requestTimeout: parseInt(process.env.TAIGA_REQUEST_TIMEOUT ?? '30000', 10),
    maxRetries: parseInt(process.env.TAIGA_MAX_RETRIES ?? '3', 10),
    port: parseInt(process.env.PORT ?? '3000', 10),
    sessionTtl: parseInt(process.env.SESSION_TTL ?? '86400', 10),
    mcpServerUrl: process.env.MCP_SERVER_URL ?? 'http://localhost:3000',
    corsOrigins,
    bootstrapToken: process.env.TAIGA_BOOTSTRAP_TOKEN,
    taigaUsername: process.env.TAIGA_USERNAME,
    taigaPassword: process.env.TAIGA_PASSWORD,
  };
}
