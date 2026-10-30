# AIWorks Sample App

A comprehensive AI-powered research application built on aiworks-core with registration, login, knowledge bases, MCP integration, and free/pro tier separation.

---

## Features

- **Authentication**: Email/password + Google OAuth
- **Research Sessions**: AI-powered research with daily limits
- **Knowledge Bases**: Upload and manage documents for research
- **MCP Integration**: Connect to MCP servers for extended capabilities
- **Tier System**: Free tier and Pro tier, with configurable daily research limits (defaults: 0/day free, 5/day pro)

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Python 3.12+ (for local development)

The stack attaches to an externally-managed Docker network named `web-proxy`.
Create it once before the first start:

```bash
docker network create web-proxy
```

### Deployment with Docker Compose

1. **Clone and setup environment:**

   ```bash
   cd aiworks-sample-app

   # Copy environment template
   cp .env.example .env
   ```

2. **Start services:**

   ```bash
   docker-compose up --build
   ```

   The app will be available at http://localhost:8085/app/

3. **Run migrations on first start:**

   ```bash
   docker-compose exec backend python manage.py migrate aiworks_core
   ```

### Local Development (without Docker)

1. **Backend:**

   ```bash
   cd backend

   # Create a virtualenv — one of:
   uv venv venv                # if uv is already installed
   # python -m venv venv       # otherwise — install_deps.sh bootstraps uv

   source venv/bin/activate

   # Install dependencies
   ./install_deps.sh
   # or manually: uv pip sync --torch-backend=cpu requirements-dev.txt

   # Copy environment
   cp .env.example .env

   # Run migrations
   python manage.py migrate aiworks_core

   # Start server
   python manage.py runserver
   ```

   If `uv` isn't installed yet, install it once with:

   ```bash
   python -m pip install uv
   ```

   `install_deps.sh` and `compile_deps.sh` bootstrap `uv` themselves when it is
   missing, so a plain `python -m venv venv` environment works too.

   `aiworks-core` is installed from Git (see `backend/requirements.in`). To work
   against a local checkout of it instead, put that checkout first on the
   import path — it takes precedence over the installed copy:

   ```bash
   export PYTHONPATH=/path/to/aiworks-core
   ```

2. **Start both services:**

   ```bash
   # From root directory
   ./dev.sh
   ```

   Or individually:

   ```bash
   # Backend
   cd backend
   python manage.py runserver

   # Frontend (in another terminal)
   cd frontend
   npm run dev
   ```

---

## Desktop CLI

`desktop/cli/` is a standalone Node.js CLI that opens a WebSocket tunnel to the
cloud so that MCP servers running on your machine can be attached to a session.
See [`desktop/cli/README.md`](desktop/cli/README.md) for installation and usage.

```bash
cd desktop/cli
npm ci && npm run build
DESKTOP_CLI_API_URL=http://localhost:8085 node dist/main.js
```

---

## Configuration

### Root `.env` (Docker Compose)

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | `aiworks_sample` | PostgreSQL database name |
| `POSTGRES_USER` | `aiworks_user` | PostgreSQL user |
| `POSTGRES_PASSWORD` | — | PostgreSQL password (required) |
| `DEBUG` | `False` | Django debug mode |
| `DJANGO_SECRET_KEY` | — | Django secret key |
| `JWT_SIGNING_KEY` | — | JWT signing key (falls back to the Django secret) |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Django allowed hosts |
| `DB_POOL_SIZE` | `80` | PgBouncer max server connections per pool |
| `DB_POOL_MIN` | `2` | PgBouncer minimum idle server connections |
| `DB_POOL_CLIENT_TIMEOUT` | `30` | PgBouncer server connect timeout (seconds) |
| `DB_POOL_IDLE_TIMEOUT` | `3600` | PgBouncer server idle timeout (seconds) |
| `DB_POOL_MAX_CLIENT_CONN` | `80` | PgBouncer maximum client connections |

### Backend `.env`

Contains the same variables as the root `.env` for local development.

### Site configuration

The site URL, Google OAuth credentials, email delivery and the LLM provider
settings are **not** environment variables — they live in singleton records
edited from the Django admin (`/admin/`):

| Admin object | Holds |
|---|---|
| **Site Configuration** | Site URL, Google client id/secret, email backend, cold storage, CSRF origins |
| **LLM Configuration** | Provider, model names, API keys, per-operation overrides |

### Frontend `.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000/api` | Backend API base URL |

---

## Project Structure

