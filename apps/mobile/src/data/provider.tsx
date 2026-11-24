import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { expoOpenEnv } from './expo-env';
import { openPawCareData, type OpenEnv, type OpenResult, type PawCareData } from './open';

type Opening = { state: 'opening' };
/**
 * Opening rejected instead of resolving to a state, so open.ts's Start fresh isn't at hand. Only
 * Try again is offered: a "Start fresh" that only retried would falsely say the data was set aside.
 */
type Unexpected = { state: 'failed'; retry(): Promise<OpenResult>; startFresh?: undefined };
type Shown = Opening | OpenResult | Unexpected;

export type DataState = Shown & {
  /**
   * Runs `start` (Start fresh or Try again) and swaps in its outcome. While one is in flight the
   * call is ignored and `start` is never called.
   */
  replace(start: () => Promise<OpenResult>): void;
};

const DataContext = createContext<DataState | null>(null);

/** What the gate can still offer if opening rejects instead of resolving to a state. */
function unexpectedFailure(env: OpenEnv): Unexpected {
  return { state: 'failed', retry: () => openPawCareData(env) };
}

/**
 * Opens the phone database once per mount and shares the outcome. Closes it again on unmount.
 * Screens use `useData()`; only the gate reads the other states.
 */
export function DataProvider({ env, children }: { env?: OpenEnv; children: ReactNode }) {
  const [result, setResult] = useState<Shown>({ state: 'opening' });
  const mounted = useRef(false);
  const started = useRef(false);
  const inFlight = useRef(false);
  /** The last settled outcome: what to close on unmount or when it is replaced. */
  const current = useRef<Shown>(result);
  const envRef = useRef<OpenEnv | undefined>(env);

  const settle = useRef((next: Shown) => {
    inFlight.current = false;
    if (!mounted.current) {
      // Unmounted while opening: don't leave a connection behind. (Unmount closed the previous.)
      if (next.state === 'ready') void next.data.close().catch(() => undefined);
      return;
    }
    const previous = current.current;
    current.current = next;
    // The gate only offers Start fresh and Try again when not ready, so this shouldn't happen;
    // if it ever does, the replaced database must not stay open.
    if (previous.state === 'ready' && (next.state !== 'ready' || next.data !== previous.data)) {
      void previous.data.close().catch(() => undefined);
    }
    setResult(next);
  });

  const run = useRef((start: (env: OpenEnv) => Promise<OpenResult>) => {
    inFlight.current = true;
    const openEnv = (envRef.current ??= expoOpenEnv());
    // `new Promise` also turns a synchronous throw from `start` into a rejection.
    new Promise<OpenResult>((resolve) => resolve(start(openEnv))).then(settle.current, () =>
      settle.current(unexpectedFailure(openEnv)),
    );
  });

  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      // StrictMode runs this effect twice; open only once.
      started.current = true;
      run.current(openPawCareData);
    }
    return () => {
      mounted.current = false;
      const last = current.current;
      if (last.state === 'ready') void last.data.close().catch(() => undefined);
    };
  }, []);

  const value = useMemo<DataState>(
    () => ({
      ...result,
      replace(start) {
        // Checked before `start` runs, so a refused call never touches the files or keys.
        if (inFlight.current) return;
        setResult({ state: 'opening' });
        run.current(() => start());
      },
    }),
    [result],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataState(): DataState {
  const value = useContext(DataContext);
  if (!value) throw new Error('useDataState needs a DataProvider');
  return value;
}

/** The open database. Throws unless the gate has let the app through (state `ready`). */
export function useData(): PawCareData {
  const value = useDataState();
  if (value.state !== 'ready') throw new Error('The database is not ready');
  return value.data;
}
