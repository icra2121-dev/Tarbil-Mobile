import {
  createTask,
} from "./tasks";

import {
  saveOfflineTask,
} from "./offline";

import {
  checkConnection,
} from "./connection";

import {
  sendTaskNotification,
} from "./notifications";

export async function createTaskSmart(
  task
) {

  const online =
    await checkConnection();

  if (online) {

    const result =
      await createTask(task);

    await sendTaskNotification(
      "Yeni Görev",
      `${task.parcel_no} oluşturuldu`
    );

    return result;
  }

  await saveOfflineTask(task);

  await sendTaskNotification(
    "Offline Görev",
    "Görev cihazda saklandı"
  );

  return {
    offline:true,
  };
}
