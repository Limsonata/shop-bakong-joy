// Supabase client with a development-only demo fallback.
// Production must be backed by Supabase; local JSON/localStorage auth is only
// allowed while running Vite in development.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublicKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const isProductionBuild = import.meta.env.PROD;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);
export const isDemoModeAllowed = !isProductionBuild && !isSupabaseConfigured;

if (isProductionBuild && !isSupabaseConfigured) {
  throw new Error(
    "Production builds require VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY",
  );
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublicKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Database row types (match the SQL schema in PRODUCTION-SETUP.md)
export interface DbProduct {
  id: string;
  handle: string;
  title: string;
  description: string | null;
  product_type: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  in_stock: boolean;
  collections: string[] | null;
  variants: Array<{ id: string; title: string; option: string; price: number; availableForSale: boolean }> | null;
  created_at: string;
}

export interface DbOrder {
  id: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  address: string;
  total: number;
  currency: string;
  bakong_reference: string | null;
  bakong_transaction_id: string | null;
  status: "pending" | "paid" | "shipped" | "done" | "cancelled";
  items: unknown;
  created_at: string;
}

export interface DbProfile {
  id: string;
  name: string | null;
  role: "user" | "admin";
  created_at: string;
}
