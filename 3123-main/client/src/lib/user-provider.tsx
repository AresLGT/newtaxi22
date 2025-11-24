import { createContext, useState, ReactNode } from "react";
import type { UserRole } from "@shared/schema";

export interface UserContextType {
  userId: string;
  role: UserRole;
  setRole: (role: UserRole) => void;
}

export const UserContext = createContext<UserContextType>({
  userId: "",
  role: "client",
  setRole: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("client");

  const userId = role === "admin" 
    ? "admin1" 
    : `${role}-${Math.random().toString(36).substring(7)}`;

  const value: UserContextType = {
    userId,
    role,
    setRole,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}
