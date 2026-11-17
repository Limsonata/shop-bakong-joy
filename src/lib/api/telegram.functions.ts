import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  escapeHtml,
  getAdminChatIds,
  getBotToken,
  sendAdminTelegram,
  telegramApi,
  webhookSecret,
} from "@/lib/server/telegram";

const adminSchema = z.object({ accessToken: z.string().min(1).optional().nullable() });

async function requireAdmin(accessToken?: string | null) {
  const { assertAdmin } = await import("./security.functions");
  await assertAdmin(accessToken);
}

/**
 * Shop alerts from the back office (new sale, low stock, end-of-day report).
 * Admin-only: the caller's Supabase access token must belong to an admin.
 * `text` is plain text; it is HTML-escaped here before sending.
 */
export const sendShopAlert = createServerFn({ method: "POST" })
  .inputValidator(adminSchema.extend({ text: z.string().trim().min(1).max(3500) }))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    if (!getBotToken() || getAdminChatIds().length === 0) {
      return { ok: false, reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID is not set" };
    }
    const ok = await sendAdminTelegram(escapeHtml(data.text));
    return { ok, reason: ok ? null : "Telegram rejected the message (check the bot token and chat IDs)" };
  });

/** Status of the Telegram alerts + order buttons, for Admin → Settings. */
export const getTelegramSetup = createServerFn({ method: "POST" })
  .inputValidator(adminSchema)
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const token = getBotToken();
    const chats = getAdminChatIds().length;
    if (!token) return { botToken: false, chats, webhookUrl: null as string | null, buttonsOn: false };
    const info = await telegramApi<{ url?: string; last_error_message?: string }>("getWebhookInfo", {});
    const url = info.result?.url || null;
    return {
      botToken: true,
      chats,
      webhookUrl: url,
      buttonsOn: !!url && url.endsWith("/api/telegram/webhook"),
      lastError: info.result?.last_error_message ?? null,
    };
  });

/** Point the bot at this site so the buttons under order alerts work. */
export const connectTelegramButtons = createServerFn({ method: "POST" })
  .inputValidator(adminSchema.extend({ origin: z.string().url() }))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const token = getBotToken();
    if (!token) return { ok: false, reason: "TELEGRAM_BOT_TOKEN is not set" };
    const origin = new URL(data.origin);
    if (origin.protocol !== "https:") {
      return { ok: false, reason: "Telegram needs an https:// address. Do this on the live site." };
    }
    const result = await telegramApi("setWebhook", {
      url: `${origin.origin}/api/telegram/webhook`,
      secret_token: webhookSecret(token),
      allowed_updates: ["callback_query"],
      drop_pending_updates: true,
    });
    if (result.ok) {
      await sendAdminTelegram("✅ Order buttons are on. Tap them under new order alerts to update orders.");
    }
    return { ok: result.ok, reason: result.ok ? null : (result.description ?? "Telegram refused") };
  });

/** Send a test alert to every admin chat. */
export const sendTelegramTest = createServerFn({ method: "POST" })
  .inputValidator(adminSchema)
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const ok = await sendAdminTelegram("🔔 Test alert from BillieGrace admin. Notifications are working.");
    return { ok };
  });

/** Send the evening summary (and optionally the backup file) right now. */
export const sendDailySummaryNow = createServerFn({ method: "POST" })
  .inputValidator(adminSchema.extend({ backup: z.boolean().optional() }))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    if (!getBotToken() || getAdminChatIds().length === 0) {
      return { ok: false, reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID is not set" };
    }
    const { createServiceClient } = await import("@/lib/server/supabaseAdmin");
    const { sendDailySummary } = await import("@/lib/server/dailySummary");
    const result = await sendDailySummary(createServiceClient(), { backup: data.backup ?? false });
    return {
      ok: result.summary && result.backup !== false,
      reason: !result.summary
        ? "Telegram rejected the summary"
        : result.backup === false
          ? "Summary sent, but the backup file failed"
          : null,
    };
  });
