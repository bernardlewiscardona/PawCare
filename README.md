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

### Who is the owner? (sign-in is postponed)

Sign-in isn't built yet; Google sign-in comes later (AUTH-01). Until then, set `AUTH_MODE=dev` in `apps/api/.env` and name the owner in an `X-Dev-Owner` header (1–64 letters, digits, `_` or `-`). The first request with a new name creates that owner. Without `AUTH_MODE=dev` (the default is `none`), every `/v1` route returns 401. The API refuses to start with `AUTH_MODE=dev` in production. The Docker `api` service already sets it.

```bash
curl -H 'X-Dev-Owner: bea' http://localhost:3000/v1/me
```

`GET /v1/me` includes `profileSetupRequired`: `true` until the owner's first profile save. Save the profile with the `version` you last read (the first save needs `displayName` and `timeZone`):

```bash
curl -X PATCH -H 'X-Dev-Owner: bea' -H 'Content-Type: application/json' \
  -d '{"version":1,"displayName":"Bea","timeZone":"Asia/Manila"}' http://localhost:3000/v1/me
```

A stale `version` returns `409 CONFLICT` with the latest profile in `details.current`.

In http://localhost:3000/docs, click **Authorize** and enter a name under `dev-owner`. The mobile app sends `EXPO_PUBLIC_DEV_OWNER` from `apps/mobile/.env`. Use two names to check that one owner can't see the other's data.

Pets (`POST` needs an `Idempotency-Key`; retrying with the same key returns the same pet instead of a duplicate). Save the profile first: until then `POST` returns 409 `PROFILE_SETUP_REQUIRED`:

```bash
curl -X POST -H 'X-Dev-Owner: bea' -H "Idempotency-Key: $(uuidgen)" -H 'Content-Type: application/json' \
  -d '{"name":"Mochi","species":"CAT","weight":{"value":4.2,"unit":"KG"}}' http://localhost:3000/v1/pets
curl -H 'X-Dev-Owner: bea' 'http://localhost:3000/v1/pets?limit=20'
```

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

You don't need the database or the API to try the screens (see the demo data note below), so after first-time setup (section 2) you can skip sections 3 and 4.

### Run on the Android emulator (Android Studio)

One-time setup:

