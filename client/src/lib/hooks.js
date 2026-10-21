import { useCallback, useEffect, useRef, useState } from 'react';

// Load data on mount / when deps change, with loading + error state and refetch.
export function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      if (error.name !== 'AbortError') setState({ data: null, loading: false, error });
      return null;
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: load, setData };
}

export function useDebounce(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Run an async action with a busy flag (for buttons/forms).
export function useAction(fn) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (...args) => {
    setBusy(true);
    try {
      return await fn(...args);
    } finally {
      setBusy(false);
    }
  }, [fn]);
  return [run, busy];
}
