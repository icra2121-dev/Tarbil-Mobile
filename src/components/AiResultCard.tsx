import {
  View,
  Text,
} from "react-native";

export default function AiResultCard({
  result,
}) {

  return (
    <View
      style={{
        backgroundColor:"#0f172a",
        borderRadius:24,
        padding:24,
        borderWidth:1,
        borderColor:"#1e293b",
      }}
    >
      <Text
        style={{
          color:"white",
          fontSize:26,
          fontWeight:"800",
        }}
      >
        {result.detectedCrop}
      </Text>

      <Text
        style={{
          color:"#94a3b8",
          marginTop:14,
        }}
      >
        Kayıtlı:
        {" "}
        {result.registeredCrop}
      </Text>

      <Text
        style={{
          color:"#f59e0b",
          marginTop:8,
          fontWeight:"700",
        }}
      >
        Risk:
        {" "}
        {result.riskScore}
      </Text>

      <Text
        style={{
          color:"#22c55e",
          marginTop:8,
          fontWeight:"700",
        }}
      >
        {result.status}
      </Text>
    </View>
  );
}
