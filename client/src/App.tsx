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
import OrderForm from "@/pages/order-form";
import DriverRegister from "@/pages/driver-register";
import DriverDashboard from "@/pages/driver-dashboard";
import DriverProfile from "@/pages/driver-profile";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import ChatPage from "@/pages/chat-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ClientHome} />
      <Route path="/role-selector" component={RoleSelector} />
      <Route path="/client" component={ClientHome} />
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
  const { role, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading) {
      // Redirect to appropriate dashboard based on role
      if (role === "admin" && location !== "/admin") {
        setLocation("/admin");
      } else if (role === "driver" && location !== "/driver") {
        setLocation("/driver");
      } else if (role === "client" && (location === "/" || location === "/role-selector")) {
        setLocation("/client");
      }
    }
  }, [role, isLoading, location, setLocation]);

  // Show loading while determining user role
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
