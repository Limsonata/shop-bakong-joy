// Shop-wide settings shared by every device (stored in site_content, section
// "shop_settings"). For now: the riel exchange rate printed on receipts.
import { isSupabaseConfigured, supabase } from "./supabase";

export interface ShopSettings {
  /** Riel per US dollar, used to show KHR next to USD on receipts. 0 = hide KHR. */
  khrRate: number;
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = { khrRate: 4100 };

const SECTION = "shop_settings";
const CACHE_KEY = "shop-settings-shared";

let cached: ShopSettings | null = null;

function readCache(): ShopSettings {
  if (cached) return cached;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored)
        cached = { ...DEFAULT_SHOP_SETTINGS, ...(JSON.parse(stored) as Partial<ShopSettings>) };
    } catch {
      // ignore a broken cache
    }
  }
  return cached ?? DEFAULT_SHOP_SETTINGS;
}

function writeCache(settings: ShopSettings) {
  cached = settings;
  if (typeof window !== "undefined") localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
}

function sanitise(input: Partial<ShopSettings> | null | undefined): ShopSettings {
  const rate = Number(input?.khrRate);
  return {
    khrRate: Number.isFinite(rate) && rate >= 0 ? Math.round(rate) : DEFAULT_SHOP_SETTINGS.khrRate,
  };
}

/** Settings available right now (last loaded copy), without waiting for the network. */
export function currentShopSettings(): ShopSettings {
  return readCache();
}

/** Load the latest settings from the database and remember them on this device. */
export async function loadShopSettings(): Promise<ShopSettings> {
  if (!isSupabaseConfigured || !supabase) return readCache();
  const { data, error } = await supabase
    .from("site_content")
    .select("content")
    .eq("section", SECTION)
    .maybeSingle();
  if (error) {
    console.error("[shopSettings] load failed:", error.message);
    return readCache();
  }
  const settings = data ? sanitise(data.content as Partial<ShopSettings>) : readCache();
  writeCache(settings);
  return settings;
}

/** Save settings for every device (admin only, enforced by RLS). */
export async function saveShopSettings(input: ShopSettings): Promise<ShopSettings> {
  const settings = sanitise(input);
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("site_content")
      .upsert({ section: SECTION, content: settings }, { onConflict: "section" });
    if (error) throw new Error(`Could not save the settings: ${error.message}`);
  }
  writeCache(settings);
  return settings;
}

/** "៛49,200" — riel rounded to the nearest 100, as cash is handled in Cambodia. */
export function formatRiel(usd: number, rate = currentShopSettings().khrRate): string {
  const riel = Math.round(((Number.isFinite(usd) ? usd : 0) * rate) / 100) * 100;
  return `៛${riel.toLocaleString("en-US")}`;
}
