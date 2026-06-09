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
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!token || !adminChatId) return { ok: false };

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(adminChatId),
        text: data.text,
        parse_mode: "HTML",
      }),
    });

    return { ok: res.ok };
  });
