import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { UserProvider } from "./lib/user-provider";
import { useUser } from "./lib/use-user";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import RoleSelector from "@/pages/role-selector";
import ClientHome from "@/pages/client-home";
import ClientRegister from "@/pages/client-register";
import ClientProfile from "@/pages/client-profile";
import OrderForm from "@/pages/order-form";
import DriverRegister from "@/pages/driver-register";
import DriverDashboard from "@/pages/driver-dashboard";
import DriverProfile from "@/pages/driver-profile";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import ChatPage from "@/pages/chat-page";
import PreviewPage from "@/pages/preview";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ClientHome} />
      <Route path="/preview" component={PreviewPage} />
      <Route path="/role-selector" component={RoleSelector} />
      
      <Route path="/client" component={ClientHome} />
      <Route path="/client-register" component={ClientRegister} />
      <Route path="/client/profile" component={ClientProfile} />
      
      <Route path="/order/:type" component={OrderForm} />
      <Route path="/driver-register" component={DriverRegister} />
      <Route path="/driver" component={DriverDashboard} />
      <Route path="/driver/profile" component={DriverProfile} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/chat/:orderId" component={ChatPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppWrapper() {
  const [location, setLocation] = useLocation();
  const { user, role, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading && user) {
      
      // --- 1. ПРАВИЛА ДЛЯ АДМІНА (МАКСИМАЛЬНА СВОБОДА) ---
      if (role === "admin") {
        // Тільки якщо адмін на сторінці вибору ролі або логіна - направляємо в панель
        if (location === "/role-selector" || location === "/admin-login") {
          setLocation("/admin");
        }
        // У всіх інших випадках (/driver, /client, /admin) - НІЧОГО НЕ РОБИМО.
        // Адмін має право бути де завгодно.
        return; 
      }

      // --- 2. ПРАВИЛА ДЛЯ КЛІЄНТА ---
      if (role === "client") {
        // Немає телефону -> на реєстрацію
        if (!user.phone && location !== "/client-register" && location !== "/role-selector") {
          setLocation("/client-register");
          return;
        }
        // Є телефон і стоїть на вході -> в кабінет
        if ((location === "/" || location === "/role-selector") && user.phone) {
          setLocation("/client");
        }
      }

      // --- 3. ПРАВИЛА ДЛЯ ВОДІЯ ---
      if (role === "driver") {
        if (location === "/role-selector" || location === "/") {
          setLocation("/driver");
        }
      }
    }
  }, [user, role, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-secondary-foreground">Завантаження...</p>
        </div>
      </div>
    );
  }

  return <Router />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <Toaster />
          <AppWrapper />
        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}