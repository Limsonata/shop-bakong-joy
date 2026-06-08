import { useEffect, useState } from "react";
import { getCurrentUser, getCachedUser, type User } from "@/lib/auth";

/**
 * React hook for the current authenticated user.
 * Loads from cache synchronously, then refreshes from the source (Supabase or localStorage).
 */
export function useAuth(): { user: User | null; isLoading: boolean } {
  const [user, setUser] = useState<User | null>(getCachedUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoading };
}
