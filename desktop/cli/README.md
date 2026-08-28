# AiWorks Sample App CLI

A standalone Node.js CLI that establishes a persistent WebSocket tunnel to the AiWorks Sample App cloud, enabling your local MCP servers to be used in advisory board sessions.

## Prerequisites

- Node.js 18+ (`node --version` to check)
- npm or yarn

## Installation

### Global install

```bash
npm install -g aiworks-cli
```

### Local development

```bash
git clone https://github.com/yourorg/aiworks-sample-app.git
cd aiworks-sample-app/desktop/cli
npm ci
npm run build
npm link   # makes `aiworks` available globally without publishing
```

After `npm link`, the `aiworks` command is available globally. Re-run `npm run build` after any source changes.

### Run directly without npm link

```bash
cd aiworks-sample-app/desktop/cli
npm ci
npm run build
node dist/main.js
```

Set `DESKTOP_CLI_API_URL` to point at your local backend:

```bash
DESKTOP_CLI_API_URL=http://localhost:8000 node dist/main.js
```

## Setup

### 1. Create `mcpServers.json`

Create a configuration file at the platform-appropriate location:

**Linux / macOS:**
```
~/.config/aiworks/mcpServers.json
```

**Windows:**
```
%APPDATA%\aiworks\mcpServers.json
```

Format (same as Claude Desktop):

```json
{
  "mcpServers": {
    "blender": {
      "command": "uvx",
      "args": ["blender-mcp"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    },
    "github": {
      "command": "uvx",
      "args": ["github-mcp"]
    }
  }
}
```

Each key is the server display name. `command` is required; `args` is optional.

## Usage

The CLI generates a `tunnel_api_key` locally on first run and sends only that key to the server (no JWT, no authentication). The server returns a `tunnel_id` which the CLI caches locally.

```bash
aiworks
```

The CLI will:
1. Load `mcpServers.json` and spawn each MCP server
2. Open a WebSocket tunnel to the cloud
3. Output `tunnel_id: t_xxx` to stdout once connected

### CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--config <path>` | Path to `mcpServers.json` | Platform default |
| `--api-url <url>` | REST API base URL (for dev) | `https://my.app.url/api` |
| `--ws-url <url>` | WebSocket endpoint | Derived from api-url |
| `--help` | Show help | — |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DESKTOP_CLI_API_URL` | REST API base URL (e.g. `https://my.app.url/api`) |
| `DESKTOP_CLI_WS_URL` | WebSocket endpoint URL |

## Development

To run against a local backend (e.g. `http://localhost:8000`):

```bash
DESKTOP_CLI_API_URL=http://localhost:8000 aiworks
```

Or set the env var and use `npm run build && npm link` as usual.

## Tunnel Lifecycle

**First connect** (no cached `tunnel_id`):
- CLI generates `tunnel_api_key` locally
- Sends `{ "tunnel_api_key": "xxx" }` to `POST /api/mcp-tunnel/connect/`
- Server returns `{ "tunnel_id": "t_xxx" }`
- CLI caches both locally

**Reconnect** (has cached `tunnel_id`):
- CLI sends `{ "tunnel_id": "t_xxx", "tunnel_api_key": "xxx" }` via WebSocket
- Server validates key matches
- On success: returns `{ "type": "connected", "tunnel_id": "t_xxx" }`
- On 404: CLI wipes cache and registers a fresh tunnel

## Claiming the Tunnel

After connecting, claim your tunnel so it is associated with your user account:

```bash
# Using the tunnel_id from CLI output
curl -X POST https://my.app.url/api/mcp-tunnel/<tunnel_id>/claim \
  -H "Authorization: Bearer <your_user_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"tunnel_api_key": "<tk_xxx>"}'
```

## Using Local MCP Servers in a Session

1. Ensure the CLI is running and shows `tunnel_id: t_xxx`
2. Claim the tunnel via the API (see above)
3. In the web UI, create a new session — the Attachment Toolbar (paperclip icon) will show your local MCP servers under **Local MCP Servers** (Pro users only)
4. Select the servers you want to attach and run the session

## Reconnect Behaviour

If the WebSocket disconnects, the CLI will automatically reconnect with exponential backoff (up to 30 seconds). On successful reconnect it will resume the same tunnel session transparently — the `tunnel_id` remains valid.

## Uninstall

```bash
npm uninstall -g aiworks-cli
# Also remove config files:
rm -rf ~/.config/aiworks
# (Windows: del %APPDATA%\aiworks)
```

## Architecture

```
desktop shell                         cloud                        executor
    │                                  │                              │
    │ ═══════ WS tunnel ═════════════► │                              │
    │                                  │                              │
    │                                  │ ◄── prepare_tools_for_session│
    │ ◄── pull_tools ───────────────── │                              │
    │ ──── tools manifest ───────────► │                              │
    │                                  │ ──► builds LangChain tools     │
    │                                  │                              │
    │                                  │ ◄── executor calls tool ────── │
    │ ◄── call ─────────────────────── │                              │
    │ ──── result ───────────────────► │ ──► result ─────────────────► │
```

The CLI initiates a persistent outbound TLS WebSocket to the cloud. All MCP tool calls flow through this tunnel, allowing the cloud executor to use your local MCP servers without exposing them to the internet.