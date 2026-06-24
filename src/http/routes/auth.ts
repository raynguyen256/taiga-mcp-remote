import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { InMemorySessionStore } from '../../session/sessionStore.js';
import type { AppConfig } from '../../types/config.js';
import { createBearerAuth } from '../middleware/bearerAuth.js';
import {
  createAndStoreSession,
  InvalidTaigaCredentialsError,
  loginToTaiga,
  refreshTaigaAccessToken,
  TaigaUpstreamError,
} from '../../session/sessionService.js';
import { getMcpEndpointUrl } from '../urls.js';

const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Taiga MCP — Get Your Token</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f1117; color: #e2e8f0; min-height: 100vh;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .card {
      background: #1a1d27; border: 1px solid #2d3148; border-radius: 12px;
      padding: 2rem; width: 100%; max-width: 420px;
    }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: .25rem; }
    .sub { font-size: .875rem; color: #64748b; margin-bottom: 1.5rem; }
    label { display: block; font-size: .8125rem; color: #94a3b8; margin-bottom: .375rem; }
    input {
      width: 100%; padding: .625rem .75rem; background: #0f1117;
      border: 1px solid #2d3148; border-radius: 8px; color: #e2e8f0;
      font-size: .9375rem; outline: none; transition: border-color .15s;
    }
    input:focus { border-color: #6366f1; }
    .field { margin-bottom: 1rem; }
    button {
      width: 100%; padding: .7rem; background: #6366f1; color: #fff;
      border: none; border-radius: 8px; font-size: .9375rem; font-weight: 500;
      cursor: pointer; margin-top: .5rem; transition: background .15s;
    }
    button:hover { background: #4f46e5; }
    button:disabled { background: #3730a3; cursor: not-allowed; }
    .result { display: none; margin-top: 1.5rem; }
    .result.show { display: block; }
    .result-label { font-size: .8125rem; color: #94a3b8; margin-bottom: .5rem; }
    .token-box {
      background: #0f1117; border: 1px solid #2d3148; border-radius: 8px;
      padding: .75rem; font-family: monospace; font-size: .8125rem;
      word-break: break-all; color: #a5b4fc; position: relative;
    }
    .copy-btn {
      width: auto; padding: .5rem 1rem; font-size: .8125rem;
      margin-top: .75rem; background: #1e2035;
    }
    .copy-btn:hover { background: #2d3148; }
    .info { font-size: .8rem; color: #64748b; margin-top: .75rem; }
    .error {
      background: #2d1515; border: 1px solid #7f1d1d; border-radius: 8px;
      padding: .75rem; color: #fca5a5; font-size: .875rem;
      margin-top: 1rem; display: none;
    }
    .error.show { display: block; }
    .success-name { color: #86efac; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Taiga MCP Server</h1>
    <p class="sub">Login with your Taiga account to get a personal token</p>

    <div class="field">
      <label for="username">Username</label>
      <input id="username" type="text" placeholder="your_taiga_username" autocomplete="username">
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input id="password" type="password" placeholder="••••••••" autocomplete="current-password">
    </div>
    <button id="loginBtn" onclick="doLogin()">Get Token</button>

    <div class="error" id="errorBox"></div>

    <div class="result" id="result">
      <p class="result-label">Logged in as <span class="success-name" id="displayName"></span></p>
      <p class="result-label" style="margin-top:.75rem">Your personal MCP token:</p>
      <div class="token-box" id="tokenBox"></div>
      <button class="copy-btn" onclick="copyToken()">Copy Token</button>
      <p class="info">Paste this token into LibreChat → MCP Settings → Taiga MCP Token.<br>
        Expires: <span id="expiresAt"></span></p>
    </div>
  </div>

  <script>
    async function doLogin() {
      const btn = document.getElementById('loginBtn');
      const errorBox = document.getElementById('errorBox');
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      errorBox.className = 'error';
      if (!username || !password) {
        errorBox.textContent = 'Please enter username and password.';
        errorBox.className = 'error show'; return;
      }

      btn.disabled = true; btn.textContent = 'Logging in…';

      try {
        const res = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          errorBox.textContent = data.error || 'Login failed.';
          errorBox.className = 'error show';
          return;
        }

        document.getElementById('displayName').textContent = data.username;
        document.getElementById('tokenBox').textContent = data.token;
        document.getElementById('expiresAt').textContent = new Date(data.expires_at).toLocaleString();
        document.getElementById('result').className = 'result show';
        document.getElementById('password').value = '';
      } catch {
        errorBox.textContent = 'Network error — is the server running?';
        errorBox.className = 'error show';
      } finally {
        btn.disabled = false; btn.textContent = 'Get Token';
      }
    }

    function copyToken() {
      const token = document.getElementById('tokenBox').textContent;
      navigator.clipboard.writeText(token).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy Token', 2000);
      });
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  </script>
</body>
</html>`;

export function createAuthRouter(sessionStore: InMemorySessionStore, config: AppConfig): Router {
  const router = Router();
  const bearerAuth = createBearerAuth(sessionStore);

  router.get('/login', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(LOGIN_PAGE);
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    try {
      const token = uuidv4();
      const now = Date.now();
      const expiresAt = now + config.sessionTtl * 1000;
      const taigaAuth = await loginToTaiga(config, username, password);

      createAndStoreSession(sessionStore, config, {
        token,
        username: taigaAuth.username,
        taigaToken: taigaAuth.auth_token,
        taigaRefreshToken: taigaAuth.refresh,
        expiresAt,
        accessTokenExpiresAt: expiresAt,
        scopes: ['mcp'],
        resource: getMcpEndpointUrl(config.mcpServerUrl),
      });

      res.json({
        token,
        expires_at: new Date(expiresAt).toISOString(),
        username: taigaAuth.username,
      });
    } catch (err) {
      if (err instanceof InvalidTaigaCredentialsError) {
        res.status(401).json({ error: 'Invalid username or password' });
        return;
      }
      if (err instanceof TaigaUpstreamError) {
        res.status(502).json({ error: 'Failed to reach Taiga server' });
        return;
      }
      res.status(500).json({ error: 'Unexpected authentication error' });
    }
  });

  router.post('/refresh', bearerAuth, async (req, res) => {
    const session = req.userSession!;

    try {
      session.taigaToken = await refreshTaigaAccessToken(config, session.taigaRefreshToken);
      const newExpiresAt = Date.now() + config.sessionTtl * 1000;
      session.expiresAt = newExpiresAt;
      session.accessTokenExpiresAt = newExpiresAt;
      session.tokenCreatedAt = new Date().toISOString();
      sessionStore.set(session.token, session);

      res.json({
        token: session.token,
        expires_at: new Date(newExpiresAt).toISOString(),
        username: session.username,
      });
    } catch {
      res.status(401).json({ error: 'Token refresh failed — please login again' });
    }
  });

  router.delete('/logout', bearerAuth, (req, res) => {
    sessionStore.delete(req.userSession!.token);
    res.json({ message: 'Logged out successfully' });
  });

  router.get('/status', bearerAuth, (req, res) => {
    const session = req.userSession!;
    res.json({
      authenticated: true,
      username: session.username,
      token_created_at: session.tokenCreatedAt,
      expires_at: new Date(session.accessTokenExpiresAt ?? session.expiresAt).toISOString(),
      session_expires_at:
        session.accessTokenExpiresAt && session.accessTokenExpiresAt !== session.expiresAt
          ? new Date(session.expiresAt).toISOString()
          : undefined,
    });
  });

  return router;
}
