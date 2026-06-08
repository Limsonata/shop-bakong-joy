// Supabase client with graceful fallback to demo mode.
// When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, this becomes
// the real backend. Otherwise the app keeps using local JSON + localStorage.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
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
