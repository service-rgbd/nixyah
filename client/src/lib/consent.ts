import { useLocalStorageState } from "@/hooks/use-local-storage";

export type ConsentState = {
  ageOk: boolean;
  cookiesOk: boolean;
  conditionsOk: boolean;
};

export const defaultConsent: ConsentState = {
  ageOk: false,
  cookiesOk: false,
  conditionsOk: false,
};

export function useConsent() {
  return useLocalStorageState<ConsentState>("djantrah.consent.v1", defaultConsent);
}

export function getConsent(): ConsentState {
  try {
    const raw = window.localStorage.getItem("djantrah.consent.v1");
    if (!raw) return defaultConsent;
    return { ...defaultConsent, ...(JSON.parse(raw) as Partial<ConsentState>) };
  } catch {
    return defaultConsent;
  }
}



