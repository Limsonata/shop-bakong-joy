import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "bg-install-dismissed";

/**
 * Phone-only banner that offers "Add to Home Screen".
 * Android/Chrome uses the native install prompt; iOS Safari has no API, so we show the steps.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    if (isIos && isSafari) {
      setShowIos(true);
      setHidden(false);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <div
      className="fixed inset-x-3 z-50 rounded-2xl border bg-background p-3 shadow-lg md:hidden"
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-label="Install the app"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install BillieGrace</p>
          {showIos ? (
            <p className="text-xs text-muted-foreground">
              Tap <Share className="inline h-3.5 w-3.5 align-text-bottom" /> then{" "}
              <strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Shop faster from your home screen.</p>
          )}
        </div>
        {deferred ? (
          <Button size="sm" onClick={install}>
            <Download className="mr-1 h-4 w-4" /> Install
          </Button>
        ) : null}
      </div>
    </div>
  );
}
