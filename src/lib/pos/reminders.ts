// Free payment reminders: the message opens in the phone's own SMS app or in
// Telegram, ready to send. Nothing is sent by a paid gateway.
import { currentShopSettings, formatRiel } from "../shopSettings";

const SHOP_NAME = "BillieGrace Closet";

const money = (value: number) => `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;

/** Cambodian number in international form: "012 345 678" → "+85512345678". */
export function internationalPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `855${digits.slice(1)}`;
  else if (!digits.startsWith("855") && digits.length <= 9) digits = `855${digits}`;
  return `+${digits}`;
}

export interface ReminderTarget {
  name: string;
  phone: string;
  owed: number;
  /** Sale codes the balance belongs to. */
  codes: string[];
}

export function reminderText(target: ReminderTarget): string {
  const rate = currentShopSettings().khrRate;
  const amount =
    rate > 0 ? `${money(target.owed)} (${formatRiel(target.owed, rate)})` : money(target.owed);
  const name = target.name && target.name !== "Walk-in customer" ? ` ${target.name}` : "";
  const refs = target.codes.length ? ` for ${target.codes.join(", ")}` : "";
  return [
    `Hello${name}, this is ${SHOP_NAME}.`,
    `A friendly reminder that a balance of ${amount} is still open${refs}.`,
    "You can pay by ABA / KHQR or in cash. Thank you!",
  ].join(" ");
}

/** sms: link with the message filled in (works on iPhone and Android). */
export function smsLink(target: ReminderTarget): string | null {
  const phone = internationalPhone(target.phone);
  if (!phone) return null;
  return `sms:${phone}?&body=${encodeURIComponent(reminderText(target))}`;
}

/** Telegram chat with that phone number (works when the customer allows it). */
export function telegramChatLink(target: ReminderTarget): string | null {
  const phone = internationalPhone(target.phone);
  return phone ? `https://t.me/${phone}` : null;
}
