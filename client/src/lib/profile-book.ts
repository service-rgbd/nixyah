const PROFILE_BOOK_STORAGE_KEY = "nixyah.profile-book.v1";

type ProfileBookContext = {
  ids: string[];
  source?: string;
  updatedAt: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function rememberProfileBook(ids: string[], source?: string) {
  if (!canUseStorage()) return;
  const normalized = Array.from(new Set(ids.filter(Boolean)));
  if (!normalized.length) return;
  const payload: ProfileBookContext = {
    ids: normalized,
    source,
    updatedAt: Date.now(),
  };
  try {
    window.sessionStorage.setItem(PROFILE_BOOK_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore private mode/quota issues
  }
}

export function readProfileBook(): ProfileBookContext | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_BOOK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProfileBookContext>;
    if (!Array.isArray(parsed.ids)) return null;
    const ids = parsed.ids.filter((value): value is string => typeof value === "string" && value.length > 0);
    if (!ids.length) return null;
    return {
      ids,
      source: typeof parsed.source === "string" ? parsed.source : undefined,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function getProfileBookNeighbors(currentId: string) {
  const book = readProfileBook();
  if (!book) return null;
  const currentIndex = book.ids.indexOf(currentId);
  if (currentIndex === -1) return null;
  return {
    ...book,
    currentIndex,
    total: book.ids.length,
    previousId: currentIndex > 0 ? book.ids[currentIndex - 1] : null,
    nextId: currentIndex < book.ids.length - 1 ? book.ids[currentIndex + 1] : null,
  };
}
