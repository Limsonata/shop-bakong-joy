import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Banknote,
  MessageSquare,
  PackageX,
  ShoppingBag,
  TrendingDown,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { isSupabaseConfigured } from "@/lib/supabase";

const SOUND_KEY = "bg-admin-alert-sound";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function icon(type: Notification["type"]) {
  const cls = "mt-0.5 h-4 w-4 shrink-0";
  switch (type) {
    case "payment_received":
      return <Banknote className={cn(cls, "text-green-600")} />;
    case "new_order":
      return <ShoppingBag className={cn(cls, "text-blue-600")} />;
    case "low_stock":
      return <TrendingDown className={cn(cls, "text-amber-600")} />;
    case "out_of_stock":
      return <PackageX className={cn(cls, "text-red-600")} />;
    case "payment_issue":
      return <AlertTriangle className={cn(cls, "text-red-600")} />;
    case "order_cancelled":
      return <XCircle className={cn(cls, "text-muted-foreground")} />;
    case "feedback":
      return <MessageSquare className={cn(cls, "text-purple-600")} />;
    default:
      return <Bell className={cn(cls, "text-muted-foreground")} />;
  }
}

/** Short two-tone chime (no audio file needed). Payments get a brighter tone. */
function chime(kind: "money" | "info" | "warning") {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = kind === "money" ? [880, 1320] : kind === "warning" ? [440, 330] : [660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const start = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
    window.setTimeout(() => void ctx.close(), 1000);
  } catch {
    // Browsers may block audio until the page is clicked once.
  }
}

export function AdminNotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    setSoundOn(localStorage.getItem(SOUND_KEY) !== "off");
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (next) chime("info");
  };

  const { data: notifications = [], unreadCount, markAsRead, markAllAsRead } = useNotifications(
    user?.id,
    {
      scope: "admin",
      onNew: (n) => {
        if (localStorage.getItem(SOUND_KEY) !== "off") {
          chime(
            n.type === "payment_received"
              ? "money"
              : n.type === "payment_issue" || n.type === "out_of_stock"
                ? "warning"
                : "info",
          );
        }
        const link = typeof n.data?.link === "string" ? n.data.link : null;
        toast(n.title, {
          description: n.message,
          action: link ? { label: "Open", onClick: () => void navigate({ to: link }) } : undefined,
        });
      },
    },
  );

  // Show the unread count in the browser tab.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, "");
    document.title = unreadCount > 0 ? `(${unreadCount > 9 ? "9+" : unreadCount}) ${base}` : base;
  }, [unreadCount]);

  if (!user || !isSupabaseConfigured) return null;

  const openNotification = (n: Notification) => {
    if (!n.read) markAsRead.mutate(n.id);
    const link = typeof n.data?.link === "string" ? n.data.link : null;
    if (link) {
      setOpen(false);
      void navigate({ to: link });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Shop notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Shop alerts</span>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSound}
              className="text-muted-foreground hover:text-foreground"
              aria-label={soundOn ? "Mute alert sound" : "Turn on alert sound"}
              title={soundOn ? "Sound on" : "Sound off"}
            >
              {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </button>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[380px]">
          {notifications.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No alerts yet. New orders, payments and low stock will show up here.
            </div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openNotification(n)}
                    className={cn(
                      "flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-0",
                      n.read ? "hover:bg-muted/30" : "bg-muted/40 hover:bg-muted/60",
                    )}
                  >
                    {icon(n.type)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
