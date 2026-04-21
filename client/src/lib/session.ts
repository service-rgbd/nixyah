import { resetCsrfTokenCache, setCsrfToken } from "@/lib/queryClient";

const PROFILE_ID_KEY = "djantrah.profileId";
const USER_ID_KEY = "djantrah.userId";
const SESSION_TOKEN_KEY = "djantrah.session.token.v1";
export const SESSION_SYNC_KEY = "djantrah.session.sync.v1";
const LEGACY_SESSION_KEYS = ["profileId", "userId"];

function clearLegacySessionKeys() {
  for (const key of LEGACY_SESSION_KEYS) {
    window.localStorage.removeItem(key);
  }
}

export function setSessionIds(
  ids: { userId: string; profileId: string },
  csrfToken?: string | null,
  sessionToken?: string | null,
  options?: { broadcast?: boolean },
) {
  resetCsrfTokenCache();
  setCsrfToken(csrfToken);
  clearLegacySessionKeys();
  window.localStorage.setItem(USER_ID_KEY, ids.userId);
  window.localStorage.setItem(PROFILE_ID_KEY, ids.profileId);
  if (typeof sessionToken === "string" && sessionToken.trim().length > 0) {
    window.localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
  } else if (sessionToken === null) {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
  }
  if (options?.broadcast !== false) {
    window.localStorage.setItem(
      SESSION_SYNC_KEY,
      JSON.stringify({
        userId: ids.userId,
        profileId: ids.profileId,
        sessionToken: typeof sessionToken === "string" ? sessionToken : getSessionToken(),
        updatedAt: Date.now(),
      }),
    );
  }
}

export function getProfileId(): string | null {
  return window.localStorage.getItem(PROFILE_ID_KEY);
}

export function getUserId(): string | null {
  return window.localStorage.getItem(USER_ID_KEY);
}

export function getSessionToken(): string | null {
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

export function clearSession(options?: { broadcast?: boolean }) {
  resetCsrfTokenCache();
  setCsrfToken(null);
  window.localStorage.removeItem(USER_ID_KEY);
  window.localStorage.removeItem(PROFILE_ID_KEY);
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
  clearLegacySessionKeys();
  if (options?.broadcast !== false) {
    window.localStorage.setItem(
      SESSION_SYNC_KEY,
      JSON.stringify({
        userId: null,
        profileId: null,
        sessionToken: null,
        updatedAt: Date.now(),
      }),
    );
  }
}



