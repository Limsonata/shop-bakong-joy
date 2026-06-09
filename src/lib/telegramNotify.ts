import { sendTelegramMessage, notifyAdmin } from "./api/telegram.functions";
import type { Order } from "./orderStore";

export async function notifyWelcome(telegramId: number, name: string): Promise<void> {
  // Notify admin of new user
  const adminText =
    `🆕 <b>New User Registered!</b>\n\n` +
    `<b>Name:</b> ${name}\n` +
    `<b>Telegram ID:</b> ${telegramId}\n` +
    `<b>Login method:</b> Telegram`;

  await notifyAdmin({ data: { text: adminText } }).catch((err) => {
    console.error("[TelegramNotify] admin notify failed:", err);
  });
}

export async function notifyOrderReceipt(telegramId: number, order: Order): Promise<void> {
  const itemLines = order.items
    .map((i) => `  • ${i.title} × ${i.quantity} — ${i.currency} ${(i.price * i.quantity).toFixed(2)}`)
    .join("\n");

  const text =
    `🧾 <b>Order Confirmed!</b>\n\n` +
    `<b>Order ID:</b> ${order.id}\n` +
    `<b>Reference:</b> ${order.bakongReference ?? "-"}\n\n` +
    `<b>Items:</b>\n${itemLines}\n\n` +
    `<b>Total:</b> ${order.currency} ${order.total.toFixed(2)}\n\n` +
    `<b>Deliver to:</b> ${order.address}\n` +
    `<b>Phone:</b> ${order.phone}\n\n` +
    `We will confirm your Bakong payment shortly. Thank you! 🙏`;

  // Notify admin of new order
  await notifyAdmin({ data: { text } }).catch((err) => {
    console.error("[TelegramNotify] order notify failed:", err);
  });
}
