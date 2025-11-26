import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Car } from "lucide-react";
import { useLocation } from "wouter";
import { useUser } from "@/lib/use-user";
import type { UserRole } from "@shared/schema";

type RoleWithPath = { role: UserRole; icon: React.ComponentType<{ className?: string }>; label: string; description: string; color: string; path: string }

export default function RoleSelector() {
  const [, setLocation] = useLocation();
  
  // Просто переходимо за посиланням, роль змінює сервер/код
  const handleRoleSelect = (path: string) => {
    setLocation(path);
  };

  const roles: RoleWithPath[] = [
    {
      role: "client",
      icon: User,
      label: "Клієнт",
      description: "Замовити таксі",
      color: "bg-blue-500/10 text-blue-500",
      path: "/client",
    },
    {
      role: "driver",
      icon: Car,
      label: "Водій",
      description: "Вхід для водіїв",
      color: "bg-yellow-500/10 text-yellow-600",
      path: "/driver", // Ведемо відразу в кабінет (App.tsx перевірить права)
    },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">UniWay</h1>
          <p className="text-muted-foreground">Оберіть режим входу</p>
        </div>

        <div className="space-y-3">
          {roles.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.role}
                className="overflow-hidden cursor-pointer border-primary/20 hover:bg-accent/50 transition-colors"
                onClick={() => handleRoleSelect(item.path)}
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
        
        <div className="text-center text-xs text-muted-foreground">
          v1.0 • Офіційний бот
        </div>
      </div>
    </div>
  );
}