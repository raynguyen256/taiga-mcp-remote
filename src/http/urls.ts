export function buildPublicUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}

export function getMcpEndpointUrl(baseUrl: string): string {
  return buildPublicUrl(baseUrl, '/mcp');
}

export function getAuthLoginUrl(baseUrl: string): string {
  return buildPublicUrl(baseUrl, '/auth/login');
}

export function getOAuthSubmitUrl(baseUrl: string): string {
  return buildPublicUrl(baseUrl, '/oauth/authorize/submit');
}
