import {
  create,
} from "zustand";

export const useMapStore =
  create((set) => ({
    selectedLayer:"TKGM",

    setLayer:(layer) =>
      set({
        selectedLayer:layer,
      }),
  }));
