import {
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  useState,
} from "react";

import * as ImagePicker from "expo-image-picker";

import {
  uploadImage,
} from "../services/upload";

import {
  analyzeCropImage,
} from "../services/ai";

import {
  addOfflineImage,
} from "../services/offlineImages";

import { BottomTabMenu } from "../components/BottomTabMenu";

export default function CameraScreen() {

  const [image,setImage] =
    useState(null);

  async function pickImage() {

    const result =
      await ImagePicker
        .launchImageLibraryAsync({

          mediaTypes:
            ImagePicker
              .MediaTypeOptions
              .Images,

          quality:0.7,
        });

    if (result.canceled) {
      return;
    }

    const uri =
      result.assets[0].uri;

    setImage(uri);

    try {

      const uploadResult =
        await uploadImage(uri);

      console.log(
        uploadResult
      );

      if (!uploadResult) {

        await addOfflineImage(
          uri
        );

        Alert.alert(
          "Offline",
          "Saved locally"
        );

        return;
      }

      const publicUrl =
        "publicUrl" in uploadResult
          ? uploadResult.publicUrl
          : "";

      if (!publicUrl) {

        await addOfflineImage(
          uri
        );

        Alert.alert(
          "Offline",
          "Saved locally"
        );

        return;
      }

      const analysis =
        await analyzeCropImage(
          publicUrl
        );

      Alert.alert(
        "AI Analysis",

        `Disease:
${analysis.disease}

Confidence:
${analysis.confidence}

Recommendation:
${analysis.recommendation}`
      );

    } catch (err) {

      console.log(err);

      await addOfflineImage(
        uri
      );

      Alert.alert(
        "Offline",
        "Saved locally"
      );
    }
  }

  return (
    <View
      style={{
        flex:1,
        backgroundColor:"#020617",
        justifyContent:"center",
        alignItems:"center",
        padding:24,
      }}
    >
      <TouchableOpacity
        onPress={pickImage}

        style={{
          backgroundColor:"#16a34a",
          padding:20,
          borderRadius:18,
        }}
      >
        <Text
          style={{
            color:"white",
            fontSize:18,
            fontWeight:"800",
          }}
        >
          Select Image
        </Text>
      </TouchableOpacity>

      {image && (

        <Image
          source={{
            uri:image,
          }}

          style={{
            width:260,
            height:260,
            borderRadius:18,
            marginTop:28,
          }}
        />
      )}
      <BottomTabMenu />
    </View>
  );
}
