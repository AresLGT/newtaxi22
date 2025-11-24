import { useContext } from "react";
import { UserContext, type UserContextType } from "./user-provider";

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
