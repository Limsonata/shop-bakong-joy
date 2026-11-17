// Supabase client. Production builds require the env vars below.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublicKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const isProductionBuild = import.meta.env.PROD;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);

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
  images: string[] | null;
  in_stock: boolean;
  collections: string[] | null;
  variants: Array<{
    id: string;
    title: string;
    option: string;
    price: number;
    availableForSale: boolean;
    selectedOptions?: Array<{ name: string; value: string }> | null;
  }> | null;
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
  payment_method?: "khqr" | "aba_manual" | "cod" | null;
  paid_at?: string | null;
  payment_expires_at?: string | null;
  payments?: DbPayment[] | null;
  items: unknown;
  created_at: string;
}

export interface DbPayment {
  id: string;
  tran_id: string;
  amount: number;
  currency: string;
  status: "pending" | "approved" | "declined" | "expired" | "cancelled" | "refunded";
  apv: string | null;
  bank_name: string | null;
  payer_account: string | null;
  payment_type: string | null;
  paid_amount: number | null;
  paid_currency: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface DbProfile {
  id: string;
  name: string | null;
  role: "user" | "admin";
  created_at: string;
}
