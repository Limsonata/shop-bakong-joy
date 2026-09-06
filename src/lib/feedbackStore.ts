import { supabase } from "./supabase";
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
  if (!supabase) throw new Error("Supabase is not configured");

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

export async function getApprovedFeedback(): Promise<Feedback[]> {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load feedback: ${error.message}`);
  return (data ?? []).map((r) => dbRowToFeedback(r as Record<string, unknown>));
}

export async function getAllFeedback(): Promise<Feedback[]> {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load feedback: ${error.message}`);
  return (data ?? []).map((r) => dbRowToFeedback(r as Record<string, unknown>));
}

export async function approveFeedback(id: string, approved: boolean): Promise<boolean> {
  if (!supabase) throw new Error("Supabase is not configured");

  try {
    const accessToken = await getSupabaseAccessToken();
    await updateAdminFeedbackApproval({ data: { accessToken, id, approved } });
    return true;
  } catch {
    return false;
  }
}

export async function deleteFeedback(id: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase is not configured");

  try {
    const accessToken = await getSupabaseAccessToken();
    await deleteAdminFeedback({ data: { accessToken, id } });
    return true;
  } catch {
    return false;
  }
}
