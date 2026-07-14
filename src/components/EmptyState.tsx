import {
  View,
  Text,
} from "react-native";

export default function EmptyState({
  title,
}) {

  return (
    <View
      style={{
        marginTop:40,
        backgroundColor:"#0f172a",
        borderRadius:28,
        padding:32,
        alignItems:"center",
      }}
    >
      <Text
        style={{
          color:"#94a3b8",
          fontSize:18,
          textAlign:"center",
        }}
      >
        {title}
      </Text>
    </View>
  );
}
