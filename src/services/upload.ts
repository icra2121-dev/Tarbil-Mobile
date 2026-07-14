import { supabase }
from "../lib/supabase";

export async function uploadImage(
  uri
) {

  const response =
    await fetch(uri);

  const blob =
    await response.blob();

  const fileName =
    `${Date.now()}.jpg`;

  const result =
    await supabase.storage
      .from("images")
      .upload(
        fileName,
        blob
      );

  if (result.error) {
    return result;
  }

  const publicResult =
    supabase.storage
      .from("images")
      .getPublicUrl(
        result.data.path
      );

  return {
    ...result,
    publicUrl:
      publicResult.data.publicUrl,
  };
}
