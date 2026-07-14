import { Linking } from "react-native";

export async function navigateToUnit(
  latitude:number,
  longitude:number
) {

  const url =
    `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  await Linking.openURL(url);
}