import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import logoTitle from "@assets/logo-titre.png";

export default function Loader() {
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 1400;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setProgress(Math.round(t * 100));
      if (t >= 1) {
        setLocation("/start");
      } else {
        raf = window.requestAnimationFrame(tick);
      }
    };
    let raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [setLocation]);

  return (
    <div className="min-h-[100svh] bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-xl">
          <div className="flex items-center justify-center">
            <img src={logoTitle} alt="NIXYAH" className="h-10 w-auto" />
          </div>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Chargement…
          </p>

          <div className="mt-4 h-2 rounded-full bg-muted/40 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.2 }}
            />
          </div>

          <button
            type="button"
            onClick={() => setLocation("/start")}
            className="mt-5 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Passer
          </button>
        </div>
      </motion.div>
    </div>
  );
}



