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
    Date.now() + ".jpg";

  const result =
    await supabase
      .storage
      .from("images")
      .upload(
        fileName,
        blob,
        {
          contentType:"image/jpeg",
        }
      );

  if (result.error) {
    return result;
  }

  const {
    data,
  } = supabase
    .storage
    .from("images")
    .getPublicUrl(fileName);

  return {
    imageUrl:
      data.publicUrl,
  };
}
