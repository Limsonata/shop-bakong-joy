import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import type { TelegramUser } from "@/lib/telegramAuth";

interface TelegramLoginButtonProps {
  onAuth: (user: TelegramUser) => void;
  onWebAppAuth?: (initData: string) => void;
  onError?: (error: string) => void;
  botName?: string;
  useMiniApp?: boolean;
}

const BOT_NAME = import.meta.env.VITE_TELEGRAM_BOT_NAME || "YourShopBot";

export function TelegramLoginButton({
  onAuth,
  onWebAppAuth,
  onError,
  botName = BOT_NAME,
  useMiniApp = false,
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  const handleTelegramCallback = useCallback(
    (user: TelegramUser) => {
      if (!user.id || !user.auth_date || !user.hash) {
        onError?.("Invalid Telegram authentication data");
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      if (now - user.auth_date > 3600) {
        onError?.("Telegram authentication expired. Please try again.");
        return;
      }
      onAuth(user);
    },
    [onAuth, onError],
  );

  useEffect(() => {
    if (scriptLoaded.current || !containerRef.current) return;

    (window as unknown as Record<string, unknown>).onTelegramAuth = handleTelegramCallback;

    const existing = document.getElementById("telegram-login-script");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = "telegram-login-script";
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");

    script.onload = () => { scriptLoaded.current = true; };
    script.onerror = () => { onError?.("Failed to load Telegram widget"); };

    containerRef.current.appendChild(script);

    return () => {
      const s = document.getElementById("telegram-login-script");
      if (s) s.remove();
      scriptLoaded.current = false;
      delete (window as unknown as Record<string, unknown>).onTelegramAuth;
    };
  }, [botName, handleTelegramCallback, onError]);

  useEffect(() => {
    if (!useMiniApp || !window.Telegram?.WebApp) return;
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }, [useMiniApp]);

  const isInTelegram = typeof window !== "undefined" && !!window.Telegram?.WebApp;
  const miniAppUser =
    useMiniApp && isInTelegram ? window.Telegram!.WebApp!.initDataUnsafe?.user : null;

  if (useMiniApp && isInTelegram) {
    const handleMiniAppLogin = () => {
      const initData = window.Telegram!.WebApp!.initData;
      if (!initData || !onWebAppAuth) {
        onError?.("Telegram WebApp data not available");
        return;
      }
      onWebAppAuth(initData);
    };

    const displayName =
      [miniAppUser?.first_name, miniAppUser?.last_name].filter(Boolean).join(" ") || "Telegram";

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={handleMiniAppLogin}
          className="w-full bg-[#0088cc] hover:bg-[#0077b3] text-white rounded-full py-3 font-medium flex items-center justify-center gap-2"
        >
          {miniAppUser?.photo_url && (
            <img src={miniAppUser.photo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
          )}
          <span>Continue as {displayName}</span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div
        ref={containerRef}
        className="telegram-login-container flex justify-center"
        style={{ minHeight: "48px" }}
      />
    </motion.div>
  );
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
      };
    };
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}
