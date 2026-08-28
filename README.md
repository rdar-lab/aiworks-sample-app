# AIWorks Sample App

A comprehensive AI-powered research application built on aiworks-core with registration, login, knowledge bases, MCP integration, and free/pro tier separation.

---

## Features

- **Authentication**: Email/password + Google OAuth
- **Research Sessions**: AI-powered research with daily limits
- **Knowledge Bases**: Upload and manage documents for research
- **MCP Integration**: Connect to MCP servers for extended capabilities
- **Tier System**: Free tier (3 research/day) and Pro tier (unlimited)

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Python 3.12+ (for local development)

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

   The app will be available at http://localhost:8085

3. **Run migrations on first start:**

   ```bash
   docker-compose exec backend python manage.py migrate aiworks_core
   ```

### Local Development (without Docker)

1. **Backend:**

   ```bash
   cd backend

   # Install dependencies
   ./install_deps.sh
   # or manually: uv pip sync --torch-backend=cpu requirements-dev.txt

   # Copy environment
   cp .env.example .env

   # Run migrations
   PYTHONPATH=/home/xmaster/aiworks-core python manage.py migrate aiworks_core

   # Start server
   PYTHONPATH=/home/xmaster/aiworks-core python manage.py runserver
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
   PYTHONPATH=/home/xmaster/aiworks-core python manage.py runserver

   # Frontend (in another terminal)
   cd frontend
   npm run dev
   ```

---

## Configuration

### Root `.env` (Docker Compose)

| Variable | Description |
|----------|-------------|
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_USER` | PostgreSQL user |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `DEBUG` | Django debug mode |
| `DJANGO_SECRET_KEY` | Django secret key |
| `JWT_SIGNING_KEY` | JWT signing key |
| `ALLOWED_HOSTS` | Django allowed hosts |
| `AIWORKS_CORE_APP_NAME` | Application name |
| `AIWORKS_CORE_SITE_URL` | Site URL for emails |

### Backend `.env`

Contains the same variables as the root `.env` for local development.

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
│   ├── tests/                # Unit and integration tests
│   ├── prompts.yaml          # Prompt templates
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
│   ├── src/                  # React source
│   ├── public/               # Static assets
│   ├── index.html
│   ├── vite.config.ts        # Vite configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── nginx.conf            # Production nginx config
│   ├── dev.sh                # Local development script
│   └── README.md
├── proxy/
│   ├── nginx.conf            # Reverse proxy config
│   └── Dockerfile
├── docker-compose.yml         # Docker services
├── .env.example              # Environment template (root)
└── README.md                 # This file
```

---

## Running Tests

### With Docker:

```bash
docker-compose exec backend pytest tests/ -v
```

### Locally:

```bash
cd backend
PYTHONPATH=/home/xmaster/aiworks-core pytest tests/ -v
```

### With Coverage:

```bash
cd backend
./coverage.sh --all
```

---

## API Endpoints

All API endpoints are available under `/api/`.

### Authentication (`/api/auth/`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register/` | Register new user |
| POST | `/login/` | Login and get JWT tokens |
| POST | `/refresh/` | Refresh access token |
| GET | `/me/` | Current user info |
| POST | `/verify/` | Verify email |
| POST | `/password/reset/` | Request password reset |
| POST | `/password/reset/confirm/` | Confirm password reset |

### Resources (`/api/`)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/knowledge-bases/` | List/create knowledge bases |
| GET/PUT/DELETE | `/knowledge-bases/<id>/` | KB detail operations |
| POST | `/knowledge-bases/<id>/upload_files/` | Upload files to KB |
| GET/POST | `/mcp-servers/` | List/create MCP servers |
| GET/PUT/DELETE | `/mcp-servers/<id>/` | MCP server detail |
| GET | `/memory/` | List memory entries |
| DELETE | `/memory/<id>/` | Delete memory entry |

---

## Integrating aiworks-core

See [AGENTS.md](https://github.com/your-org/aiworks-core/blob/main/AGENTS.md) in the aiworks-core repository for a complete integration checklist.
