import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Cookie, FileText, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

type LegalPageKey = "conditions" | "privacy" | "cookies";

const navItems: Array<{ key: LegalPageKey; label: string; path: string; icon: LucideIcon }> = [
  { key: "conditions", label: "Conditions", path: "/conditions", icon: FileText },
  { key: "privacy", label: "Confidentialité", path: "/privacy", icon: Shield },
  { key: "cookies", label: "Cookies", path: "/cookies", icon: Cookie },
];

export function LegalShell(props: {
  active: LegalPageKey;
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  const [, setLocation] = useLocation();
  const Icon = props.icon;

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    setLocation("/start");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Button variant="outline" size="icon" className="rounded-full" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {props.eyebrow}
            </div>
            <div className="truncate text-base font-semibold text-foreground">{props.title}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <section className="pb-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">{props.title}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">{props.description}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 border-t border-border/70 pt-4">
            {navItems.map((item) => {
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`inline-flex min-w-0 items-center gap-2 py-1 text-left text-sm transition-colors ${
                    props.active === item.key ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setLocation(item.path)}
                >
                  <ItemIcon className="h-4 w-4 shrink-0" />
                  <span className="break-words">{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-6 space-y-6">{props.children}</div>
      </main>
    </div>
  );
}