// Server-only Telegram helpers for admin alerts.
import { createHmac } from "node:crypto";
import { getEnv } from "./supabaseAdmin";

export type TelegramButton = { text: string; callbackData: string };

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function getBotToken(): string | null {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  return token && token !== "your_bot_token_here" ? token : null;
}

export function getAdminChatIds(): string[] {
  return (getEnv("TELEGRAM_ADMIN_CHAT_ID") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Secret Telegram sends back in X-Telegram-Bot-Api-Secret-Token (derived from the bot token). */
export function webhookSecret(token: string): string {
  return createHmac("sha256", token).update("billiegrace-telegram-webhook").digest("hex");
}

export async function telegramApi<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const token = getBotToken();
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as {
      ok: boolean;
      result?: T;
      description?: string;
    } | null;
    if (!res.ok || !json?.ok) {
      console.error(`[Telegram] ${method} failed:`, res.status, json?.description);
      return { ok: false, description: json?.description ?? `HTTP ${res.status}` };
    }
    return json;
  } catch (error) {
    console.error(`[Telegram] ${method} error:`, error);
    return { ok: false, description: error instanceof Error ? error.message : String(error) };
  }
}

function keyboard(buttons?: TelegramButton[][]) {
  if (!buttons?.length) return undefined;
  return {
    inline_keyboard: buttons.map((row) =>
      row.map((button) => ({ text: button.text, callback_data: button.callbackData })),
    ),
  };
}

/**
 * Send an HTML message to every admin chat in TELEGRAM_ADMIN_CHAT_ID.
 * Never throws: alerts must not break checkout or payments.
 */
export async function sendAdminTelegram(
  html: string,
  buttons?: TelegramButton[][],
): Promise<boolean> {
  const chatIds = getAdminChatIds();
  if (!getBotToken() || chatIds.length === 0) return false;
  const results = await Promise.all(
    chatIds.map((chatId) =>
      telegramApi("sendMessage", {
        chat_id: chatId,
        text: html.slice(0, 4000),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: keyboard(buttons),
      }),
    ),
  );
  return results.every((r) => r.ok);
}

/** Send a file (e.g. a JSON backup) to every admin chat. Never throws. */
export async function sendAdminTelegramDocument(
  filename: string,
  content: string,
  caption?: string,
): Promise<boolean> {
  const token = getBotToken();
  const chatIds = getAdminChatIds();
  if (!token || chatIds.length === 0) return false;
  const results = await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const form = new FormData();
        form.append("chat_id", chatId);
        if (caption) form.append("caption", caption.slice(0, 1000));
        form.append("document", new Blob([content], { type: "application/json" }), filename);
        const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
          method: "POST",
          body: form,
        });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
        if (!res.ok || !json?.ok) {
          console.error("[Telegram] sendDocument failed:", res.status, json?.description);
          return false;
        }
        return true;
      } catch (error) {
        console.error("[Telegram] sendDocument error:", error);
        return false;
      }
    }),
  );
  return results.every(Boolean);
}
