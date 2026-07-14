import { supabase }
from "../lib/supabase";

export async function savePushToken(
  token
) {

  const {
    data:{
      user,
    },
  } = await supabase.auth
    .getUser();

  if (!user) {
    return;
  }

  await supabase
    .from("profiles")
    .update({
      push_token:token,
    })
    .eq("id",user.id);
}
