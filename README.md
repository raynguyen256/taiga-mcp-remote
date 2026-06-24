# Taiga Remote MCP Server

A remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for [Taiga](https://taiga.io) project management. Runs as an HTTP service — multiple users can connect simultaneously, each authenticating with their own Taiga account.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start with Docker](#quick-start-with-docker)
- [Deploy on Render](#deploy-on-render)
- [Manual Installation](#manual-installation)
- [Environment Variables](#environment-variables)
- [Authentication Modes](#authentication-modes)
- [Connecting an MCP Client](#connecting-an-mcp-client)
- [API Endpoints](#api-endpoints)
- [Session Refresh Script](#session-refresh-script)

---

## Architecture Overview

```
MCP Client (e.g. LibreChat, Claude)
        │  OAuth 2.1 / Bearer <access-token>
        ▼
┌─────────────────────────────┐
│   Taiga Remote MCP Server   │
│   (this repo, port 3000)    │
│                             │
│  /authorize   ─► Taiga login│
│  /token       ─► OAuth token│
│  /mcp         ─► sprints …  │
└──────────┬──────────────────┘
           │  Taiga REST API calls
           ▼
    Taiga Backend Server
```

OAuth-capable MCP clients can now discover this server, open the authorization flow, let each user sign in with their own Taiga account, and receive a per-user Bearer access token automatically. The legacy `/auth/login` page still exists for manual token workflows.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Docker + Docker Compose | any recent version (for Docker deploy) |
| A running Taiga instance | v6+ |

---

## Quick Start with Docker

### 1. Clone the repository

```bash
git clone https://github.com/raynguyen256/Enosta-Taiga-RemoteMCP.git
cd Enosta-Taiga-RemoteMCP
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in **at minimum**:

```
TAIGA_BASE_URL=https://taiga.enosta.com/api/v1
MCP_SERVER_URL=https://your-mcp-server-domain.com
PORT=3000
```

> See [Environment Variables](#environment-variables) for all options.

### 3. Start with Docker Compose

```bash
docker-compose up -d
```

The server will be available at `http://localhost:3000` (or the port you set).

---

## Deploy on Render

This repo includes a [`render.yaml`](./render.yaml) Blueprint for a single free web service on Render.

### 1. Push the repository to GitHub/GitLab

Render creates Blueprint services from a Git repository, so make sure this repo is pushed first.

### 2. Create a new Blueprint service

1. In Render, click **New** → **Blueprint**.
2. Connect the repository that contains this project.
3. Render will detect `render.yaml` and propose a web service named `taiga-mcp-remote`.
4. Review the region before creation. The Blueprint defaults to `singapore`; change it if your Taiga server or users are closer to another Render region.

### 3. Fill in the required environment variable

Render will prompt you for:

- `TAIGA_BASE_URL` — for example `https://taiga.example.com/api/v1`

The Blueprint also preconfigures:

- `PORT=3000`
- `CORS_ORIGINS=*`
- sensible defaults for session TTL, OAuth token TTL, cache TTL, request timeout, and retry count

### 4. Deploy

Finish the Blueprint setup and wait for the first deploy to complete.

When deployed on Render, the server automatically uses Render's default public URL (`RENDER_EXTERNAL_URL`) as `MCP_SERVER_URL` if you did not set `MCP_SERVER_URL` manually.

This means the first deploy works without needing to know the final `onrender.com` URL in advance.

### 5. Verify the service

Open:

- `https://<your-service>.onrender.com/health`
- `https://<your-service>.onrender.com/.well-known/oauth-protected-resource/mcp`
- `https://<your-service>.onrender.com/auth/login`

If `/health` returns JSON and the `.well-known` endpoint loads, the MCP server is ready to test.

### Optional: use a custom domain

If you later attach a custom domain in Render, explicitly set:

```bash
MCP_SERVER_URL=https://your-custom-domain.com
```

Otherwise the server will keep advertising the default `onrender.com` URL in OAuth metadata.

### Important free-tier note

This project currently keeps sessions in memory only. If the Render free instance sleeps or restarts, active MCP/login sessions are lost and users need to authenticate again.

---

## Manual Installation

### 1. Clone and install dependencies

```bash
git clone https://github.com/raynguyen256/Enosta-Taiga-RemoteMCP.git
cd Enosta-Taiga-RemoteMCP
npm install
```

### 2. Create your `.env` file

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Build TypeScript

```bash
npm run build
```

### 4. Start the server

```bash
npm start
```

For development with auto-rebuild on save:

```bash
npm run dev
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure the values below. **Never commit your `.env` file.**

### Required

| Variable | Example | Description |
|---|---|---|
| `TAIGA_BASE_URL` | `https://taiga.enosta.com/api/v1` | Full URL to your Taiga REST API. No trailing slash. |

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | TCP port the HTTP server listens on. |
| `MCP_SERVER_URL` | `http://localhost:3000` | Public-facing URL of this MCP server. Used in OAuth metadata responses and logs. Must be reachable by MCP clients. On Render, if unset, the server falls back to `RENDER_EXTERNAL_URL`. |
| `CORS_ORIGINS` | `*` | Allowed CORS origins for browser-based clients. Use `*` to allow all, or a comma-separated list: `https://app1.com,https://app2.com`. |

### Session

| Variable | Default | Description |
|---|---|---|
| `SESSION_TTL` | `86400` | How long (in seconds) a user session stays valid after login. `86400` = 24 hours. After expiry the user must log in again. |
| `OAUTH_ACCESS_TOKEN_TTL` | `3600` | OAuth access token lifetime in seconds. Refresh tokens remain usable until `SESSION_TTL` is reached. |

### Performance & Reliability

| Variable | Default | Description |
|---|---|---|
| `TAIGA_CACHE_TTL` | `300` | How long (in seconds) to cache static lookups — project members, issue types, statuses, priorities. Reduces repeated API calls. `300` = 5 minutes. |
| `TAIGA_REQUEST_TIMEOUT` | `30000` | Per-request timeout in milliseconds when calling the Taiga API. `30000` = 30 seconds. |
| `TAIGA_MAX_RETRIES` | `3` | Number of retry attempts on transient network errors before giving up. |
| `TAIGA_TOKEN_REFRESH_THRESHOLD` | `72000` | Seconds before a Taiga auth token's age triggers a background refresh. Default is 20 hours. Only relevant in Bootstrap mode. |

### Bootstrap Mode (Optional — Single-user / CI)

> **These three variables work as a group.** All three must be set to activate Bootstrap mode. If any is missing, Bootstrap mode is disabled and the server runs in standard multi-user mode.

> **Important:** In the standard multi-user setup you do **not** need to fill in `TAIGA_USERNAME` or `TAIGA_PASSWORD` here. Each user authenticates individually through the `/auth/login` web page. Only set these if you specifically want the server to log in automatically on startup under a single shared account (e.g. for an AI assistant or CI pipeline with a dedicated Taiga service account).

| Variable | Description |
|---|---|
| `TAIGA_BOOTSTRAP_TOKEN` | A fixed UUID you generate once. This becomes the permanent Bearer token for the bootstrap session. Generate with: `node -e "console.log(require('crypto').randomUUID())"` |
| `TAIGA_USERNAME` | *(Bootstrap only)* Username of the Taiga service account. Leave empty for multi-user deployments. |
| `TAIGA_PASSWORD` | *(Bootstrap only)* Password of the Taiga service account. Leave empty for multi-user deployments. |

---

## Authentication Modes

### Mode 1 — Multi-user (recommended for teams)

The default mode. No credentials in `.env` required.

1. The MCP client discovers `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-authorization-server`.
2. The client opens `GET /authorize` in the user’s browser.
3. The user signs in with their own Taiga username/email and password.
4. The server returns an OAuth access token for `/mcp` plus a refresh token.
5. The access token expires after `OAUTH_ACCESS_TOKEN_TTL` seconds and the refresh token remains valid until `SESSION_TTL` is reached.

### Legacy Manual Token Mode

Still available for clients that do not support MCP OAuth yet.

1. Open `https://your-mcp-server-domain.com/auth/login`.
2. Enter Taiga credentials.
3. Copy the returned session token and configure it manually as `Authorization: Bearer <token>`.

### Mode 2 — Bootstrap (single-user / AI assistant)

Useful when one shared Taiga account drives an AI assistant or automated pipeline.

1. Generate a stable UUID: `node -e "console.log(require('crypto').randomUUID())"`
2. Set `TAIGA_BOOTSTRAP_TOKEN`, `TAIGA_USERNAME`, and `TAIGA_PASSWORD` in `.env`.
3. On startup the server auto-logs in and registers the bootstrap token.
4. The server refreshes the Taiga auth token in the background automatically.
5. The bootstrap token never expires (TTL set to 100 years).

---

## Connecting an MCP Client

### LibreChat

If your client does not support MCP OAuth yet, use a manual Bearer token from `/auth/login`:

```yaml
mcpServers:
  - name: Taiga
    url: https://your-mcp-server-domain.com/mcp
    headers:
      Authorization: "Bearer <your-session-token>"
```

### Claude Desktop / claude.ai

In your MCP config, set:

```json
{
  "mcpServers": {
    "taiga": {
      "url": "https://your-mcp-server-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer <your-session-token>"
      }
    }
  }
}
```

Replace `<your-session-token>` with the token you received from `/auth/login`.

For OAuth-aware MCP clients, point them at `https://your-mcp-server-domain.com/mcp` and let discovery/authorization run automatically.

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/authorize` | OAuth client | Start OAuth authorization code flow for `/mcp`. |
| `POST` | `/authorize/submit` | Browser form | Submit Taiga credentials for the current OAuth authorization request. |
| `POST` | `/token` | OAuth client | Exchange authorization code or refresh token for an access token. |
| `POST` | `/register` | OAuth client | Dynamic OAuth client registration endpoint. |
| `GET` | `/.well-known/oauth-protected-resource/mcp` | — | OAuth 2.0 protected resource metadata for the MCP endpoint. |
| `GET` | `/.well-known/oauth-authorization-server` | — | OAuth 2.0 authorization server metadata. |
| `GET` | `/auth/login` | — | Web login page — opens in a browser to get a token. |
| `POST` | `/auth/login` | — | JSON login: `{ "username": "...", "password": "..." }` → returns `{ token, expires_at, username }`. |
| `POST` | `/auth/refresh` | Bearer | Extend the current session and get a refreshed expiry. |
| `DELETE` | `/auth/logout` | Bearer | Invalidate the current session token. |
| `GET` | `/auth/status` | Bearer | Check if the current token is valid and see its expiry. |
| `POST` | `/mcp` | Bearer | Main MCP endpoint — all tool calls go here. |
| `GET` | `/.well-known/oauth-protected-resource` | — | Legacy metadata alias kept for compatibility. |

---

## Session Refresh Script

`scripts/refresh-session.sh` is a helper for non-bootstrap deployments that need to keep a token alive automatically (e.g. for a LibreChat integration).

It tries to refresh the existing token first; if that fails it falls back to a full login.

```bash
# Example: run every 6 hours via cron
0 */6 * * * TAIGA_MCP_URL=https://your-mcp-server.com TAIGA_MCP_TOKEN=<uuid> /path/to/scripts/refresh-session.sh >> /var/log/taiga-mcp-refresh.log 2>&1
```

Set `LIBRECHAT_CONFIG=/path/to/librechat.yaml` to have the script automatically update the Bearer token in your LibreChat config file after a successful refresh.

---

## Security Notes

- `.env` is listed in `.gitignore` — **never commit it**.
- `TAIGA_USERNAME` and `TAIGA_PASSWORD` in `.env` are for Bootstrap mode only. In a multi-user deployment these fields should remain **empty**.
- Use HTTPS in production. Set `MCP_SERVER_URL` to your HTTPS domain.
- Restrict `CORS_ORIGINS` to trusted domains in production instead of using `*`.
