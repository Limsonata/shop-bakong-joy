import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { CheckCircle2, Clock, Download, Loader2, RefreshCw, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  checkOrderPayment,
  startOrderPayment,
  type KhqrSession,
} from "@/lib/api/payway.functions";

export const Route = createFileRoute("/pay/$orderId")({
  head: () => ({ meta: [{ title: "Pay with KHQR — BillieGrace Closet" }] }),
  component: PayPage,
});

const POLL_MS = 3000;

function formatAmount(amount: number, currency: string): string {
  return currency.toUpperCase() === "KHR"
    ? `${Math.round(amount).toLocaleString()} ៛`
    : `$${amount.toFixed(2)}`;
}

function useCountdown(expiresAt: string | null): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(new Date(expiresAt).getTime() - Date.now(), 0));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return left;
}

function isMobile(): boolean {
  return typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function PayPage() {
  const { orderId } = Route.useParams();
  const [session, setSession] = useState<KhqrSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const left = useCountdown(session?.state === "pending" ? session.expiresAt : null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSession(await startOrderPayment({ data: { orderId } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the payment");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ask the bank every few seconds while the QR is open and the page is visible.
  useEffect(() => {
    if (session?.state !== "pending") return;
    let stopped = false;
    let busy = false;
    const poll = async () => {
      if (busy || stopped || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const next = await checkOrderPayment({ data: { orderId } });
        if (stopped) return;
        if (next.state === "paid") toast.success("Payment received!");
        if (next.state !== "pending" || next.tranId !== session.tranId) setSession(next);
      } catch {
        // Network blip — try again on the next tick.
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [orderId, session?.state, session?.tranId]);

  const saveQr = () => {
    const canvas = canvasWrap.current?.querySelector("canvas");
    if (!canvas || !session) return;
    const link = document.createElement("a");
    link.download = `BillieGrace-KHQR-${session.reference}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (loading && !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Preparing your KHQR…
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <XCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <p className="font-medium">We couldn't open this payment</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-6" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  if (!session) return null;

  if (session.state === "paid") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12">
        <Card className="w-full text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
            <CardTitle>Payment received</CardTitle>
            <CardDescription>
              Thank you! We received {formatAmount(session.amount, session.currency)} for order{" "}
              <span className="font-mono font-semibold">{session.reference}</span> and are preparing it now.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/track" search={{ ref: session.reference }}>Track my order</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/shop">Continue shopping</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.state === "cancelled" || session.state === "closed") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <XCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-medium">
          {session.state === "cancelled" ? "This order was cancelled" : "This order is not paid by KHQR"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Order {session.reference}. Contact us if you need help.
        </p>
        <Button asChild className="mt-6">
          <Link to="/shop">Back to shop</Link>
        </Button>
      </div>
    );
  }

  const expired = session.state === "expired" || (session.state === "pending" && left === 0 && !!session.expiresAt);
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-12">
      <div className="overflow-hidden rounded-3xl border bg-white text-black shadow-xl">
        {/* KHQR header */}
        <div className="flex items-center justify-between bg-[#E1232E] px-5 py-3 text-white">
          <span className="text-lg font-bold tracking-wide">KHQR</span>
          <span className="text-xs opacity-90">Order {session.reference}</span>
        </div>

        <div className="px-6 pb-6 pt-5">
          <p className="text-sm text-black/60">BillieGrace Closet</p>
          <p className="text-3xl font-semibold">{formatAmount(session.amount, session.currency)}</p>

          <div className="my-5 border-t border-dashed border-black/20" />

          <div ref={canvasWrap} className="relative mx-auto flex w-full max-w-[260px] justify-center">
            {session.qrString && !expired ? (
              <QRCodeCanvas
                value={session.qrString}
                size={260}
                level="M"
                marginSize={1}
                className="h-auto w-full"
              />
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-xl bg-black/5 text-center">
                <Clock className="h-8 w-8 text-black/40" />
                <p className="px-6 text-sm text-black/60">This QR expired. Get a new one to pay.</p>
              </div>
            )}
          </div>

          {!expired ? (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-black/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for payment · {minutes}:{String(seconds).padStart(2, "0")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {expired ? (
          <Button className="w-full" size="lg" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Get a new QR
          </Button>
        ) : (
          <>
            {session.deeplink && isMobile() ? (
              <Button asChild className="w-full" size="lg">
                <a href={session.deeplink}>
                  <Smartphone className="mr-2 h-4 w-4" /> Open in ABA Mobile
                </a>
              </Button>
            ) : null}
            <Button variant="outline" className="w-full" onClick={saveQr}>
              <Download className="mr-2 h-4 w-4" /> Save QR to photos
            </Button>
          </>
        )}
      </div>

      <ol className="mt-6 space-y-2 text-sm text-muted-foreground">
        <li>1. Open ABA, ACLEDA, Wing, Bakong or any Cambodian bank app.</li>
        <li>2. Scan this QR (or upload the saved image). The amount is filled in for you.</li>
        <li>3. Confirm. This page updates by itself when the payment arrives.</li>
      </ol>
    </div>
  );
}
