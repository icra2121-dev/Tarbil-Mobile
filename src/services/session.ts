import { supabase }
from "../lib/supabase";

export async function getCurrentUser() {

  const {
    data,
  } =
    await supabase.auth.getUser();

  return data?.user;
}
