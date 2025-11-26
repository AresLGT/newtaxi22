import { createContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User, UserRole } from "@shared/schema";

const HARDCODED_ADMIN_ID = "7677921905";

export interface UserContextType {
  user: User | null;
  userId: string;
  role: UserRole;
  isLoading: boolean;
  error: Error | null;
  setRole: (role: UserRole) => void;
}

export const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId] = useState<string>(() => {
    // 1. Telegram
    // @ts-ignore
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.id) return String(tgUser.id);
    
    // 2. Test
    const savedId = localStorage.getItem("test_user_id");
    if (savedId) return savedId;

    // 3. Guest
    const newId = "user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("test_user_id", newId);
    return newId;
  });

  // Завантажуємо дані
  const { data: user, isLoading, error, refetch } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
    retry: 1, 
  });

  // Постійно оновлюємо (щоб зловити зміну ролі після введення коду)
  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 3000); 
    return () => clearInterval(interval);
  }, [refetch]);

  let role: UserRole = "client"; // За замовчуванням

  // ТІЛЬКИ ВИ - АДМІН
  if (String(userId) === HARDCODED_ADMIN_ID) {
    role = "admin";
  } else if (user?.role) {
    role = user.role;
  }

  return (
    <UserContext.Provider value={{ user: user ?? null, userId, role, isLoading, error: error as Error | null, setRole: () => {} }}>
      {children}
    </UserContext.Provider>
  );
}