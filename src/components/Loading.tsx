import {
  View,
  ActivityIndicator,
  Text,
} from "react-native";

export default function Loading() {

  return (
    <View
      style={{
        flex:1,
        backgroundColor:"#020617",
        justifyContent:"center",
        alignItems:"center",
      }}
    >
      <ActivityIndicator
        size="large"
        color="#16a34a"
      />

      <Text
        style={{
          color:"white",
          marginTop:18,
          fontWeight:"700",
        }}
      >
        TARBİL yükleniyor...
      </Text>
    </View>
  );
}
