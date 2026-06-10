// Authentication and user management.
// Uses Supabase Auth when configured, falls back to demo mode otherwise.
import { supabase, isSupabaseConfigured, isDemoModeAllowed } from "./supabase";

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
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

// ----- Demo mode (used when Supabase env vars are not set) -----
const DEMO_USERS = [
  {
    id: "demo-admin-1",
    email: "admin@shop.com",
    password: "admin123",
    name: "Admin User",
    role: "admin" as UserRole,
    createdAt: Date.now(),
  },
  {
    id: "demo-user-1",
    email: "user@shop.com",
    password: "user123",
    name: "Regular User",
    role: "user" as UserRole,
    createdAt: Date.now(),
  },
];

const AUTH_STORAGE_KEY = "shop-auth";
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

// Cached current user (avoids hitting localStorage / network repeatedly during a render)
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

  const user: User = {
    id: data.user.id,
    email: data.user.email || email,
    name: profile?.name || data.user.user_metadata?.name || email.split("@")[0],
    role: (profile?.role as UserRole) || "user",
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

  return {
    id: authUser.id,
    email: authUser.email || "",
    name: profile?.name || authUser.user_metadata?.name || (authUser.email || "").split("@")[0],
    role: (profile?.role as UserRole) || "user",
    createdAt: new Date(authUser.created_at).getTime(),
  };
}

// ===== Demo mode =====
function loginDemo(email: string, password: string): AuthResult {
  if (!isBrowser) return { success: false, error: "Not in browser" };

  const user = DEMO_USERS.find((u) => u.email === email && u.password === password);
  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  const authUser: User = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };

  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ user: authUser, isAuthenticated: true } as AuthState),
  );
  setCachedUser(authUser);
  clearAllCartStorage();
  return { success: true, user: authUser };
}

function registerDemo(email: string, password: string, name: string): AuthResult {
  if (!isBrowser) return { success: false, error: "Not in browser" };

  if (DEMO_USERS.find((u) => u.email === email)) {
    return { success: false, error: "Email already registered" };
  }

  // Demo-mode register accepts any input (no DB to actually save it)
  void password;
  const newUser: User = {
    id: `demo-${Date.now()}`,
    email,
    name,
    role: "user",
    createdAt: Date.now(),
  };

  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ user: newUser, isAuthenticated: true } as AuthState),
  );
  setCachedUser(newUser);
  clearAllCartStorage();
  return { success: true, user: newUser };
}

function logoutDemo(): void {
  if (!isBrowser) return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  setCachedUser(null);
  clearAllCartStorage();
}

function getCurrentUserDemo(): User | null {
  if (!isBrowser) return null;

  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;

  try {
    const auth: AuthState = JSON.parse(stored);
    return auth.user;
  } catch {
    return null;
  }
}

// ===== Public API =====

/**
 * Login (async). Works with both Supabase and demo mode.
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  if (isSupabaseConfigured) {
    return loginSupabase(email, password);
  }
  if (isDemoModeAllowed) {
    return loginDemo(email, password);
  }
  return { success: false, error: "Supabase authentication is required" };
}

/**
 * Register a new account (async). Works with both Supabase and demo mode.
 */
export async function register(email: string, password: string, name: string): Promise<AuthResult> {
  if (isSupabaseConfigured) {
    return registerSupabase(email, password, name);
  }
  if (isDemoModeAllowed) {
    return registerDemo(email, password, name);
  }
  return { success: false, error: "Supabase authentication is required" };
}

/**
 * Sign the current user out.
 */
export async function logout(): Promise<void> {
  if (isSupabaseConfigured) {
    await logoutSupabase();
    return;
  }
  if (isDemoModeAllowed) {
    logoutDemo();
  }
}

/**
 * Get the current user. In Supabase mode this is async (network call),
 * in demo mode this is synchronous from localStorage.
 *
 * For UI-friendly synchronous access, use `getCachedUser()`.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (isSupabaseConfigured) {
    const user = await getCurrentUserSupabase();
    setCachedUser(user);
    return user;
  }
  if (!isDemoModeAllowed) {
    setCachedUser(null);
    return null;
  }
  const user = getCurrentUserDemo();
  setCachedUser(user);
  return user;
}

/**
 * Synchronous access to the current user. Returns the cached value populated
 * by the most recent `getCurrentUser()` call, or pulls from localStorage in
 * demo mode. May return null on the first call before cache is populated.
 */
export function getCachedUser(): User | null {
  if (cachedUser !== undefined) return cachedUser;
  // Fall back to localStorage in demo mode for the very first sync call
  if (isDemoModeAllowed) {
    const user = getCurrentUserDemo();
    cachedUser = user;
    return user;
  }
  return null;
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
export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: false, error: "Not configured" };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Send a password reset email.
 */
export async function forgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured && supabase) {
    const appUrl =
      (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const redirectTo = `${appUrl}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }
  // Demo mode — no real email, just acknowledge
  return isDemoModeAllowed
    ? { success: true }
    : { success: false, error: "Supabase authentication is required" };
}

/**
 * Update the current user's profile.
 */
export async function updateProfile(
  updates: Partial<Pick<User, "name" | "email">>,
): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
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

  // Demo mode
  if (!isDemoModeAllowed) return false;
  if (!isBrowser) return false;
  const user = getCurrentUserDemo();
  if (!user) return false;

  const updatedUser: User = { ...user, ...updates };
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ user: updatedUser, isAuthenticated: true } as AuthState),
  );
  setCachedUser(updatedUser);
  return true;
}
