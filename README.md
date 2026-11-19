# PawCare

A mobile pet diary for owners: pet profiles, owner-entered health history, vaccines and prescriptions, an appointment diary, reminders, and household supplies.

| App | Path | Stack |
| --- | --- | --- |
| Mobile | `apps/mobile` | Expo SDK 58, React Native, TypeScript, Expo Router |
| API | `apps/api` | NestJS 12 (ESM), TypeScript, Prisma 7 + PostgreSQL 16 |

This repo is set up for Claude Code: start with `CLAUDE.md`.

---

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22.18+ or 24.11+ (`.nvmrc` = 22) | `nvm use` picks the right one. Other versions are refused (`engine-strict`). Not needed for the API if you run it in Docker (section 4). |
| pnpm | 10.28.x | `corepack enable` and the version in `package.json` is used automatically |
| Docker | with Compose v2 | Runs the local PostgreSQL, and optionally the API. On Windows, use Docker Desktop with WSL2. |
| Expo Go app or simulator | — | Android: Android Studio emulator. iOS: Xcode simulator (**macOS only**) or Expo Go on an iPhone. |

## 2. First-time setup

```bash
git clone <repo-url> pawcare && cd pawcare
corepack enable
pnpm install --frozen-lockfile        # also generates the Prisma client

cp .env.example .env                  # only POSTGRES_PORT, used by Docker Compose
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env   # optional, see section 5
```

## 3. Start the database

```bash
pnpm db:up            # starts PostgreSQL 16 in Docker and waits until it is healthy
```

Data persists in a Docker volume (`pawcare_pawcare_pgdata`) between restarts. `pnpm db:down` stops the containers and keeps the data.

## 4. Start the API

```bash
pnpm dev:api
```

Check it:

| URL | Meaning |
| --- | --- |
| http://localhost:3000/health | Liveness: the process is up (`{"status":"ok"}`) |
| http://localhost:3000/health/ready | Readiness: returns 200 when the database is reachable, 503 when it isn't |
| http://localhost:3000/docs | OpenAPI docs (not served in production) |

If a required environment variable is missing or invalid, the API refuses to start and lists which variable is wrong. It never prints the value.

### Or run the API in Docker

Instead of `pnpm db:up` and `pnpm dev:api`, you can run PostgreSQL **and** the API in containers. The API container uses Node 22 and the pnpm version pinned in `package.json`, so it works whatever Node.js your machine has.

```bash
docker compose up -d --build --wait    # the first run builds the image, which takes a few minutes
docker compose logs -f api             # follow the dev server
```

The URLs above work the same way. The repository is bind-mounted, so when you save a file under `apps/api/src` the server recompiles and restarts within a couple of seconds. On every start the container syncs dependencies, regenerates the Prisma client, and applies committed migrations.

Run API commands inside the container:

| Command | What it does |
| --- | --- |
| `docker compose exec api pnpm test` | Unit tests |
| `docker compose exec api pnpm test:e2e` | API smoke tests against the `db` container |
| `docker compose exec api pnpm lint` (or `typecheck`, `build`) | Lint, typecheck or build the API |
| `docker compose exec api pnpm db:migrate --name <change>` | Create and apply a migration (written to `apps/api/prisma/migrations` on your machine) |
| `docker compose exec api pnpm prisma:generate` | Regenerate the Prisma client after editing `schema.prisma` |
| `docker compose exec -w /workspace api pnpm format:check` | Prettier check for the whole repo |
| `docker compose stop api` | Stop the API container and keep the database running |
| `docker compose down` | Stop everything (data is kept) |

- The container takes `DATABASE_URL` from `compose.yaml` (host `db`), not from `apps/api/.env`.
- Don't run `pnpm dev:api` at the same time, because both use port 3000. To publish the container on another port, set `API_PORT` in `.env`.
- After `pnpm-lock.yaml` changes, run `docker compose up -d --build --wait` again.
- The container has no mobile dependencies. The mobile app runs on your machine (section 5) and needs Node 22 or 24.
- In Git Bash on Windows, paths such as `/workspace` get rewritten. Prefix the command with `MSYS_NO_PATHCONV=1` or use PowerShell.

## 5. Start the mobile app

```bash
pnpm dev:mobile       # Expo dev server; press a (Android), i (iOS) or scan the QR code with Expo Go
```

The home screen shows a **development connectivity check** that calls the API's `/health/ready`.

How the app finds the API:

