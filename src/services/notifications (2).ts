import * as Notifications
from "expo-notifications";

Notifications
  .setNotificationHandler({

    handleNotification:
      async () => ({

        shouldShowBanner:true,
        shouldShowList:true,
        shouldPlaySound:true,
        shouldSetBadge:true,
      }),
  });

export async function sendTaskNotification(
  title:string,
  body:string
) {
  return await Notifications
    .scheduleNotificationAsync({
      content:{
        title,
        body,
      },
      trigger:null,
    });
}
