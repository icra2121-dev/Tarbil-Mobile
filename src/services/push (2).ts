import * as Notifications
from "expo-notifications";

import {
  Platform,
} from "react-native";

export async function registerForPush() {

  if (
    Platform.OS === "web"
  ) {

    console.log(
      "Web push disabled"
    );

    return null;
  }

  const settings =
    await Notifications
      .getPermissionsAsync();

  let finalStatus =
    settings.status;

  if (
    finalStatus !== "granted"
  ) {

    const request =
      await Notifications
        .requestPermissionsAsync();

    finalStatus =
      request.status;
  }

  if (
    finalStatus !== "granted"
  ) {
    return null;
  }

  const token =
    await Notifications
      .getExpoPushTokenAsync();

  return token.data;
}
