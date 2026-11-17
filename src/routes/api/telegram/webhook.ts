import { createFileRoute } from "@tanstack/react-router";

// Telegram calls this when an admin taps a button under an order alert
// (callback_data "st:<status>:<orderId>"). Only works from the chats in
// TELEGRAM_ADMIN_CHAT_ID and only with the secret set by connectTelegramButtons.
type CallbackQuery = {
  id: string;
  data?: string;
  from?: { id: number; first_name?: string; username?: string };
  message?: { message_id: number; chat: { id: number } };
};

const STATUS_WORDS: Record<string, string> = {
  paid: "marked paid 💵",
  shipped: "marked shipped 🚚",
  done: "marked delivered ✅",
};

const ORDER_STEPS = ["pending", "paid", "shipped", "done"];

export const Route = createFileRoute("/api/telegram/webhook")({
  // @ts-expect-error `server` is typed by @tanstack/react-start, which augments a
  // different copy of router-core than the one react-router resolves here.
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const ok = () => new Response("ok");
        const telegram = await import("@/lib/server/telegram");
        const token = telegram.getBotToken();
        if (
          !token ||
          request.headers.get("x-telegram-bot-api-secret-token") !== telegram.webhookSecret(token)
        ) {
          return new Response("unauthorized", { status: 401 });
        }

        const update = (await request.json().catch(() => null)) as {
          callback_query?: CallbackQuery;
        } | null;
        const query = update?.callback_query;
        if (!query?.data || !query.message) return ok();

        const answer = (text: string) =>
          telegram.telegramApi("answerCallbackQuery", { callback_query_id: query.id, text });

        const chatId = String(query.message.chat.id);
        if (!telegram.getAdminChatIds().includes(chatId)) {
          await answer("This chat is not allowed to change orders.");
          return ok();
        }

        const match = /^st:(paid|shipped|done):([0-9a-f-]{36})$/.exec(query.data);
        if (!match) {
          await answer("Unknown button");
          return ok();
        }
        const [, status, orderId] = match as unknown as [string, "paid" | "shipped" | "done", string];

        try {
          const { createServiceClient } = await import("@/lib/server/supabaseAdmin");
          const lifecycle = await import("@/lib/server/orderLifecycle");
          const supabase = createServiceClient();
          const current = await lifecycle.getOrder(supabase, orderId);
          const ref = lifecycle.orderRef(current);

          if (
            current.status === "cancelled" ||
            ORDER_STEPS.indexOf(current.status) >= ORDER_STEPS.indexOf(status)
          ) {
            await answer(`${ref} is already ${current.status}.`);
            return ok();
          }

          let warning = "";
          let order = current;
          const who = query.from?.first_name || query.from?.username || "Admin";
          try {
            order = await lifecycle.applyOrderStatus(supabase, orderId, status, `Telegram: ${who}`);
          } catch (error) {
            warning = error instanceof Error ? error.message : String(error);
            order = await lifecycle.getOrder(supabase, orderId);
          }

          const buttons = lifecycle.orderButtons(order);
          await telegram.telegramApi("editMessageReplyMarkup", {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: buttons.map((row) =>
                row.map((b) => ({ text: b.text, callback_data: b.callbackData })),
              ),
            },
          });
          await telegram.telegramApi("sendMessage", {
            chat_id: query.message.chat.id,
            reply_to_message_id: query.message.message_id,
            parse_mode: "HTML",
            text:
              `${telegram.escapeHtml(ref)} ${STATUS_WORDS[status]} by ${telegram.escapeHtml(who)}` +
              (warning ? `\n❗ ${telegram.escapeHtml(warning)}` : ""),
          });
          await answer(warning ? "Saved, with a warning" : "Done");
        } catch (error) {
          console.error("[Telegram webhook]", error);
          await answer(error instanceof Error ? error.message.slice(0, 180) : "Failed");
        }
        return ok();
      },
    },
  },
});
