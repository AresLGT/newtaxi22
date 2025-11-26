import { createContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User, UserRole } from "@shared/schema";

// ТІЛЬКИ ЦЕЙ ID БУДЕ АДМІНОМ
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
  // 1. Визначаємо ID користувача
  const [userId] = useState<string>(() => {
    // Спроба А: Взяти реальний ID з Telegram (якщо відкрито в боті)
    // @ts-ignore
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.id) {
      return String(tgUser.id);
    }
    
    // Спроба Б: Якщо це браузер - беремо збережений "гостьовий" ID
    const savedId = localStorage.getItem("test_user_id");
    if (savedId) return savedId;

    // Спроба В: Генеруємо НОВИЙ випадковий ID для гостя
    // ВАЖЛИВО: Ми більше не використовуємо тут ваш адмінський ID за замовчуванням!
    const newId = "guest_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("test_user_id", newId);
    return newId;
  });

  // 2. Запитуємо у сервера дані про цього користувача
  const { data: user, isLoading, error, refetch } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
    retry: 1, 
  });

  // Періодично оновлюємо дані (на випадок, якщо водій ввів код і роль змінилася)
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 3000); 
    return () => clearInterval(interval);
  }, [refetch]);

  // 3. Визначаємо роль
  let role: UserRole = "client"; // За замовчуванням всі - клієнти

  // Якщо це ВИ (по ID) - ви завжди Адмін
  if (String(userId) === HARDCODED_ADMIN_ID) {
    role = "admin";
  } 
  // Якщо сервер каже, що це водій/адмін - віримо серверу
  else if (user?.role) {
    role = user.role;
  }

  return (
    <UserContext.Provider
      value={{
        user: user ?? null,
        userId,
        role,
        isLoading,
        error: error as Error | null,
        setRole: () => {}, 
      }}
    >
      {children}
    </UserContext.Provider>
  );
}