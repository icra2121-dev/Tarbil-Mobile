import * as Sharing
from "expo-sharing";

export async function sharePdf(
  uri
) {

  await Sharing.shareAsync(uri);
}
