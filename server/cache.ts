type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  tags: Set<string>;
};

const store = new Map<string, CacheEntry<any>>();
const tagIndex = new Map<string, Set<string>>();

function removeKeyFromTags(key: string, entry: CacheEntry<any>) {
  entry.tags.forEach((tag) => {
    const keys = tagIndex.get(tag);
    if (!keys) return;
    keys.delete(key);
    if (keys.size === 0) {
      tagIndex.delete(tag);
    }
  });
}

export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  tags: string[] = [],
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }

  const value = await loader();
  const entry: CacheEntry<T> = {
    value,
    expiresAt: now + Math.max(1, ttlMs),
    tags: new Set(tags),
  };

  if (existing) {
    removeKeyFromTags(key, existing);
  }

  store.set(key, entry);
  entry.tags.forEach((tag) => {
    const keys = tagIndex.get(tag) ?? new Set<string>();
    keys.add(key);
    tagIndex.set(tag, keys);
  });

  return value;
}

export function invalidate(pattern: RegExp | string) {
  const keys = Array.from(store.keys());
  for (const key of keys) {
    const matches =
      typeof pattern === "string" ? key.includes(pattern) : pattern.test(key);
    if (!matches) continue;
    const entry = store.get(key);
    if (!entry) continue;
    removeKeyFromTags(key, entry);
    store.delete(key);
  }
}

export function invalidateTag(tag: string) {
  const keys = tagIndex.get(tag);
  if (!keys) return;
  for (const key of Array.from(keys)) {
    const entry = store.get(key);
    if (entry) {
      removeKeyFromTags(key, entry);
    }
    store.delete(key);
  }
  tagIndex.delete(tag);
}
