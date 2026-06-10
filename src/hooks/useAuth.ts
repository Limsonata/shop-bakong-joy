import { useEffect, useState } from "react";
import { getCurrentUser, getCachedUser, type User } from "@/lib/auth";
import { getTelegramUser } from "@/lib/telegramAuth";
import { isDemoModeAllowed } from "@/lib/supabase";

/**
 * React hook for the current authenticated user.
 * Supports both email/password auth and Telegram auth.
 * Loads from cache synchronously, then refreshes from the source.
 */
export function useAuth(): { user: User | null; isLoading: boolean } {
  const cachedUser = getCachedUser();
  const telegramUser = isDemoModeAllowed ? getTelegramUser() : null;
  const initialUser = cachedUser || telegramUser;

  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      // First try regular auth
      const regularUser = await getCurrentUser();
      if (regularUser) {
        if (!cancelled) setUser(regularUser);
        if (!cancelled) setIsLoading(false);
        return;
      }

      // Then check Telegram auth (demo mode only)
      const tgUser = isDemoModeAllowed ? getTelegramUser() : null;
      if (tgUser) {
        if (!cancelled) setUser(tgUser);
      }

      if (!cancelled) setIsLoading(false);
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoading };
}
