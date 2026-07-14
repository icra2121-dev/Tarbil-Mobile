import {
  supabase,
} from "../lib/supabase";

export async function getMyRole() {

  const {
    data:userData,
  } = await supabase.auth
    .getUser();

  const user =
    userData?.user;

  if (!user) {
    return null;
  }

  const result =
    await supabase

      .from("profiles")

      .select("role")

      .eq("id",user.id)

      .single();

  return result.data?.role;
}
