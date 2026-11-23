# Project Foundation — repository and environment

Source: Notion "SETUP-01 — [TASK] Initialize PawCare Repository and Development Environment" (Agile/Scrum Board › Task Management, 4 Nov 2026). This is a development prerequisite and comes before every feature story.

### SETUP-01 — [TASK] Initialize PawCare repository and development environment

- **Issue Type:** Task (the Notion row says User Story)
- **Priority:** High
- **Summary:** Create the PawCare repository, set up the application structure, install the foundational dependencies, and configure local development and automated checks, so developers can start feature work in a consistent way.
- **Stack (confirmed 19 Nov 2026, see `docs/decisions.md`):** Expo SDK 58 with React Native 0.88, Expo Router and TypeScript for the mobile app; a NestJS 12 API (ESM only); PostgreSQL 16 with Prisma 7; pnpm 10 workspaces on Node.js 22. GitHub is the repository provider.
- **User Story:** As a PawCare developer, I want a configured repository with documented setup instructions and automated quality checks, so that I can develop and validate features in a consistent environment.
- **Acceptance Criteria:**
  - **Given** the team has confirmed the stack and repository provider, **when** the repository is initialized, **then** it contains a mobile application, an API application, the root workspace configuration, and a README.
  - **Given** a developer clones the repository and installs the documented prerequisites, **when** they run `pnpm install --frozen-lockfile`, **then** all workspace dependencies install without modifying the committed lockfile.
  - **Given** valid local environment files and a running PostgreSQL instance, **when** the developer starts the API, **then** it connects to the database and exposes a health endpoint that returns no secrets or connection details.
  - **Given** the API is running, **when** the mobile application starts on a supported Android or iOS development environment, **then** a PawCare placeholder screen loads and a development connectivity check can reach the API.
  - **Given** a required API environment variable is missing or invalid, **when** the API starts, **then** startup fails with an actionable error that does not reveal secret values.
  - **Given** the initial Prisma configuration, **when** the documented database validation and client-generation commands run, **then** they succeed against local PostgreSQL.
  - **Given** an empty PostgreSQL database, **when** the committed migrations are applied, **then** the full logical schema from `docs/design/erd-and-flows.md` is created, including decisions D-ERD-1, D-ERD-3 and D-ERD-4 and the fixes from `docs/design/erd-review.md`, and the database-constraint tests pass against it.
  - **Given** a pull request, **when** continuous integration runs, **then** dependency installation, linting, formatting checks, type checking, migrations, a check that `schema.prisma` matches the migrations, the API build, and baseline smoke and database-constraint tests all run; failures are visible and block merging.
  - **Given** a fresh clone, **when** another developer follows only the README, **then** they can start the database, the API, and the mobile application with no undocumented setup steps.
- **Technical / Design Notes or Dependencies:**
  - Repository structure:
    ```
    pawcare/
    ├── apps/
    │   ├── mobile/
    │   └── api/
    ├── docs/
    ├── .github/workflows/      (assumes GitHub; use the equivalent for another provider)
    ├── .env.example
    ├── .gitignore
    ├── compose.yaml
    ├── package.json
    ├── pnpm-workspace.yaml
    ├── pnpm-lock.yaml
    └── README.md
    ```
  - Foundational dependencies:

    | Area | Dependencies | Purpose |
    | --- | --- | --- |
    | Mobile runtime | `expo`, `react`, `react-native`, `typescript` | Mobile application foundation |
    | Navigation | `expo-router`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants`, `expo-status-bar` | Navigation and supporting Expo integration |
    | API runtime | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs` | NestJS application foundation |
    | API configuration | `@nestjs/config` | Environment configuration |
    | Request validation | `class-validator`, `class-transformer` | DTO validation and transformation |
    | Database runtime | `@prisma/client`, `@prisma/adapter-pg`, `pg` | Prisma access to PostgreSQL |
    | Development tooling | `prisma`, `@nestjs/cli`, `@nestjs/testing`, `@types/node`, `@types/pg`, oxlint (API), ESLint via `expo lint` (mobile), Prettier | Generation, checks, and development |
    | Tests | Vitest and Supertest (API smoke and database-constraint tests against PostgreSQL); Vitest for mobile logic | Verify startup, the health endpoint and the schema rules |

  - Install Expo packages with Expo's dependency resolver (`npx expo install`), following the chosen SDK's compatibility guidance.
  - Pin compatible Node.js and pnpm versions, and commit one root lockfile.
  - Provide an `.env.example` for each application, with placeholders and documented ownership.
  - Database credentials live only in the API environment. Mobile configuration holds only public values, such as the API base URL.
  - Run local PostgreSQL with Docker Compose, using persistent storage and a health check.
  - Document the database initialization, reset, client generation, and migration commands. Clearly label the destructive local reset commands.
  - Configure pull-request review and branch protection where the repository provider supports them.
  - Document how emulators and physical devices reach the API. A physical phone can't reach the developer's computer through its own `localhost`.
  - Leave notification, attachment, authentication-provider, and other feature-specific packages to their own tickets.
  - Baseline database schema (decided 23 Nov 2026): SETUP-01 delivers the whole ERD as one migration, not table by table with the feature tickets. Feature tickets build API and UI behaviour on it and add migrations only for schema changes. Rules Prisma can't express (CHECKs, triggers, `uuidv7()`) are hand-written in the migration SQL and covered by `apps/api/test/schema-*.e2e-spec.ts`. Lifecycle rules that depend on other rows' state (for example attachment limits and Completed-only appointment links) stay in the API.
  - Out of scope: clinic staff applications, clinic scheduling integrations, and production deployment.
- **Edge Cases & Failure Points:**
  - Incompatible dependency versions: settle Expo SDK, Prisma, Node.js, NestJS, and module-system (ESM/CJS) compatibility before committing the baseline.
  - Database unavailable: fail clearly or report an unhealthy readiness check. Never report the database as ready when connectivity has failed.
  - Port conflicts: document the default ports and how to override them.
  - Device can't reach the API: document local network addresses, firewall requirements, and emulator host addresses (Android emulator uses `10.0.2.2`).
  - Secrets committed by accident: ignore local env files, commit placeholders only, and turn on secret scanning where available.
  - Different operating systems: use cross-platform package scripts, document the WSL2/Docker setup, and note that local iOS simulator development needs macOS.
  - Duplicate package installations: keep each dependency in the workspace that uses it, and never have more than one package-manager lockfile.
- **Decisions:** the technology stack and repository provider are confirmed (19 Nov 2026), and the API uses Vitest and oxlint instead of Jest and ESLint (see `docs/decisions.md`). Still open: the supported mobile platforms and development targets, and who can approve pull requests and merge changes.
- **Definition of Done:** the team can access the repository, a fresh-clone setup that follows the documentation succeeds, and all baseline CI checks pass.

> The shared requirements in `00-overview.md` apply only partly here. Requirement 6 (no secrets in logs) applies fully; the health endpoint and the env-validation errors must not leak config.
