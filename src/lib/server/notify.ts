// Server-only: in-app notifications (bell) + Telegram alerts in one call.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAdminTelegram, type TelegramButton } from "./telegram";

export type NotificationType =
  | "order_update"
  | "admin_alert"
  | "promotion"
  | "system"
  | "new_order"
  | "payment_received"
  | "payment_issue"
  | "low_stock"
  | "out_of_stock"
  | "order_cancelled"
  | "feedback";

type NotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
};

/** Admin bell notification, plus a Telegram message when `telegram` is given. Never throws. */
export async function notifyAdmins(
  supabase: SupabaseClient,
  input: NotificationInput & { telegram?: { html: string; buttons?: TelegramButton[][] } },
): Promise<void> {
  const tasks: Promise<unknown>[] = [
    Promise.resolve(
      supabase.from("notifications").insert({
        recipient_role: "admin",
        type: input.type,
        title: input.title.slice(0, 200),
        message: input.message.slice(0, 1000),
        data: input.data ?? null,
      }),
    ).then(({ error }) => {
      if (error) console.error("[notifyAdmins] insert failed:", error.message);
    }),
  ];
  if (input.telegram) tasks.push(sendAdminTelegram(input.telegram.html, input.telegram.buttons));
  await Promise.allSettled(tasks);
}

/** Notification for one customer account (no-op for guest orders). Never throws. */
export async function notifyCustomer(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  input: NotificationInput,
): Promise<void> {
  if (!userId) return;
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: input.type,
    title: input.title.slice(0, 200),
    message: input.message.slice(0, 1000),
    data: input.data ?? null,
  });
  if (error) console.error("[notifyCustomer] insert failed:", error.message);
}
