This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Data layer (LOCAL-01)

PawCare's data lives on the phone, in an SQLCipher-encrypted SQLite database behind `src/data`. Screens import only from `@/data` (`src/data/index.ts`). Shared rules and error codes come from `@pawcare/core`; after editing core, run `pnpm --filter @pawcare/core build`.

- Repositories (`owner/`, `pets/`) go through `Database.write(tables, fn)` with the tables declared, and reads through `Database.read`. Everything runs on one serialised queue, so never call `read` or `write` inside another's callback.
- Every mutation calls `recordChange` (`change-log.ts`) in the same transaction, with field names only, never values or health text.
- Repositories are created with the phone's owner ID (from `ensureOwner`), and every query filters by `owner_id`, even though a phone holds one owner today.
- The selected pet (PF-03) is `pets.selected()` / `pets.select(id)`; watch `['pets', 'pet_selection']` with `useLiveQuery`. It is a device preference: no `version`, no `change_log` row, not uploaded. When the selected pet is archived or missing, `selected()` falls back to the oldest active pet, or `null`. Creating a pet selects it. Care forms still take an explicit `petId`, never "whatever is selected".
- `pets.update({ id, version, ...fields })` edits an active pet; `null` clears an optional field. A stale `version` gives `CONFLICT` with `details.current`.
- Migrations in `src/data/migrations/` are append-only, numbered, and tracked by `PRAGMA user_version`. Never edit a released migration; add a new one.
- SQL uses bound parameters only. Never build SQL by string concatenation with user input.
- Tests use `openTestData()` from `src/data/testing` (over `node:sqlite`), not a mocked database.
- Errors are `DataError` carrying the same codes as the API (`errors.ts`), with field-level details for validation.
- `openPawCareData` reports `ready`, `encryption-unavailable`, `too-new`, `key-missing` or `failed`; `DataGate` shows the matching screen. "Start fresh" retires the database files and copies the key, and never deletes.
- Encryption needs a development or release build. In Expo Go the database is unencrypted and the banner "Development data, not encrypted" shows (development only). Device verification on Android is still pending.
