// Telegram Authentication for Web Apps (Telegram Login Widget / Mini App)

import type { User, AuthResult } from "./auth";
import { isSupabaseConfigured, supabase } from "./supabase";
import { verifyTelegramLogin } from "./api/security.functions";

const TELEGRAM_AUTH_KEY = "telegram-auth";
const isBrowser = typeof window !== "undefined";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Demo mode: Store Telegram users
interface StoredTelegramUser {
  user: User;
  telegramId: number;
  photoUrl?: string;
}

/**
 * Get stored Telegram auth data
 */
function getStoredTelegramAuth(): StoredTelegramUser | null {
  if (!isBrowser) return null;
  const stored = localStorage.getItem(TELEGRAM_AUTH_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StoredTelegramUser;
  } catch {
    return null;
  }
}

/**
 * Clear Telegram auth data
 */
function clearTelegramAuth(): void {
  if (!isBrowser) return;
  localStorage.removeItem(TELEGRAM_AUTH_KEY);
}

/**
 * Authenticate with Telegram (Supabase Mode)
 * Creates/updates user in Supabase with Telegram metadata
 */
async function loginTelegramSupabase(telegramUser: TelegramUser): Promise<AuthResult> {
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  const result = await verifyTelegramLogin({ data: telegramUser });
  if (!result.success || !result.user || !result.session) {
    return { success: false, error: result.error || "Telegram login failed" };
  }

  const { error } = await supabase.auth.setSession({
    access_token: result.session.accessToken,
    refresh_token: result.session.refreshToken,
  });
  if (error) return { success: false, error: error.message };

  return result;
}

/**
 * Main Telegram login function
 */
export async function loginWithTelegram(telegramUser: TelegramUser): Promise<AuthResult> {
  return loginTelegramSupabase(telegramUser);
}

/**
 * Get the stored Telegram user ID (chat ID for sending messages)
 */
export function getTelegramId(): number | null {
  const stored = getStoredTelegramAuth();
  return stored?.telegramId ?? null;
}
