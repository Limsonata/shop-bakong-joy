import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, CircleAlert, Loader2, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseAccessToken } from "@/lib/authToken";
import {
  connectTelegramButtons,
  getTelegramSetup,
  sendDailySummaryNow,
  sendTelegramTest,
} from "@/lib/api/telegram.functions";
import { getPaymentSetup } from "@/lib/api/payway.functions";

type TelegramSetup = Awaited<ReturnType<typeof getTelegramSetup>>;
type PaymentSetup = Awaited<ReturnType<typeof getPaymentSetup>>;

function Row({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
      ) : (
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      )}
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

/** Admin → Settings: KHQR payment and Telegram alert status, with test buttons. */
export function AlertsSetupCard() {
  const [telegram, setTelegram] = useState<TelegramSetup | null>(null);
  const [payment, setPayment] = useState<PaymentSetup | null>(null);
  const [busy, setBusy] = useState<"test" | "buttons" | "summary" | null>(null);

  const load = useCallback(async () => {
    const accessToken = await getSupabaseAccessToken();
    const [t, p] = await Promise.allSettled([
      getTelegramSetup({ data: { accessToken } }),
      getPaymentSetup({ data: { accessToken } }),
    ]);
    if (t.status === "fulfilled") setTelegram(t.value);
    if (p.status === "fulfilled") setPayment(p.value);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const test = async () => {
    setBusy("test");
    try {
      const result = await sendTelegramTest({ data: { accessToken: await getSupabaseAccessToken() } });
      if (result.ok) toast.success("Test alert sent. Check Telegram.");
      else toast.error("Telegram did not accept the message. Check the bot token and chat IDs.");
    } finally {
      setBusy(null);
    }
  };

  const summary = async () => {
    setBusy("summary");
    try {
      const result = await sendDailySummaryNow({ data: { accessToken: await getSupabaseAccessToken() } });
      if (result.ok) toast.success("Summary sent. It also goes out every evening at 21:00 when CRON_SECRET is set.");
      else toast.error(result.reason ?? "Could not send the summary");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the summary");
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy("buttons");
    try {
      const result = await connectTelegramButtons({
        data: { accessToken: await getSupabaseAccessToken(), origin: window.location.origin },
      });
      if (result.ok) toast.success("Order buttons are on");
      else toast.error(result.reason ?? "Could not turn on the buttons");
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments & alerts</CardTitle>
        <CardDescription>
          KHQR payments confirm orders automatically. Alerts go to the bell in the admin and to Telegram.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!telegram || !payment ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking setup…
          </p>
        ) : (
          <>
            <Row
              ok={payment.configured && !payment.sandbox}
              title={
                payment.configured
                  ? payment.sandbox
                    ? "KHQR: test mode (ABA sandbox)"
                    : "KHQR: live"
                  : "KHQR: not set up"
              }
              detail={
                payment.configured
                  ? payment.sandbox
                    ? "Payments are test payments. Set PAYWAY_BASE_URL to https://checkout.payway.com.kh when ABA gives you live keys."
                    : payment.callback
                      ? "Customers pay with any bank app and orders are confirmed instantly."
                      : "Working by checking every few seconds. Set APP_URL so ABA can also notify the site instantly."
                  : "Checkout shows the old ABA QR (you confirm payments yourself) until PAYWAY_MERCHANT_ID and PAYWAY_API_KEY are set."
              }
            />
            <Row
              ok={telegram.botToken && telegram.chats > 0}
              title={telegram.botToken && telegram.chats > 0 ? `Telegram alerts: on (${telegram.chats} chat${telegram.chats > 1 ? "s" : ""})` : "Telegram alerts: off"}
              detail={
                telegram.botToken
                  ? telegram.chats > 0
                    ? "New orders, payments, wrong amounts and low stock are sent to Telegram."
                    : "Set TELEGRAM_ADMIN_CHAT_ID to your chat or group ID."
                  : "Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID."
              }
            />
            <Row
              ok={telegram.buttonsOn}
              title={telegram.buttonsOn ? "Telegram order buttons: on" : "Telegram order buttons: off"}
              detail={
                telegram.buttonsOn
                  ? "Tap “Mark shipped” / “Delivered” under an alert to update the order."
                  : telegram.webhookUrl
                    ? `The bot currently sends updates to ${telegram.webhookUrl}. Turning buttons on replaces that.`
                    : "Turn on to update orders straight from Telegram."
              }
            />
            {"lastError" in telegram && telegram.lastError ? (
              <p className="text-xs text-destructive">Last Telegram error: {telegram.lastError}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => void test()} disabled={busy !== null || !telegram.botToken}>
                {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send test alert
              </Button>
              <Button variant="outline" size="sm" onClick={() => void summary()} disabled={busy !== null || !telegram.botToken}>
                {busy === "summary" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                Send today's summary now
              </Button>
              <Button size="sm" onClick={() => void connect()} disabled={busy !== null || !telegram.botToken}>
                {busy === "buttons" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
                {telegram.buttonsOn ? "Reconnect order buttons" : "Turn on order buttons"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
