import {
  create,
} from "zustand";

export const useAppStore =
  create((set) => ({
    online:true,

    userRole:"engineer",

    notifications:[],

    setOnline:(value) =>
      set({
        online:value,
      }),

    addNotification:(notification) =>
      set((state) => ({
        notifications:[
          ...state.notifications,
          notification,
        ],
      })),
  }));
