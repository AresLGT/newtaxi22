import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { UserProvider } from "./lib/user-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import RoleSelector from "@/pages/role-selector";
import ClientHome from "@/pages/client-home";
import OrderForm from "@/pages/order-form";
import DriverDashboard from "@/pages/driver-dashboard";
import DriverProfile from "@/pages/driver-profile";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import ChatPage from "@/pages/chat-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/role-selector" component={RoleSelector} />
      <Route path="/" component={ClientHome} />
      <Route path="/order/:type" component={OrderForm} />
      <Route path="/driver" component={DriverDashboard} />
      <Route path="/driver/profile" component={DriverProfile} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/chat/:orderId" component={ChatPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}
