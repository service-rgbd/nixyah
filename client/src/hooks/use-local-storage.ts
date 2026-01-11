import * as React from "react";

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = React.useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  const setAndStore = React.useCallback(
    (next: React.SetStateAction<T>) => {
      setValue((prev) => {
        const computed = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(computed));
        } catch {
          // ignore storage errors (private mode, quota, etc.)
        }
        return computed;
      });
    },
    [key],
  );

  return [value, setAndStore] as const;
}




