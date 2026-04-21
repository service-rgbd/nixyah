import * as React from "react";

const LOCAL_STORAGE_SYNC_EVENT = "nixyah:local-storage-sync";

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

  React.useEffect(() => {
    const syncFromRaw = (raw: string | null) => {
      try {
        if (raw === null) {
          setValue(initialValue);
          return;
        }
        setValue(JSON.parse(raw) as T);
      } catch {
        setValue(initialValue);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      syncFromRaw(event.newValue);
    };

    const handleCustomSync = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; value?: string | null }>).detail;
      if (detail?.key !== key) return;
      syncFromRaw(detail.value ?? null);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleCustomSync as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleCustomSync as EventListener);
    };
  }, [initialValue, key]);

  const setAndStore = React.useCallback(
    (next: React.SetStateAction<T>) => {
      setValue((prev) => {
        const computed = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        let serialized: string | null = null;
        try {
          serialized = JSON.stringify(computed);
          window.localStorage.setItem(key, serialized);
        } catch {
          // ignore storage errors (private mode, quota, etc.)
        }
        try {
          window.dispatchEvent(
            new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, {
              detail: { key, value: serialized },
            }),
          );
        } catch {
          // ignore event dispatch errors
        }
        return computed;
      });
    },
    [key],
  );

  return [value, setAndStore] as const;
}




