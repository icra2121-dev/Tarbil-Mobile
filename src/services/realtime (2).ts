import { supabase }
from "../lib/supabase";

export function subscribeTasks(
  callback
) {

  return supabase
    .channel("tasks-live")
    .on(
      "postgres_changes",
      {
        event:"*",
        schema:"public",
        table:"tasks",
      },
      callback
    )
    .subscribe();
}