1. Install [Android Studio](https://developer.android.com/studio) and open it once. The standard setup wizard installs the Android SDK, Platform-Tools and the Emulator.
2. Set `ANDROID_HOME` to the SDK folder and add its `platform-tools` to your `PATH`, so `adb` works in a terminal:

   | OS | `ANDROID_HOME` |
   | --- | --- |
   | Windows | `%LOCALAPPDATA%\Android\Sdk` (System Properties → Environment Variables; then add `%ANDROID_HOME%\platform-tools` to `Path`) |
   | macOS | `$HOME/Library/Android/sdk` (in `~/.zshrc`: `export ANDROID_HOME=$HOME/Library/Android/sdk` and `export PATH=$PATH:$ANDROID_HOME/platform-tools`) |

   Open a new terminal and check that `adb version` works.
3. Create a virtual device. Open Device Manager (welcome screen: **More Actions → Virtual Device Manager**; inside a project: **View → Tool Windows → Device Manager**), then **+ → Create Virtual Device**. Pick a phone such as **Pixel 8** and the system image **API 35** (x86_64 on Windows or Intel Macs, arm64 on Apple Silicon), then **Finish**.

Every time:

1. Start the emulator with ▶ in Device Manager and wait for the Android home screen. `adb devices` should list `emulator-5554  device`.
2. From the repo root, run `pnpm dev:mobile` and press **a**. The first time, Expo installs **Expo Go** on the emulator, then opens PawCare in it. The first bundle takes about a minute.
3. Edit code and the app reloads by itself. Press **r** in the terminal to reload manually, or **m** for the dev menu.

To try a test APK instead of the dev server, drag the `.apk` onto the emulator window, or run `adb install -r PawCare-1.0.0.apk`. To build one, see "Build a test APK (Android)" below.

The app opens on the Welcome screen. Every screen from the Figma design is built, but they all run on **in-memory demo data** (Bea and her pets Mochi, Kape and archived Bantay, with the clock fixed at 10 Nov 2026). Nothing calls the API yet, and changes are lost on reload. Feature tickets replace the demo data with API calls.

The **development connectivity check**, which calls the API's `/health/ready`, is on the Developer tools screen: long-press the logo on Welcome (development builds only).

How the app finds the API:

| Where the app runs | API URL | What to do |
| --- | --- | --- |
| Physical phone (Expo Go) | `http://<your computer's LAN IP>:3000` | Nothing: in development the app uses the address of the machine running `expo start`. Phone and computer must be on the same Wi-Fi, and your firewall must allow incoming connections on port 3000. |
| Android emulator | `http://10.0.2.2:3000` | Usually automatic. If not, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` in `apps/mobile/.env`. |
| iOS simulator | `http://localhost:3000` | Usually automatic. If not, set `EXPO_PUBLIC_API_URL=http://localhost:3000`. |

A phone's own `localhost` is the phone itself, never your computer. `EXPO_PUBLIC_*` values are bundled into the app, so never put secrets in `apps/mobile/.env`. After changing `.env`, restart Expo with `pnpm dev:mobile --clear`.

### Build a test APK (Android)

The APK runs without Expo Go or a dev server. It is signed with the debug key, so it is for sideloading and testing only, not for the Play Store. You need Android Studio (its bundled JDK and the Android SDK). Set `JAVA_HOME` to Android Studio's `jbr` folder and `ANDROID_HOME` to the SDK.

On macOS or Linux, build in place:

```bash
cd apps/mobile
CI=1 npx expo prebuild --platform android --no-install   # generates android/ (git-ignored)
cd android && ./gradlew assembleRelease
```

On Windows, the native build fails in place with `build.ninja still dirty` or `Filename longer than 260 characters`: the ninja bundled with the Android SDK can't handle the long paths that pnpm and CMake create. Build from a short-path copy with a flat `node_modules` instead (Git Bash, from the repo root):

```bash
mkdir -p dist/b    # dist/ is git-ignored
tar --exclude=node_modules --exclude=.git --exclude=apps/mobile/android --exclude=.expo --exclude=./dist -cf - . | tar -xf - -C dist/b
cd dist/b
pnpm install --frozen-lockfile --config.node-linker=hoisted --ignore-scripts --filter mobile...
cd apps/mobile && CI=1 npx expo prebuild --platform android --no-install
```

Then, in `dist/b/apps/mobile/android/app/build.gradle`, add this inside `android { defaultConfig { … } }` so CMake shortens over-long object paths:

```groovy
externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=255" } }
```

```bash
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
```

The first build takes about 40 minutes. Later builds take about 6 minutes after you copy changed files from `apps/mobile/src` into `dist/b/apps/mobile/src`. The APK is written to `android/app/build/outputs/apk/release/app-release.apk`. Restart `pnpm dev:mobile` after a build, because its file watcher can stall while the build copy changes. Delete `dist/b` (about 6 GB) when you no longer need it.

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

The schema implements the whole logical design in `docs/design/erd-and-flows.md`, with the fixes from `docs/design/erd-review.md`. IDs are UUIDv7, generated in the database. Every owner resource carries `owner_id`, and foreign keys between owner resources are composites that include it, so a row can't point at another owner's data. Nothing cascades.

The rules Prisma can't express are hand-written into the migration SQL, in sections marked "Hand-written": CHECK constraints (including text lengths), the `uuidv7()` function, the deferred trigger that requires each care record's subtype row, the append-only stock ledger and audit log, and the check that a batch balance equals its ledger. Partial unique indexes are declared in `schema.prisma` (preview feature `partialIndexes`). The specs in `apps/api/test/schema-*.e2e-spec.ts` test these rules against PostgreSQL. When you change the schema, keep the hand-written sections, and add the new rules to the new migration's SQL.

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
- **`No Android connected device found` after pressing a:** start the emulator first and wait for its home screen. Then check that `adb devices` lists it; if `adb` isn't found, `ANDROID_HOME`/`PATH` isn't set (section 5). Press **a** again.
- **The emulator won't start or is very slow:** turn on CPU virtualization (VT-x/AMD-V) in the BIOS. On Windows, also turn on **Windows Hypervisor Platform** under "Turn Windows features on or off", then restart.
- **The app stays on a white "PawCare" screen in Expo Go:** the first bundle is still building, so watch the terminal for `Android Bundled`. If it never finishes, stop the server and run `pnpm dev:mobile --clear`.

## 9. Repository layout

```
apps/
  api/                  NestJS API (src/config, src/common, src/prisma, src/health, prisma/)
  mobile/               Expo app: src/app = routes, src/components/ui = UI kit from the Figma design system,
                        src/components = feature components, src/theme = design tokens,
                        src/lib = demo store and derived state, assets/ = SVG icons, illustrations, avatars
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
