import * as Location from "expo-location";

export async function getCurrentLocation() {

  try {

    const permission =
      await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      return null;
    }

    const location =
      await Location.getCurrentPositionAsync({
        accuracy:
          Location.Accuracy.Balanced,
      });

    return {
      latitude:
        location.coords.latitude,

      longitude:
        location.coords.longitude,
    };

  } catch (error) {

    console.log(
      "LOCATION ERROR",
      error
    );

    return null;
  }
}