# AgentRadar

AI agent discovery and governance platform — find every AI agent, model, and integration running across your org (including unsanctioned "shadow" agents), assess their risk, and govern access to them from one dashboard.

## Description

AgentRadar helps security and platform teams answer the question "what AI is actually running in our environment?" It continuously scans connected systems — Azure (Copilot, Teams, and Agent 365), AWS, GCP, and source-control platforms (GitHub/GitLab) — classifies what it finds using AI-relevance and adversarial-detection heuristics, and surfaces:

- **Discovered Agents & Models** — every AI agent/model detected, verified or not.
- **Shadow Agents** — agents running without sanctioned oversight.
- **Agent Lineage & Findings** — where an agent came from and what was found about it.
- **Integrations** — connected source systems that feed discovery, plus downstream SIEM, endpoint, identity, ITSM, and communication connectors for correlation and alerting.
- **Approval workflows** — model and agent approval flows for governance.
- **Audit Logs** — a full trail of administrative and access activity.
- **SSO & RBAC** — Microsoft/OIDC single sign-on and role-based access control across five roles (`super_admin`, `admin`, `ciso`, `security_analyst`, `auditor`).

### Features

- Automated and on-demand discovery scanning across Azure, AWS, GCP, and GitHub/GitLab with a pluggable scanner architecture (`server/src/modules/discovery/scanners`)
- Adversarial detection to flag agents attempting to evade discovery
- Role-based dashboards and permissions across five roles (super admin, admin, CISO, security analyst, auditor) — only super admin can log in directly, all other roles authenticate via SSO
- SSO via Microsoft Entra ID and generic OIDC providers
- Full audit logging of sensitive actions
- Model and agent approval workflows

### Background

Built for CitiusTech engagements where clients need visibility into AI usage across their Microsoft 365 / Azure estate before it can be governed for compliance (HIPAA/HITECH/SOC 2, etc.).

## Tech Stack

| Layer | Stack |
|---|---|
| Backend | Node.js, TypeScript, Express, PostgreSQL (`pg`, `node-pg-migrate`), Zod, Pino |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router, Recharts/Chart.js |
| Auth | JWT (access/refresh), Microsoft Entra ID, OpenID Connect |
| Infra | Docker Compose, Nginx (static frontend + reverse proxy) |



## Installation

### Requirements

- Node.js **>= 20**
- npm
- PostgreSQL (via Docker Compose, or a standalone instance)
- Docker & Docker Compose (for the containerized backend + database)
- A Linux server with 2 vCPU / 4 GB RAM minimum for production deployment

### Setup

Clone the repository:

```bash
git clone https://gitrepository.citiustech.com/44757/agentradar.git
cd agentradar
```

**Backend (`server/`):**

```bash
cd server
npm install
```

Create a `.env` file in `server/` with at least the following (a full annotated example is available at [server/.env.example](server/.env.example)):

```env
NODE_ENV=development
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
# Required — encrypts connector/integration secrets at rest. Generate with: openssl rand -hex 32
DISCOVERY_ENCRYPTION_KEY=
# Optional — defaults to a local Postgres instance; Docker Compose sets this automatically
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agentradar
# Optional — only needed for Microsoft SSO
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback
# Set to false only if not serving over HTTPS
SECURE_COOKIES=true
```

> Custom OIDC SSO (for non-super-admin roles) is configured per-deployment through the admin UI (`/api/auth/sso/settings`), not via environment variables.

Run database migrations and seed an admin user:

```bash
npm run migrate:up
npm run seed:admin
```

**Frontend (`dashboard/`):**

```bash
cd dashboard
npm install
```

**Full stack via Docker Compose** (backend + Postgres):

```bash
docker-compose up -d --build
```

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for full production deployment instructions, including Nginx configuration for both domain-based (SSL) and IP-based setups.

## Usage

**Run the backend in dev mode:**

```bash
cd server
npm run dev
```

The API starts on `http://localhost:3000` by default.

**Run the dashboard in dev mode:**

```bash
cd dashboard
npm run dev
```

Vite serves the dashboard (default `http://localhost:5173`), proxying API calls to the backend.

**Build for production:**

```bash
cd server && npm run build && npm start
cd dashboard && npm run build   # outputs to dashboard/dist, served via Nginx
```

## Support

For issues or questions, use the repository's issue tracker, or reach out to the maintainers listed under [Authors and acknowledgment](#authors-and-acknowledgment).

## Roadmap

- Additional cloud-provider scanners beyond Azure (AWS, GCP)
- Expanded RBAC roles beyond super admin / analyst
- Automated remediation actions for flagged shadow agents
- Richer agent lineage visualization
- Automated remediation actions for flagged shadow agents
- Richer agent lineage visualization
- Deeper scanning support for the broader integrations catalog (SIEM, endpoint, identity, healthcare, network, and communication connectors currently used for correlation/alerting only)

## Contributing

Contributions are welcome via pull request.

**Before submitting a change:**

1. Backend — from `server/`:
   ```bash
   npm run lint
   npm run test
   ```
2. Frontend — from `dashboard/`:
   ```bash
   npm run lint
   npm run build
   ```
3. If your change touches the database schema, add a new numbered migration under `server/migrations/` rather than editing an existing one.
4. Keep PRs scoped to a single concern and describe the "why" in the PR description.

## Authors and acknowledgment

Maintained by the AgentRadar contributors at CitiusTech.

## Project status

Actively developed.
