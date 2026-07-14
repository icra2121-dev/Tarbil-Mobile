import AsyncStorage
from "@react-native-async-storage/async-storage";

const KEY =
  "offline-image-queue";

export async function addOfflineImage(
  uri
) {

  const raw =
    await AsyncStorage
      .getItem(KEY);

  const queue =
    raw
      ? JSON.parse(raw)
      : [];

  queue.push({
    uri,
    created_at:
      new Date()
        .toISOString(),
  });

  await AsyncStorage
    .setItem(
      KEY,
      JSON.stringify(queue)
    );
}

export async function getOfflineImages() {

  const raw =
    await AsyncStorage
      .getItem(KEY);

  return raw
    ? JSON.parse(raw)
    : [];
}

export async function clearOfflineImages() {

  await AsyncStorage
    .removeItem(KEY);
}
