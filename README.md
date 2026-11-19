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
| Node.js | 22.18+ or 24.11+ (`.nvmrc` = 22) | `nvm use` picks the right one |
| pnpm | 10.28.x | `corepack enable` and the version in `package.json` is used automatically |
| Docker | with Compose v2 | Runs the local PostgreSQL. On Windows, use Docker Desktop with WSL2. |
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

Data persists in the `pawcare_pgdata` Docker volume between restarts. `pnpm db:down` stops the container and keeps the data.

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
| Expo dev server | 8081 | `pnpm dev:mobile --port 8082` |

## 8. Troubleshooting

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
compose.yaml            local PostgreSQL
```

Typical loop with Claude Code: `/backlog` → `/story PF-02` → `/implement-story PF-02` → `/spec-check PF-02`.
