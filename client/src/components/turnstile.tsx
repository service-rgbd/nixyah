import { useEffect, useMemo, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, any>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type Props = {
  onToken: (token: string | null) => void;
  className?: string;
  action?: string;
};

export function Turnstile({ onToken, className, action }: Props) {
  const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const enabled = Boolean(siteKey && siteKey.trim().length > 0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const scriptSrc = useMemo(
    () => "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const ensureScript = async () => {
      const id = "cf-turnstile-script";
      const existing = document.getElementById(id) as HTMLScriptElement | null;
      if (existing) return;

      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.id = id;
        s.src = scriptSrc;
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load Turnstile script"));
        document.head.appendChild(s);
      });
    };

    const renderWidget = async () => {
      try {
        await ensureScript();
        if (cancelled) return;
        if (!containerRef.current) return;
        if (!window.turnstile) return;

        // Clear previous widget if any
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "auto",
          action,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      } catch {
        onToken(null);
      }
    };

    void renderWidget();

    return () => {
      cancelled = true;
      const wid = widgetIdRef.current;
      if (wid && window.turnstile) {
        try {
          window.turnstile.remove(wid);
        } catch {
          // ignore
        }
      }
      widgetIdRef.current = null;
    };
  }, [enabled, siteKey, scriptSrc, onToken, action]);

  if (!enabled) return null;

  return (
    <div className={className}>
      <div ref={containerRef} />
    </div>
  );
}


