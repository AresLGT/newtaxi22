import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useUser } from "@/lib/use-user";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield } from "lucide-react";

const ADMIN_PASSWORD = "admin123";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { setRole } = useUser();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    if (password === ADMIN_PASSWORD) {
      setRole("admin");
      toast({
        title: "Успіх",
        description: "Ви увійшли як адміністратор",
      });
      setLocation("/admin");
    } else {
      toast({
        title: "Помилка",
        description: "Неправильний пароль",
        variant: "destructive",
      });
      setPassword("");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/role-selector")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>

        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="bg-primary text-primary-foreground rounded-xl p-4">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">Адміністратор</h1>
          <p className="text-muted-foreground">Введіть пароль для входу</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                data-testid="input-admin-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-admin-login"
            >
              {isLoading ? "Вхід..." : "Увійти"}
            </Button>
          </form>
        </Card>

        <div className="text-center text-xs text-muted-foreground pt-4 space-y-1">
          <p>Пароль: admin123</p>
          <p className="text-xs text-muted-foreground/70">
            (У продакшені пароль зберігатиметься безпечно на сервері)
          </p>
        </div>
      </div>
    </div>
  );
}
