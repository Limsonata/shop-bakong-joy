import { Copy, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reminderText, smsLink, telegramChatLink, type ReminderTarget } from "@/lib/pos/reminders";
import { cn } from "@/lib/utils";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** One-tap payment reminder: SMS (pre-filled), Telegram (message copied, chat opened) or copy. */
export function ReminderButtons({
  target,
  className,
  compact = false,
}: {
  target: ReminderTarget;
  className?: string;
  compact?: boolean;
}) {
  if (target.owed <= 0) return null;
  const sms = smsLink(target);
  const telegram = telegramChatLink(target);
  const text = reminderText(target);
  const size = compact ? "h-7 px-2 text-xs" : "";

  const openTelegram = async () => {
    const copied = await copy(text);
    if (telegram) window.open(telegram, "_blank", "noopener");
    toast.success(copied ? "Reminder copied. Paste it in the Telegram chat." : "Opening Telegram…");
  };

  const copyOnly = async () => {
    if (await copy(text)) toast.success("Reminder copied");
    else toast.error("Could not copy on this browser");
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {sms ? (
        <Button variant="outline" size="sm" className={size} asChild>
          <a href={sms} title="Open SMS with the reminder filled in">
            <MessageSquare className="mr-1 h-3.5 w-3.5" /> SMS
          </a>
        </Button>
      ) : null}
      {telegram ? (
        <Button
          variant="outline"
          size="sm"
          className={size}
          onClick={() => void openTelegram()}
          title="Copy the reminder and open the customer's Telegram"
        >
          <Send className="mr-1 h-3.5 w-3.5" /> Telegram
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className={size}
        onClick={() => void copyOnly()}
        title="Copy the reminder text"
        aria-label="Copy reminder"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
