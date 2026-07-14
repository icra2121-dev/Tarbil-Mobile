import * as Notifications
from "expo-notifications";

export async function sendRiskAlert(
  parcel
) {

  await Notifications.scheduleNotificationAsync({
    content:{
      title:"Yüksek Risk Alarmı",

      body:`${parcel} parselinde AI uyuşmazlığı tespit edildi`,
    },

    trigger:null,
  });
}
