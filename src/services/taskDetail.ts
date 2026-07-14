import { supabase } from "../lib/supabase";

export async function getTaskById(id: unknown) {
  return await supabase.from("tasks").select("*").eq("id", id).single();
}