```
aiworks-sample-app/
├── backend/
│   ├── aiworks_sample/       # Django project settings
│   ├── sample_app/           # Custom app (models, hooks, serializers)
│   │   ├── logic/            # App-specific executor/session/email logic
│   │   └── resources/        # Prompt templates and HTML templates
│   ├── requirements.in       # Production dependencies
│   ├── requirements-dev.in   # Development dependencies
│   ├── requirements.txt      # Compiled dependencies
│   ├── install_deps.sh       # Install dependencies
│   ├── compile_deps.sh       # Compile requirements
│   ├── coverage.sh           # Run tests with coverage
│   ├── pytest.ini
│   ├── mypy.ini
│   ├── Dockerfile
│   └── manage.py
├── frontend/
│   ├── components/           # Shared React components
│   ├── contexts/             # React context providers
│   ├── hooks/                # Custom hooks
│   ├── pages/                # Page components
│   ├── services/             # API client and service layer
│   ├── utils/                # Shared utilities
│   ├── public/               # Static assets
│   ├── App.tsx               # Router and app shell
│   ├── index.tsx             # React entry point
│   ├── index.html
│   ├── vite.config.ts        # Vite configuration
│   ├── package.json
│   ├── tsconfig.json
│   └── nginx.conf            # Production nginx config
├── desktop/
│   └── cli/                  # Node CLI — exposes local MCP servers over a tunnel
├── db_pool/                  # PgBouncer connection pool image
│   ├── Dockerfile
│   ├── pgbouncer.ini.tpl
│   ├── userlist.txt.tpl
│   └── pgbouncer-entrypoint.sh
├── proxy/
│   ├── nginx.conf            # Reverse proxy config
│   └── Dockerfile
├── dev.sh                    # Run backend + frontend locally
├── docker-compose.yml         # Docker services
├── .env.example              # Environment template (root)
└── README.md                 # This file
```

---

## Running Tests

The test suite runs against the host app's own layer (`sample_app`). The shared
library behaviour is covered by aiworks-core's own suite.

### Locally:

```bash
cd backend

# Create a virtualenv and install the dev dependencies
uv venv venv                # or: python -m venv venv
source venv/bin/activate
./install_deps.sh

pytest tests/ -v
```

### With Docker:

```bash
docker-compose exec backend pytest tests/ -v
```

### With Coverage:

```bash
cd backend
source venv/bin/activate   # if not already active
./coverage.sh --all
```

---

## API Endpoints

All API endpoints are available under `/api/`.

### Authentication (`/api/auth/`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register/` | Register new user |
| POST | `/api/auth/verify-email/` | Verify email |
| POST | `/api/auth/login/` | Login and get JWT tokens |
| POST | `/api/auth/logout/` | Logout |
| POST | `/api/auth/refresh/` | Refresh access token |
| GET | `/api/auth/me/` | Current user info |
| POST | `/api/auth/password-reset/` | Request password reset |
| POST | `/api/auth/password-reset/confirm/` | Confirm password reset |
| POST | `/api/auth/google/` | Google OAuth sign-in |

### Resources (`/api/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/server-settings/` | Public server settings (Google client id, etc.) |
| GET/POST | `/api/knowledge-bases/` | List/create knowledge bases |
| GET/PUT/DELETE | `/api/knowledge-bases/<id>/` | KB detail operations |
| POST | `/api/knowledge-bases/<id>/upload_files/` | Upload files to KB |
| GET | `/api/predefined-mcp-servers/` | Admin-managed MCP server catalogue |
| GET/POST | `/api/mcp-servers/` | List/create MCP servers |
| GET/PUT/DELETE | `/api/mcp-servers/<id>/` | MCP server detail |
| POST | `/api/mcp-servers/discover-oauth/` | Probe a server for OAuth 2.1 metadata |
| POST | `/api/mcp-servers/oauth-exchange/` | Exchange an OAuth code for a token |
| GET/POST | `/api/sessions/` | List/create sessions |
| GET/PUT/DELETE | `/api/sessions/<id>/` | Session detail operations |
| GET | `/api/memory/` | List memory entries |
| POST | `/api/memory/import/` | Import memory entries |
| DELETE | `/api/memory/<id>/` | Delete memory entry |
| GET | `/api/notifications/` | List notifications |
| POST | `/api/help-chat/` | Help chat |
| GET/POST | `/api/mcp-tunnel/` | Desktop MCP tunnel connect / list |
| POST | `/api/mcp-tunnel/<tunnel_id>/claim/` | Claim a tunnel for a user |
| GET | `/api/mcp-tunnel/<tunnel_id>/servers/` | Tunnel server list |
| GET | `/api/mcp-tunnel/<tunnel_id>/tools/` | Tunnel tool manifest |

---

## Integrating aiworks-core

`aiworks-core` is installed from Git — see `backend/requirements.in`. It is
tracked on the `main` branch; pin the URL to a commit SHA for reproducible
builds.

See [AGENTS.md](https://github.com/rdar-lab/aiworks-core/blob/main/AGENTS.md)
in the aiworks-core repository for a complete integration checklist.
