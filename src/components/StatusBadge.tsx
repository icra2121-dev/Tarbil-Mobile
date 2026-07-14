import {
  View,
  Text,
} from "react-native";

export default function StatusBadge({
  status,
}) {

  function getColor() {

    if (status === "Tamamlandı") {
      return "#16a34a";
    }

    if (status === "İncelemede") {
      return "#f59e0b";
    }

    return "#2563eb";
  }

  return (
    <View
      style={{
        backgroundColor:getColor(),
        paddingHorizontal:14,
        paddingVertical:8,
        borderRadius:999,
        alignSelf:"flex-start",
        marginTop:12,
      }}
    >
      <Text
        style={{
          color:"white",
          fontWeight:"800",
        }}
      >
        {status}
      </Text>
    </View>
  );
}
