// Telegram Authentication for Web Apps
// Uses Telegram Login Widget and localStorage for demo mode

import type { User, UserRole, AuthResult } from "./auth";
import { isDemoModeAllowed, isSupabaseConfigured, supabase } from "./supabase";
import { notifyWelcome } from "./telegramNotify";
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
 * Store Telegram auth data in localStorage (demo mode)
 */
function storeTelegramAuth(data: StoredTelegramUser): void {
  if (!isBrowser) return;
  localStorage.setItem(TELEGRAM_AUTH_KEY, JSON.stringify(data));
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
 * Verify Telegram WebApp initData (for Mini Apps)
 * In production, this should be verified server-side
 */
export function verifyTelegramWebAppData(initData: string): TelegramUser | null {
  if (!isDemoModeAllowed) return null;
  const params = new URLSearchParams(initData);
  const userStr = params.get("user");
  if (!userStr) return null;

  try {
    return JSON.parse(userStr) as TelegramUser;
  } catch {
    return null;
  }
}

/**
 * Authenticate with Telegram (Demo Mode)
 */
async function loginTelegramDemo(telegramUser: TelegramUser): Promise<AuthResult> {
  // Check if this Telegram user already exists
  const existing = getStoredTelegramAuth();

  if (existing && existing.telegramId === telegramUser.id) {
    return { success: true, user: existing.user };
  }

  // Create new user from Telegram data
  const user: User = {
    id: `tg-${telegramUser.id}`,
    email: telegramUser.username
      ? `${telegramUser.username}@telegram.local`
      : `tg_${telegramUser.id}@telegram.local`,
    name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" "),
    role: "user" as UserRole,
    createdAt: telegramUser.auth_date * 1000,
  };

  storeTelegramAuth({
    user,
    telegramId: telegramUser.id,
    photoUrl: telegramUser.photo_url,
  });

  // Send welcome DM (fire-and-forget)
  notifyWelcome(telegramUser.id, user.name);

  return { success: true, user };
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
  if (isSupabaseConfigured) {
    return loginTelegramSupabase(telegramUser);
  }
  if (isDemoModeAllowed) {
    return loginTelegramDemo(telegramUser);
  }
  return { success: false, error: "Supabase authentication is required" };
}

/**
 * Get current Telegram-authenticated user
 */
export function getTelegramUser(): User | null {
  const stored = getStoredTelegramAuth();
  return stored?.user || null;
}

/**
 * Get the stored Telegram user ID (chat ID for sending messages)
 */
export function getTelegramId(): number | null {
  const stored = getStoredTelegramAuth();
  return stored?.telegramId ?? null;
}

/**
 * Get Telegram profile photo URL
 */
export function getTelegramPhoto(): string | null {
  const stored = getStoredTelegramAuth();
  return stored?.photoUrl || null;
}

/**
 * Check if user authenticated via Telegram
 */
export function isTelegramAuth(): boolean {
  const stored = getStoredTelegramAuth();
  return stored !== null;
}

/**
 * Logout from Telegram auth
 */
export function logoutTelegram(): void {
  clearTelegramAuth();
}
