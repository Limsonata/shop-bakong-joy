import { useEffect, useState } from "react";
import { getCurrentUser, getCachedUser, type User } from "@/lib/auth";

/**
 * React hook for the current authenticated user.
 * Loads from cache synchronously, then refreshes from Supabase.
 */
export function useAuth(): { user: User | null; isLoading: boolean } {
  const [user, setUser] = useState<User | null>(getCachedUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const current = await getCurrentUser();
      if (cancelled) return;
      setUser(current);
      setIsLoading(false);
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoading };
}
