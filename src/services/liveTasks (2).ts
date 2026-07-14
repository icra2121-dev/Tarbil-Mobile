import {
  subscribeTasks,
} from "./realtime";

export function startRealtimeTasks(
  callback
) {

  return subscribeTasks(() => {
    callback();
  });
}
