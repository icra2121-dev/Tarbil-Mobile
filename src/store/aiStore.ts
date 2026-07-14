import {
  create,
} from "zustand";

export const useAiStore =
  create((set) => ({

    loading:false,

    result:null,

    setLoading:(value) =>
      set({
        loading:value,
      }),

    setResult:(result) =>
      set({
        result,
      }),
  }));
