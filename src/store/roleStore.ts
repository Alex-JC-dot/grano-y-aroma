import { create } from "zustand";
import { Role } from "@/lib/types";

interface RoleStore {
  role: Role;
  setRole: (role: Role) => void;
}

export const useRoleStore = create<RoleStore>((set) => ({
  role: "cliente",
  setRole: (role) => set({ role }),
}));
