import { resetCsrfTokenCache } from "@/lib/queryClient";

const PROFILE_ID_KEY = "djantrah.profileId";
const USER_ID_KEY = "djantrah.userId";

export function setSessionIds(ids: { userId: string; profileId: string }) {
  resetCsrfTokenCache();
  window.localStorage.setItem(USER_ID_KEY, ids.userId);
  window.localStorage.setItem(PROFILE_ID_KEY, ids.profileId);
}

export function getProfileId(): string | null {
  return window.localStorage.getItem(PROFILE_ID_KEY);
}

export function clearSession() {
  resetCsrfTokenCache();
  window.localStorage.removeItem(USER_ID_KEY);
  window.localStorage.removeItem(PROFILE_ID_KEY);
}



