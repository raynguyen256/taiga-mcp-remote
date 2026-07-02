import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import {
  InvalidGrantError,
  InvalidScopeError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { SessionStore } from '../session/sessionStore.js';
import type { UserSession } from '../session/types.js';
import type { AppConfig } from '../types/config.js';
import {
  createAndStoreSession,
  InvalidTaigaCredentialsError,
  loginToTaiga,
  TaigaUpstreamError,
} from '../session/sessionService.js';
import { getMcpEndpointUrl, getOAuthSubmitUrl } from '../http/urls.js';

interface PendingAuthorization {
  id: string;
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  createdAt: number;
}

interface AuthorizationCodeRecord {
  code: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  accessToken: string;
  resource?: string;
  createdAt: number;
}

class InMemoryOAuthClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return this.clients.get(clientId);
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ): Promise<OAuthClientInformationFull> {
    const hydratedClient = client as OAuthClientInformationFull;
    const now = Math.floor(Date.now() / 1000);
    const clientInfo: OAuthClientInformationFull = {
      ...hydratedClient,
      client_id: hydratedClient.client_id ?? randomUUID(),
      client_id_issued_at: hydratedClient.client_id_issued_at ?? now,
    };

    this.clients.set(clientInfo.client_id, clientInfo);
    return clientInfo;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class TaigaOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new InMemoryOAuthClientsStore();

  private pendingAuthorizations = new Map<string, PendingAuthorization>();
  private authorizationCodes = new Map<string, AuthorizationCodeRecord>();
  private refreshTokens = new Map<string, string>();

  constructor(
    private sessionStore: SessionStore,
    private config: AppConfig,
  ) {}

  private withRequiredScope(scopes?: string[]): string[] {
    return Array.from(new Set([...(scopes ?? []), 'mcp']));
  }

  startCleanup(intervalMs = 300_000): void {
    setInterval(() => {
      const now = Date.now();

      for (const [requestId, pending] of this.pendingAuthorizations) {
        if (pending.createdAt + 10 * 60 * 1000 < now) {
          this.pendingAuthorizations.delete(requestId);
        }
      }

      for (const [code, authorizationCode] of this.authorizationCodes) {
        if (authorizationCode.createdAt + 10 * 60 * 1000 < now) {
          this.authorizationCodes.delete(code);
        }
      }

      for (const [refreshToken, accessToken] of this.refreshTokens) {
        const session = this.sessionStore.get(accessToken);
        if (!session || session.oauthRefreshToken !== refreshToken) {
          this.refreshTokens.delete(refreshToken);
        }
      }
    }, intervalMs).unref();
  }

  getPendingAuthorization(requestId: string): PendingAuthorization | undefined {
    return this.pendingAuthorizations.get(requestId);
  }

  renderAuthorizationPage(pending: PendingAuthorization, error?: string): string {
    const clientName = pending.client.client_name ?? pending.client.client_id;
    const redirectUri = pending.params.redirectUri;
    const scopes = pending.params.scopes?.length ? pending.params.scopes.join(' ') : 'mcp';
    const submitUrl = getOAuthSubmitUrl(this.config.mcpServerUrl);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Taiga MCP</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f1117; color: #e2e8f0; min-height: 100vh;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .card {
      background: #1a1d27; border: 1px solid #2d3148; border-radius: 12px;
      padding: 2rem; width: 100%; max-width: 480px;
    }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: .25rem; }
    .sub { font-size: .875rem; color: #94a3b8; margin-bottom: 1.25rem; line-height: 1.5; }
    .meta {
      background: #0f1117; border: 1px solid #2d3148; border-radius: 8px;
      padding: .875rem; margin-bottom: 1.25rem; font-size: .8125rem; line-height: 1.5;
    }
    .meta strong { color: #cbd5e1; display: inline-block; min-width: 88px; }
    label { display: block; font-size: .8125rem; color: #94a3b8; margin-bottom: .375rem; }
    input {
      width: 100%; padding: .625rem .75rem; background: #0f1117;
      border: 1px solid #2d3148; border-radius: 8px; color: #e2e8f0;
      font-size: .9375rem; outline: none;
    }
    .field { margin-bottom: 1rem; }
    button {
      width: 100%; padding: .75rem; background: #2563eb; color: #fff;
      border: none; border-radius: 8px; font-size: .9375rem; font-weight: 500;
      cursor: pointer;
    }
    .error {
      background: #2d1515; border: 1px solid #7f1d1d; border-radius: 8px;
      padding: .75rem; color: #fca5a5; font-size: .875rem; margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize Taiga MCP</h1>
    <p class="sub">Sign in with your Taiga account to authorize this MCP client.</p>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <div class="meta">
      <div><strong>Client</strong> ${escapeHtml(clientName)}</div>
      <div><strong>Redirect</strong> ${escapeHtml(redirectUri)}</div>
      <div><strong>Scopes</strong> ${escapeHtml(scopes)}</div>
    </div>
    <form method="post" action="${escapeHtml(submitUrl)}">
      <input type="hidden" name="request_id" value="${escapeHtml(pending.id)}">
      <div class="field">
        <label for="username">Username or email</label>
        <input id="username" name="username" type="text" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
      </div>
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>`;
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const pending: PendingAuthorization = {
      id: randomUUID(),
      client,
      params,
      createdAt: Date.now(),
    };

    this.pendingAuthorizations.set(pending.id, pending);
    res.status(200).type('html').send(this.renderAuthorizationPage(pending));
  }

  async completeAuthorization(
    requestId: string,
    username: string,
    password: string,
  ): Promise<string> {
    const pending = this.pendingAuthorizations.get(requestId);
    if (!pending) {
      throw new InvalidGrantError('Authorization request expired or is invalid');
    }

    if (!username || !password) {
      throw new InvalidTaigaCredentialsError();
    }

    let taigaAuth;
    try {
      taigaAuth = await loginToTaiga(this.config, username, password);
    } catch (err) {
      if (err instanceof InvalidTaigaCredentialsError || err instanceof TaigaUpstreamError) {
        throw err;
      }
      throw new TaigaUpstreamError();
    }

    const accessToken = randomUUID();
    const refreshToken = randomUUID();
    const now = Date.now();
    const resource = pending.params.resource?.toString() ?? getMcpEndpointUrl(this.config.mcpServerUrl);

    const session = createAndStoreSession(this.sessionStore, this.config, {
      token: accessToken,
      username: taigaAuth.username,
      taigaToken: taigaAuth.auth_token,
      taigaRefreshToken: taigaAuth.refresh,
      expiresAt: now + this.config.sessionTtl * 1000,
      accessTokenExpiresAt: now + this.config.oauthAccessTokenTtl * 1000,
      oauthRefreshToken: refreshToken,
      clientId: pending.client.client_id,
      scopes: this.withRequiredScope(pending.params.scopes),
      resource,
    });

    const authorizationCode = randomUUID();
    this.authorizationCodes.set(authorizationCode, {
      code: authorizationCode,
      clientId: pending.client.client_id,
      codeChallenge: pending.params.codeChallenge,
      redirectUri: pending.params.redirectUri,
      accessToken: session.token,
      resource,
      createdAt: now,
    });

    this.refreshTokens.set(refreshToken, session.token);
    this.pendingAuthorizations.delete(requestId);

    const targetUrl = new URL(pending.params.redirectUri);
    targetUrl.searchParams.set('code', authorizationCode);
    if (pending.params.state) {
      targetUrl.searchParams.set('state', pending.params.state);
    }

    return targetUrl.toString();
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const code = this.authorizationCodes.get(authorizationCode);
    if (!code || code.clientId !== client.client_id) {
      throw new InvalidGrantError('Invalid authorization code');
    }

    return code.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const code = this.authorizationCodes.get(authorizationCode);
    if (!code || code.clientId !== client.client_id) {
      throw new InvalidGrantError('Invalid authorization code');
    }

    if (redirectUri && redirectUri !== code.redirectUri) {
      throw new InvalidGrantError('redirect_uri does not match the original request');
    }

    if (resource && code.resource && resource.toString() !== code.resource) {
      throw new InvalidGrantError('resource does not match the original request');
    }

    const session = this.sessionStore.get(code.accessToken);
    if (!session) {
      throw new InvalidGrantError('Authorization code has expired');
    }

    this.authorizationCodes.delete(authorizationCode);
    return this.tokensFromSession(session);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const accessToken = this.refreshTokens.get(refreshToken);
    if (!accessToken) {
      throw new InvalidGrantError('Invalid refresh token');
    }

    const session = this.sessionStore.get(accessToken);
    if (!session || session.oauthRefreshToken !== refreshToken) {
      this.refreshTokens.delete(refreshToken);
      throw new InvalidGrantError('Invalid refresh token');
    }

    if (session.clientId !== client.client_id) {
      throw new InvalidGrantError('Refresh token was not issued to this client');
    }

    if (scopes?.length) {
      const existingScopes = session.scopes ?? ['mcp'];
      if (!scopes.every(scope => existingScopes.includes(scope))) {
        throw new InvalidScopeError('Requested scope exceeds original grant');
      }
      session.scopes = this.withRequiredScope(scopes);
    }

    if (resource) {
      session.resource = resource.toString();
    }

    const newAccessToken = randomUUID();
    const newRefreshToken = randomUUID();

    this.sessionStore.delete(accessToken);
    this.refreshTokens.delete(refreshToken);

    session.token = newAccessToken;
    session.oauthRefreshToken = newRefreshToken;
    session.accessTokenExpiresAt = Date.now() + this.config.oauthAccessTokenTtl * 1000;
    session.tokenCreatedAt = new Date().toISOString();

    this.sessionStore.set(newAccessToken, session);
    this.refreshTokens.set(newRefreshToken, newAccessToken);

    return this.tokensFromSession(session);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const session = this.sessionStore.get(token);
    if (!session) {
      throw new InvalidTokenError('Invalid or expired token');
    }

    const accessTokenExpiresAt = session.accessTokenExpiresAt ?? session.expiresAt;
    if (accessTokenExpiresAt < Date.now()) {
      throw new InvalidTokenError('Token has expired');
    }

    return {
      token,
      clientId: session.clientId ?? 'legacy-client',
      scopes: session.scopes ?? ['mcp'],
      expiresAt: Math.floor(accessTokenExpiresAt / 1000),
      resource: session.resource ? new URL(session.resource) : undefined,
      extra: { username: session.username },
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const token = request.token;

    const accessToken = this.refreshTokens.get(token);
    if (accessToken) {
      const session = this.sessionStore.get(accessToken);
      if (session?.clientId === client.client_id) {
        this.sessionStore.delete(accessToken);
      }
      this.refreshTokens.delete(token);
      return;
    }

    const session = this.sessionStore.get(token);
    if (!session || session.clientId !== client.client_id) {
      return;
    }

    if (session.oauthRefreshToken) {
      this.refreshTokens.delete(session.oauthRefreshToken);
    }
    this.sessionStore.delete(token);
  }

  private tokensFromSession(session: UserSession): OAuthTokens {
    const accessTokenExpiresAt = session.accessTokenExpiresAt ?? session.expiresAt;
    return {
      access_token: session.token,
      token_type: 'bearer',
      expires_in: Math.max(0, Math.floor((accessTokenExpiresAt - Date.now()) / 1000)),
      refresh_token: session.oauthRefreshToken,
      scope: (session.scopes ?? ['mcp']).join(' '),
    };
  }
}
