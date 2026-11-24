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
export type DataState = (Opening | OpenResult) & {
  /** Swap in the outcome of Start fresh or Try again. Ignored while one is already in flight. */
  replace(next: Promise<OpenResult>): void;
};

const DataContext = createContext<DataState | null>(null);

/** What the gate can still offer if opening rejects instead of resolving to a state. */
function unexpectedFailure(env: OpenEnv): OpenResult {
  const retry = () => openPawCareData(env);
  return { state: 'failed', retry, startFresh: retry };
}

/**
 * Opens the phone database once per mount and shares the outcome. Closes it again on unmount.
 * Screens use `useData()`; only the gate reads the other states.
 */
export function DataProvider({ env, children }: { env?: OpenEnv; children: ReactNode }) {
  const [result, setResult] = useState<Opening | OpenResult>({ state: 'opening' });
  const mounted = useRef(false);
  const started = useRef(false);
  const inFlight = useRef(false);
  const current = useRef<Opening | OpenResult>(result);
  const envRef = useRef<OpenEnv | undefined>(env);

  const settle = useRef((next: OpenResult) => {
    inFlight.current = false;
    if (!mounted.current) {
      // Unmounted while opening: don't leave a connection behind.
      if (next.state === 'ready') void next.data.close().catch(() => undefined);
      return;
    }
    current.current = next;
    setResult(next);
  });

  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      // StrictMode runs this effect twice; open only once.
      started.current = true;
      inFlight.current = true;
      envRef.current ??= expoOpenEnv();
      const openEnv = envRef.current;
      openPawCareData(openEnv).then(settle.current, () =>
        settle.current(unexpectedFailure(openEnv)),
      );
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
      replace(next) {
        if (inFlight.current) return;
        inFlight.current = true;
        current.current = { state: 'opening' };
        setResult({ state: 'opening' });
        const openEnv = envRef.current;
        next.then(settle.current, () => {
          if (openEnv) settle.current(unexpectedFailure(openEnv));
        });
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
