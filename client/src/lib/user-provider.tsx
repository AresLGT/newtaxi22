import { createContext, useState, ReactNode, useEffect } from "react";
import type { UserRole } from "@shared/schema";

export interface UserContextType {
  userId: string;
  role: UserRole;
  setRole: (role: UserRole) => void;
  isLoading: boolean;
}

export const UserContext = createContext<UserContextType>({
  userId: "",
  role: "client",
  setRole: () => {},
  isLoading: true,
} as UserContextType);

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("client");
  const [isLoading, setIsLoading] = useState(true);
  const [userIdState, setUserIdState] = useState<string>("");

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // Check URL parameters first (for testing)
        const params = new URLSearchParams(window.location.search);
        let telegramUserId = params.get("userId") ? parseInt(params.get("userId")!) : null;
        
        // Get Telegram user ID from Web App
        if (!telegramUserId) {
          const tg = (window as any).Telegram?.WebApp;
          telegramUserId = tg?.initData ? tg.initDataUnsafe?.user?.id : null;
        }
        
        // Fallback: check localStorage for development/testing
        if (!telegramUserId) {
          const savedId = localStorage.getItem("__dev_telegram_id__");
          if (savedId) {
            telegramUserId = parseInt(savedId);
          }
        }

        if (!telegramUserId) {
          setUserIdState(`client-${Math.random().toString(36).substring(7)}`);
          setIsLoading(false);
          return;
        }

        console.log("🔐 Initializing user with ID:", telegramUserId);

        // Fetch user role from backend
        try {
          const response = await fetch(`/api/users/${telegramUserId}`);
          console.log("📡 User fetch response:", response.status);
          
          if (response.ok) {
            const user = await response.json();
            console.log("✅ User loaded:", user.role, user.id);
            setRole(user.role);
            setUserIdState(user.id);
          } else {
            // User doesn't exist yet, create as client
            console.log("ℹ️ User not found, setting as client");
            setUserIdState(telegramUserId.toString());
            setRole("client");
          }
        } catch (error) {
          console.error("❌ Error fetching user:", error);
          setUserIdState(telegramUserId.toString());
          setRole("client");
        }
      } catch (error) {
        console.error("❌ Error initializing user:", error);
        setUserIdState(`client-${Math.random().toString(36).substring(7)}`);
        setRole("client");
      } finally {
        setIsLoading(false);
      }
    };

    initializeUser();
  }, []);

  const userId = userIdState || (role === "admin" 
    ? "admin1" 
    : `${role}-${Math.random().toString(36).substring(7)}`);

  const value: UserContextType = {
    userId,
    role,
    setRole,
    isLoading,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}
