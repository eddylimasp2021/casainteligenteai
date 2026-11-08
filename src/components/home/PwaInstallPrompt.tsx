import React, { useState, useEffect } from "react";
import { Download, X, Smartphone, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verifica se já está em modo standalone
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Não mostra imediatamente, espera 4 segundos para não ser intrusivo
      setTimeout(() => setShowPrompt(true), 4000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 max-w-sm rounded-2xl border bg-card/95 backdrop-blur-xl p-4 shadow-xl border-primary/30 flex items-start gap-3.5 animate-in slide-in-from-bottom-5 duration-300">
      <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Smartphone className="size-5" />
      </div>

      <div className="space-y-1 flex-1">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground">Instalar HomePulse AI</h4>
          <button
            onClick={() => setShowPrompt(false)}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Instale o app no seu dispositivo para acesso rápido em tela cheia e funcionamento offline.
        </p>

        <div className="pt-2 flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="h-7 text-xs px-3 font-semibold gap-1.5 shadow-xs"
          >
            <Download className="size-3.5" />
            <span>Instalar App</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowPrompt(false)}
            className="h-7 text-xs px-2 text-muted-foreground"
          >
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}
