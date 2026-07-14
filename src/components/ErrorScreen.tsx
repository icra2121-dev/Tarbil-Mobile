import {
  View,
  Text,
} from "react-native";

export default function ErrorScreen() {

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
      <Text
        style={{
          color:"#ef4444",
          fontSize:34,
          fontWeight:"800",
        }}
      >
        Sistem Hatası
      </Text>

      <Text
        style={{
          color:"#94a3b8",
          marginTop:18,
          textAlign:"center",
          lineHeight:24,
        }}
      >
        TARBİL operasyon sistemi beklenmeyen hata aldı.
      </Text>
    </View>
  );
}
