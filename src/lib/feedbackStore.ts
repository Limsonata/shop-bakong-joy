import { supabase, isSupabaseConfigured } from "./supabase";
import { getSupabaseAccessToken } from "./authToken";
import { deleteAdminFeedback, updateAdminFeedbackApproval } from "./api/security.functions";

export interface Feedback {
  id: string;
  name: string;
  location: string;
  rating: number;
  text: string;
  highlight: string;
  approved: boolean;
  createdAt: number;
}

export interface CreateFeedbackInput {
  name: string;
  location: string;
  rating: number;
  text: string;
  highlight: string;
}

const STORAGE_KEY = "local-feedback";
const isBrowser = typeof window !== "undefined";

function getLocalFeedback(): Feedback[] {
  if (!isBrowser) return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalFeedback(items: Feedback[]): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function dbRowToFeedback(row: Record<string, unknown>): Feedback {
  return {
    id: row.id as string,
    name: row.name as string,
    location: (row.location as string) ?? "",
    rating: row.rating as number,
    text: row.text as string,
    highlight: (row.highlight as string) ?? "",
    approved: (row.approved as boolean) ?? false,
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

export async function submitFeedback(input: CreateFeedbackInput): Promise<Feedback> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("feedback")
      .insert({
        name: input.name,
        location: input.location,
        rating: input.rating,
        text: input.text,
        highlight: input.highlight,
        approved: false,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message || "Failed to submit feedback");
    return dbRowToFeedback(data as Record<string, unknown>);
  }

  const item: Feedback = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...input,
    approved: false,
    createdAt: Date.now(),
  };
  const all = getLocalFeedback();
  all.unshift(item);
  saveLocalFeedback(all);
  return item;
}

export async function getApprovedFeedback(): Promise<Feedback[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("approved", true)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((r) => dbRowToFeedback(r as Record<string, unknown>));
  }
  return getLocalFeedback().filter((f) => f.approved);
}

export async function getAllFeedback(): Promise<Feedback[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((r) => dbRowToFeedback(r as Record<string, unknown>));
  }
  return getLocalFeedback();
}

export async function approveFeedback(id: string, approved: boolean): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const accessToken = await getSupabaseAccessToken();
      await updateAdminFeedbackApproval({ data: { accessToken, id, approved } });
      return true;
    } catch {
      return false;
    }
  }
  const all = getLocalFeedback();
  const item = all.find((f) => f.id === id);
  if (!item) return false;
  item.approved = approved;
  saveLocalFeedback(all);
  return true;
}

export async function deleteFeedback(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const accessToken = await getSupabaseAccessToken();
      await deleteAdminFeedback({ data: { accessToken, id } });
      return true;
    } catch {
      return false;
    }
  }
  const all = getLocalFeedback().filter((f) => f.id !== id);
  saveLocalFeedback(all);
  return true;
}
