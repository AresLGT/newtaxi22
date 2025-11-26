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
  // 1. Визначаємо ID користувача
  const [userId] = useState<string>(() => {
    // Спроба А: Взяти реальний ID з Telegram (якщо відкрито в боті)
    // @ts-ignore
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.id) {
      return String(tgUser.id);
    }
    
    // Спроба Б: Якщо ми в браузері (тестуємо) - беремо збережений ID
    const savedId = localStorage.getItem("test_user_id");
    if (savedId) return savedId;

    // Спроба В: Якщо нічого немає - генеруємо НОВИЙ випадковий ID (Гість)
    const newId = "user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("test_user_id", newId);
    return newId;
  });

  // 2. Запитуємо у сервера дані про цього користувача
  const { data: user, isLoading, error, refetch } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
    retry: 1, 
  });

  // Періодично перевіряємо статус (на випадок, якщо водій ввів код і роль змінилася)
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000); 
    return () => clearInterval(interval);
  }, [refetch]);

  // Визначаємо роль. За замовчуванням - клієнт.
  const role = user?.role || "client";

  return (
    <UserContext.Provider
      value={{
        user: user ?? null,
        userId,
        role,
        isLoading,
        error: error as Error | null,
        setRole: () => {}, // Роль змінює сервер
      }}
    >
      {children}
    </UserContext.Provider>
  );
}