import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import type { TelegramUser } from "@/lib/telegramAuth";

interface TelegramLoginButtonProps {
  onAuth: (user: TelegramUser) => void;
  onError?: (error: string) => void;
  botName?: string;
  useMiniApp?: boolean;
}

const BOT_NAME = import.meta.env.VITE_TELEGRAM_BOT_NAME || "YourShopBot";

export function TelegramLoginButton({
  onAuth,
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

  const isInTelegram = typeof window !== "undefined" && !!window.Telegram?.WebApp;

  if (useMiniApp && isInTelegram) {
    const handleMiniAppLogin = () => {
      const initData = window.Telegram!.WebApp!.initData;
      const user = window.Telegram!.WebApp!.initDataUnsafe?.user;
      if (user && initData) {
        handleTelegramCallback({
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          photo_url: user.photo_url,
          auth_date: Math.floor(Date.now() / 1000),
          hash: initData,
        });
      } else {
        onError?.("Telegram WebApp data not available");
      }
    };

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={handleMiniAppLogin}
          className="w-full bg-[#0088cc] hover:bg-[#0077b3] text-white rounded-full py-3 font-medium"
        >
          Continue with Telegram
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
