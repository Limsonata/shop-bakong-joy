import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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

export interface Notification {
  id: string;
  user_id: string | null;
  recipient_role: "user" | "admin" | "all" | null;
  type: NotificationType;
  title: string;
  message: string;
  data: (Record<string, unknown> & { link?: string; orderId?: string }) | null;
  read: boolean;
  created_at: string;
}

/**
 * "customer": the user's own notifications + broadcasts to everyone.
 * "admin": shop alerts (new orders, payments, low stock, reviews).
 * Admins can read every row, so the scope filter matters.
 */
export type NotificationScope = "customer" | "admin";

async function fetchNotifications(userId: string, scope: NotificationScope): Promise<Notification[]> {
  if (!supabase) return [];
  const filter =
    scope === "admin"
      ? "recipient_role.in.(admin,all)"
      : `user_id.eq.${userId},recipient_role.eq.all`;
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    // Table not yet created — fail silently
    if (error.code === "42P01" || error.message?.includes("does not exist")) return [];
    throw error;
  }
  return (data as Notification[]) ?? [];
}

function belongsTo(row: Partial<Notification>, userId: string, scope: NotificationScope): boolean {
  if (scope === "admin") return row.recipient_role === "admin" || row.recipient_role === "all";
  return row.user_id === userId || row.recipient_role === "all";
}

export function useNotifications(
  userId: string | undefined,
  options: { scope?: NotificationScope; onNew?: (notification: Notification) => void } = {},
) {
  const scope = options.scope ?? "customer";
  const queryClient = useQueryClient();
  const queryKey = ["notifications", scope, userId];
  const onNewRef = useRef(options.onNew);
  onNewRef.current = options.onNew;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchNotifications(userId!, scope),
    enabled: isSupabaseConfigured && !!userId,
    staleTime: 30_000,
    // Backup for when realtime is not enabled on the project.
    refetchInterval: scope === "admin" ? 60_000 : false,
  });

  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase
      .channel(`notifications-${scope}-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as Notification;
          if (!belongsTo(row, userId, scope)) return;
          onNewRef.current?.(row);
          queryClient.invalidateQueries({ queryKey: ["notifications", scope, userId] });
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, scope, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return;
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!supabase || !query.data) return;
      const unreadIds = query.data.filter((n) => !n.read).map((n) => n.id);
      if (!unreadIds.length) return;
      await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const unreadCount = query.data?.filter((n) => !n.read).length ?? 0;

  return { ...query, unreadCount, markAsRead, markAllAsRead };
}
