import {
  create,
} from "zustand";

export const usePolygonStore =
  create((set) => ({

    polygons:[],

    selectedPolygon:null,

    addPolygon:(polygon) =>
      set((state) => ({
        polygons:[
          ...state.polygons,
          polygon,
        ],
      })),

    setSelectedPolygon:(polygon) =>
      set({
        selectedPolygon:polygon,
      }),
  }));
