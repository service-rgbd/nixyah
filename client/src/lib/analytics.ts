import { getConsent } from "@/lib/consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: any[]) => void;
  }
}

const GA_TRACKING_ID = "G-LJMGR6W81P";
let analyticsLoaded = false;

export function loadAnalyticsIfConsented() {
  if (typeof window === "undefined") return;
  if (!getConsent().cookiesOk) return;
  if (analyticsLoaded) return;
  if (typeof window.gtag !== "function") return;

  window.gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("config", GA_TRACKING_ID, {
    send_page_view: false,
    anonymize_ip: true,
  });

  analyticsLoaded = true;
}

export function trackPageView(path: string, title?: string) {
  if (typeof window === "undefined") return;
  loadAnalyticsIfConsented();
  if (!analyticsLoaded || typeof window.gtag !== "function") return;

  window.gtag("event", "page_view", {
    page_title: title ?? document.title,
    page_location: window.location.href,
    page_path: path,
  });
}

export function trackConversion(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  loadAnalyticsIfConsented();
  if (!analyticsLoaded || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params ?? {});
}

