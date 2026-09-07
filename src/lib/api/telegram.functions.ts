import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const sendTelegramMessage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ chatId: z.number(), text: z.string() }))
  .handler(async ({ data }) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || token === "your_bot_token_here") return { ok: false };

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: data.chatId,
        text: data.text,
        parse_mode: "HTML",
      }),
    });

    return { ok: res.ok };
  });

export const notifyAdmin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ text: z.string() }))
  .handler(async ({ data }) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    // Supports a single chat ID or multiple comma-separated chat IDs
    // (e.g. "987654321,-1001234567890" = personal chat + group).
    const adminChatIds = (process.env.TELEGRAM_ADMIN_CHAT_ID ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map(Number)
      .filter((id) => Number.isFinite(id));
    if (!token || adminChatIds.length === 0) return { ok: false };

    const results = await Promise.all(
      adminChatIds.map(async (chatId) => {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: data.text,
              parse_mode: "HTML",
            }),
          });
          if (!res.ok) {
            console.error(
              `[TelegramNotify] sendMessage to ${chatId} failed:`,
              res.status,
              await res.text().catch(() => ""),
            );
          }
          return res.ok;
        } catch (err) {
          console.error(`[TelegramNotify] sendMessage to ${chatId} error:`, err);
          return false;
        }
      }),
    );

    return { ok: results.every(Boolean) };
  });
