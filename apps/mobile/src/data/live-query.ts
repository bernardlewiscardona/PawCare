import { useEffect, useRef, useState } from 'react';
import { ErrorCode } from '@pawcare/core';
import { DataError } from './errors';
import type { PawCareData } from './open';
import type { TableName } from './database';
import { useData } from './provider';

type Live<T> = { data: T | undefined; error: DataError | undefined; loading: boolean };

function toDataError(error: unknown): DataError {
  return error instanceof DataError
    ? error
    : new DataError(ErrorCode.INTERNAL_ERROR, 'Read failed');
}

/**
 * Reads from the phone database and re-reads whenever a committed write touches one of `tables`.
 * `deps` are the inputs of `read` (like useEffect's). Results from superseded runs are dropped.
 */
export function useLiveQuery<T>(
  tables: readonly TableName[],
  read: (data: PawCareData) => Promise<T>,
  deps: unknown[],
): Live<T> {
  const data = useData();
  const [state, setState] = useState<Live<T>>({
    data: undefined,
    error: undefined,
    loading: true,
  });
  const readRef = useRef(read);
  readRef.current = read;
  const tablesKey = tables.join(',');

  useEffect(() => {
    let active = true;
    let run = 0;
    const watched = tablesKey.split(',');

    const load = (): void => {
      const mine = ++run;
      readRef
        .current(data)
        .then(
          (value) => {
            if (active && mine === run) setState({ data: value, error: undefined, loading: false });
          },
          (error: unknown) => {
            if (active && mine === run) {
              setState((s) => ({ data: s.data, error: toDataError(error), loading: false }));
            }
          },
        )
        // Never let a failure here escape into the write that triggered it.
        .catch(() => undefined);
    };

    setState((s) => (s.loading ? s : { ...s, loading: true }));
    load();
    const unsubscribe = data.subscribe((changed) => {
      try {
        if (watched.some((t) => changed.has(t as TableName))) load();
      } catch (error) {
        if (active) setState((s) => ({ data: s.data, error: toDataError(error), loading: false }));
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
    // `deps` is the caller's list, like useEffect's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tablesKey, ...deps]);

  return state;
}
