import { createContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User, UserRole } from "@shared/schema";

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
  // 1. Спроба отримати ID з Telegram WebApp
  const [userId, setUserId] = useState<string>(() => {
    // @ts-ignore
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.id) return String(tgUser.id);
    
    // 2. Якщо не в Телеграмі - беремо з localStorage (для тестування клієнтів)
    const savedId = localStorage.getItem("test_user_id");
    if (savedId) return savedId;

    // 3. Якщо зовсім новий вхід - генеруємо випадковий ID
    const newId = "user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("test_user_id", newId);
    return newId;
  });

  // 4. Завантажуємо дані про користувача з бази
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
    retry: false,
  });

  // За замовчуванням роль - клієнт, якщо база не каже інакше
  const role = user?.role || "client";

  return (
    <UserContext.Provider
      value={{
        user: user ?? null,
        userId,
        role,
        isLoading,
        error: error as Error | null,
        setRole: () => {}, // Роль змінюється тільки через сервер
      }}
    >
      {children}
    </UserContext.Provider>
  );
}