// Telegram Authentication for Web Apps
// Uses Telegram Login Widget and localStorage for demo mode

import type { User, UserRole, AuthResult } from "./auth";
import { isSupabaseConfigured, supabase } from "./supabase";
import { notifyWelcome } from "./telegramNotify";

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
  // For demo purposes, we parse without server-side verification
  // In production, send this to your backend to verify the hash
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

  const email = telegramUser.username
    ? `${telegramUser.username}@telegram.local`
    : `tg_${telegramUser.id}@telegram.local`;

  // Fixed password based only on telegram ID (stable across logins)
  const password = `tg_${telegramUser.id}_secret`;
  const name = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ");

  // Try to sign in first (user may already exist)
  const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });

  if (signInData?.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", signInData.user.id)
      .maybeSingle();

    const user: User = {
      id: signInData.user.id,
      email: signInData.user.email || email,
      name: profile?.name || name,
      role: (profile?.role as UserRole) || "user",
      createdAt: new Date(signInData.user.created_at).getTime(),
    };

    return { success: true, user };
  }

  // New user — create account
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        telegram_id: telegramUser.id,
        telegram_username: telegramUser.username,
        telegram_photo: telegramUser.photo_url,
      },
    },
  });

  if (signUpError || !signUpData.user) {
    return { success: false, error: signUpError?.message || "Failed to create Telegram account" };
  }

  // Send welcome DM for new users
  notifyWelcome(telegramUser.id, name);

  const user: User = {
    id: signUpData.user.id,
    email: signUpData.user.email || email,
    name,
    role: "user",
    createdAt: Date.now(),
  };

  return { success: true, user };
}

/**
 * Main Telegram login function
 */
export async function loginWithTelegram(telegramUser: TelegramUser): Promise<AuthResult> {
  if (isSupabaseConfigured) {
    return loginTelegramSupabase(telegramUser);
  }
  return loginTelegramDemo(telegramUser);
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
