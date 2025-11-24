import { useContext } from "react";
import type { UserRole } from "@shared/schema";
import { UserContext } from "./user-provider";

export interface UserContextType {
  userId: string;
  role: UserRole;
  setRole: (role: UserRole) => void;
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
