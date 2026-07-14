import {
  subscribeTasks,
} from "./realtime";

export function startDashboardLive(
  callback
) {

  return subscribeTasks(() => {
    callback();
  });
}
