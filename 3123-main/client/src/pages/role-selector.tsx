import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Car, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { useUser } from "@/lib/use-user";
import type { UserRole } from "@shared/schema";

type RoleWithPath = { role: UserRole; icon: React.ComponentType<{ className?: string }>; label: string; description: string; color: string; path: string }

export default function RoleSelector() {
  const [, setLocation] = useLocation();
  const { setRole } = useUser();

  const roles: RoleWithPath[] = [
    {
      role: "client",
      icon: User,
      label: "Клієнт",
      description: "Замовити таксі",
      color: "bg-primary text-primary-foreground",
      path: "/",
    },
    {
      role: "driver",
      icon: Car,
      label: "Водій",
      description: "Приймати замовлення",
      color: "bg-primary text-primary-foreground",
      path: "/driver",
    },
  ];

  const handleRoleSelect = (role: UserRole, path: string) => {
    setRole(role);
    setLocation(path);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Таксі-Сервіс</h1>
          <p className="text-muted-foreground">Оберіть вашу роль</p>
        </div>

        <div className="space-y-3">
          {roles.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.role}
                className="overflow-hidden hover-elevate active-elevate-2 cursor-pointer border-card-border"
                onClick={() => handleRoleSelect(item.role, item.path)}
                data-testid={`button-role-${item.role}`}
              >
                <div className="p-4 flex items-center gap-4">
                  <div className={`${item.color} rounded-xl p-3 flex-shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="text-center space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/admin-login")}
            data-testid="button-admin-access"
            className="w-full"
          >
            Доступ для адміністратора
          </Button>
          <p className="text-xs text-muted-foreground">
            Telegram Web App • Версія 1.0
          </p>
        </div>
      </div>
    </div>
  );
}
