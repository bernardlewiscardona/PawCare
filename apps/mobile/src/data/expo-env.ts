// The real OpenEnv: Expo modules only. Not unit-tested; `open.test.ts` covers the logic with a fake.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { expoConnection } from './expo-connection';
import type { OpenEnv } from './open';

// Device-only: never migrated to another device by a backup restore.
const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** A file in expo-sqlite's database directory, which is a plain path; File wants a file:// URI. */
function databaseFile(name: string): File {
  const dir: unknown = SQLite.defaultDatabaseDirectory;
  if (typeof dir !== 'string') throw new Error('No database directory');
  return new File(dir.startsWith('file://') ? dir : `file://${encodeURI(dir)}`, name);
}

export function expoOpenEnv(): OpenEnv {
  return {
    isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    isDev: __DEV__,
    keys: {
      get: (name) => SecureStore.getItemAsync(name, KEY_OPTIONS),
      set: (name, value) => SecureStore.setItemAsync(name, value, KEY_OPTIONS),
    },
    files: {
      exists: async (name) => databaseFile(name).exists,
      // File.rename moves within the directory and throws if the target exists; never overwrites.
      rename: async (from, to) => {
        databaseFile(from).rename(to);
      },
    },
    // A new connection each time, so PRAGMA key always lands on a connection opened here.
    connect: async (name) =>
      expoConnection(await SQLite.openDatabaseAsync(name, { useNewConnection: true })),
    // getRandomValues always uses the native CSPRNG; getRandomBytes can fall back to Math.random
    // in development when it thinks a remote debugger is attached.
    randomBytes: (n) => Crypto.getRandomValues(new Uint8Array(n)),
    now: () => new Date(),
  };
}