| Where the app runs | API URL | What to do |
| --- | --- | --- |
| Physical phone (Expo Go) | `http://<your computer's LAN IP>:3000` | Nothing: in development the app uses the address of the machine running `expo start`. Phone and computer must be on the same Wi-Fi, and your firewall must allow incoming connections on port 3000. |
| Android emulator | `http://10.0.2.2:3000` | Usually automatic. If not, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` in `apps/mobile/.env`. |
| iOS simulator | `http://localhost:3000` | Usually automatic. If not, set `EXPO_PUBLIC_API_URL=http://localhost:3000`. |

A phone's own `localhost` is the phone itself, never your computer. `EXPO_PUBLIC_*` values are bundled into the app, so never put secrets in `apps/mobile/.env`. After changing `.env`, restart Expo with `pnpm dev:mobile --clear`.

## 6. Everyday commands (from the repo root)

| Command | What it does |
| --- | --- |
| `pnpm lint` | oxlint (API) and ESLint via `expo lint` (mobile) |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm typecheck` | TypeScript in both apps |
| `pnpm build` | Build the API to `apps/api/dist` |
| `pnpm test` | Unit tests (Vitest) in both apps |
| `pnpm test:e2e` | API smoke tests against the database in `apps/api/.env` (start it first) |
| `pnpm prisma:validate` | Validate `apps/api/prisma/schema.prisma` |
| `pnpm prisma:generate` | Regenerate the Prisma client (also runs on install) |
| `pnpm --filter api db:migrate --name <change>` | Create and apply a migration in development |
| `pnpm --filter api db:migrate:deploy` | Apply committed migrations (CI and deployments) |
| ⚠️ `pnpm db:reset:DESTRUCTIVE` | **Drops all local data**, then re-applies the migrations. Local development only. |
| ⚠️ `docker compose down -v` | **Deletes the local database volume.** |

Business tables are added by their feature tickets (see `docs/design/erd-and-flows.md`), so the schema starts out empty. The constraints Prisma can't express — CHECKs, partial unique indexes and composite same-owner foreign keys — are hand-written into each migration's SQL.

## 7. Ports and overrides

| Service | Default | Override |
| --- | --- | --- |
| PostgreSQL | 5432 | `POSTGRES_PORT` in `.env`, **and** update the port in `DATABASE_URL` in `apps/api/.env` |
| API | 3000 | `PORT` in `apps/api/.env`; on phones, also set `EXPO_PUBLIC_API_URL` |
| API in Docker | 3000 | `API_PORT` in `.env`; on phones, also set `EXPO_PUBLIC_API_URL` |
| Expo dev server | 8081 | `pnpm dev:mobile --port 8082` |

## 8. Troubleshooting

- **`ERR_PNPM_UNSUPPORTED_ENGINE`:** your Node.js isn't 22.18+ or 24.11+, so pnpm refuses to run. Switch versions (`nvm use`, `fnm use`), or run the API in Docker (section 4).
- **`/health/ready` returns 503:** the database isn't reachable. Run `pnpm db:up`, then `docker compose ps`, and check `DATABASE_URL`.
- **The phone says "Cannot reach the API":** check that both devices are on the same Wi-Fi, allow port 3000 through your firewall (macOS: System Settings → Network → Firewall; Windows: allow Node.js on private networks), or set `EXPO_PUBLIC_API_URL` to your computer's LAN IP.
- **Port already in use:** see section 7.
- **`pnpm install --frozen-lockfile` fails:** someone changed a `package.json` without committing `pnpm-lock.yaml`. Run `pnpm install` and commit the lockfile in its own change.
- **Expo package version warnings:** add Expo packages with `pnpm --filter mobile exec expo install <pkg>`, never with `pnpm add`, so versions match the SDK.

## 9. Repository layout

```
apps/
  api/                  NestJS API (src/config, src/common, src/prisma, src/health, prisma/)
  mobile/               Expo app (src/app = routes, src/lib, src/components)
docs/
  spec/                 product spec: overview + one file per epic
  design/               ERD, flowcharts, design review
  backlog.csv           tickets, status, dependencies
  decisions.md          open decisions and release gates
  github-setup.md       branch protection, secret scanning
.claude/                Claude Code commands and the spec-reviewer agent
.github/                CI, PR template, Dependabot, CODEOWNERS
compose.yaml            local PostgreSQL and the API dev container (apps/api/Dockerfile)
```

Typical loop with Claude Code: `/backlog` → `/story PF-02` → `/implement-story PF-02` → `/spec-check PF-02`.
