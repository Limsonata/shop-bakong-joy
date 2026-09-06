// Authentication and user management via Supabase Auth.
import { supabase } from "./supabase";

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: number;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  session?: {
    accessToken: string;
    refreshToken: string;
  };
}

const CART_STORAGE_KEY = "local-cart";
const ZUSTAND_CART_KEY = "bakong-cart-store";

const isBrowser = typeof window !== "undefined";

/**
 * Clear all cart storage so a different user does not inherit
 * the previous user's items. Called on every login, register, and logout.
 */
function clearAllCartStorage(): void {
  if (!isBrowser) return;
  localStorage.removeItem(CART_STORAGE_KEY);
  localStorage.removeItem(ZUSTAND_CART_KEY);
}

// Cached current user (avoids hitting the network repeatedly during a render)
let cachedUser: User | null | undefined = undefined;

function setCachedUser(user: User | null) {
  cachedUser = user;
}

// ===== Production: Supabase =====
async function loginSupabase(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { success: false, error: "Supabase not configured" };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { success: false, error: error?.message || "Login failed" };
  }

  // Fetch profile (role + name)
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role: UserRole =
    (data.user.app_metadata?.role as UserRole) || (profile?.role as UserRole) || "user";

  const user: User = {
    id: data.user.id,
    email: data.user.email || email,
    name: profile?.name || data.user.user_metadata?.name || email.split("@")[0],
    role,
    createdAt: new Date(data.user.created_at).getTime(),
  };

  setCachedUser(user);
  clearAllCartStorage();
  return { success: true, user };
}

async function registerSupabase(
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  if (!supabase) return { success: false, error: "Supabase not configured" };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error || !data.user) {
    return { success: false, error: error?.message || "Registration failed" };
  }

  const user: User = {
    id: data.user.id,
    email: data.user.email || email,
    name,
    role: "user",
    createdAt: Date.now(),
  };

  setCachedUser(user);
  clearAllCartStorage();
  return { success: true, user };
}

async function logoutSupabase(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  setCachedUser(null);
  clearAllCartStorage();
}

async function getCurrentUserSupabase(): Promise<User | null> {
  if (!supabase) return null;
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", authUser.id)
    .maybeSingle();

  const role: UserRole =
    (authUser.app_metadata?.role as UserRole) || (profile?.role as UserRole) || "user";

  return {
    id: authUser.id,
    email: authUser.email || "",
    name: profile?.name || authUser.user_metadata?.name || (authUser.email || "").split("@")[0],
    role,
    createdAt: new Date(authUser.created_at).getTime(),
  };
}

// ===== Public API =====

/**
 * Login (async) via Supabase Auth.
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  return loginSupabase(email, password);
}

/**
 * Register a new account (async) via Supabase Auth.
 */
export async function register(email: string, password: string, name: string): Promise<AuthResult> {
  return registerSupabase(email, password, name);
}

/**
 * Sign the current user out.
 */
export async function logout(): Promise<void> {
  await logoutSupabase();
}

/**
 * Get the current user (async network call to Supabase).
 *
 * For UI-friendly synchronous access, use `getCachedUser()`.
 */
export async function getCurrentUser(): Promise<User | null> {
  const user = await getCurrentUserSupabase();
  setCachedUser(user);
  return user;
}

/**
 * Synchronous access to the current user. Returns the cached value populated
 * by the most recent `getCurrentUser()` call. May return null on the first
 * call before the cache is populated.
 */
export function getCachedUser(): User | null {
  return cachedUser ?? null;
}

/**
 * Check if there is an authenticated user. Synchronous - uses the cache.
 */
export function isAuthenticated(): boolean {
  return getCachedUser() !== null;
}

/**
 * Check if the current user is an admin. Synchronous - uses the cache.
 */
export function isAdmin(): boolean {
  return getCachedUser()?.role === "admin";
}

/**
 * Set a new password after arriving from a reset email link.
 * Must be called while a recovery session is active.
 */
export async function updatePassword(
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: "Not configured" };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Send a password reset email.
 */
export async function forgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: "Supabase authentication is required" };
  const appUrl =
    (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const redirectTo = `${appUrl}/login`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Update the current user's profile.
 */
export async function updateProfile(
  updates: Partial<Pick<User, "name" | "email">>,
): Promise<boolean> {
  if (!supabase) return false;
  const user = await getCurrentUser();
  if (!user) return false;

  if (updates.name) {
    await supabase.from("profiles").update({ name: updates.name }).eq("id", user.id);
  }
  if (updates.email) {
    await supabase.auth.updateUser({ email: updates.email });
  }
  await getCurrentUser(); // Refresh cache
  return true;
}
