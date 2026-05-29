# Taiga Remote MCP Server

A remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for [Taiga](https://taiga.io) project management. Runs as an HTTP service — multiple users can connect simultaneously, each authenticating with their own Taiga account.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start with Docker](#quick-start-with-docker)
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
        │  Bearer <session-token>
        ▼
┌─────────────────────────────┐
│   Taiga Remote MCP Server   │
│   (this repo, port 3000)    │
│                             │
│  /auth/login  ─► issues     │
│  /auth/logout ─► tasks      │
│  /mcp         ─► sprints …  │
└──────────┬──────────────────┘
           │  Taiga REST API calls
           ▼
    Taiga Backend Server
```

Each user logs in once via the `/auth/login` page and receives a personal session token (UUID). That token is used as the Bearer token for all MCP requests.

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
TAIGA_BASE_URL=https://your-taiga-domain.com/api/v1
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
| `TAIGA_BASE_URL` | `https://taiga.example.com/api/v1` | Full URL to your Taiga REST API. No trailing slash. |

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | TCP port the HTTP server listens on. |
| `MCP_SERVER_URL` | `http://localhost:3000` | Public-facing URL of this MCP server. Used in OAuth metadata responses and logs. Must be reachable by MCP clients. |
| `CORS_ORIGINS` | `*` | Allowed CORS origins for browser-based clients. Use `*` to allow all, or a comma-separated list: `https://app1.com,https://app2.com`. |

### Session

| Variable | Default | Description |
|---|---|---|
| `SESSION_TTL` | `86400` | How long (in seconds) a user session stays valid after login. `86400` = 24 hours. After expiry the user must log in again. |

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

1. Each user opens `https://your-mcp-server-domain.com/auth/login` in a browser.
2. They enter their own Taiga username and password.
3. They receive a personal session token (UUID).
4. They paste the token into their MCP client as the Bearer token.
5. The session expires after `SESSION_TTL` seconds (default 24 hours). Users can refresh via `POST /auth/refresh` or log in again.

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

In `librechat.yaml`, add an MCP server entry:

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

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/login` | — | Web login page — opens in a browser to get a token. |
| `POST` | `/auth/login` | — | JSON login: `{ "username": "...", "password": "..." }` → returns `{ token, expires_at, username }`. |
| `POST` | `/auth/refresh` | Bearer | Extend the current session and get a refreshed expiry. |
| `DELETE` | `/auth/logout` | Bearer | Invalidate the current session token. |
| `GET` | `/auth/status` | Bearer | Check if the current token is valid and see its expiry. |
| `POST` | `/mcp` | Bearer | Main MCP endpoint — all tool calls go here. |
| `GET` | `/.well-known/oauth-protected-resource` | — | OAuth 2.0 protected resource metadata. |

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
