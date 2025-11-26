import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Car } from "lucide-react";
import { useLocation } from "wouter";
import { useUser } from "@/lib/use-user";

export default function RoleSelector() {
  const [, setLocation] = useLocation();
  const { role } = useUser();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">UniWay</h1>
          <p className="text-muted-foreground">Оберіть режим:</p>
        </div>

        <div className="space-y-4">
          
          {/* Кнопка: Я КЛІЄНТ (Замовити) */}
          <Card 
            className="cursor-pointer border-primary/20 hover:bg-accent/50 transition-all p-6 flex items-center gap-4"
            onClick={() => setLocation("/client")}
          >
            <div className="bg-blue-500/10 text-blue-500 rounded-full p-4">
              <User className="w-8 h-8" />
            </div>
            <div>
              <div className="font-bold text-xl">Я Пасажир</div>
              <div className="text-sm text-muted-foreground">Замовити таксі</div>
            </div>
          </Card>

          {/* Кнопка: Я ВОДІЙ (Працювати) */}
          <Card 
            className="cursor-pointer border-primary/20 hover:bg-accent/50 transition-all p-6 flex items-center gap-4"
            onClick={() => setLocation("/driver")}
          >
            <div className="bg-yellow-500/10 text-yellow-600 rounded-full p-4">
              <Car className="w-8 h-8" />
            </div>
            <div>
              <div className="font-bold text-xl">Я Водій</div>
              <div className="text-sm text-muted-foreground">Вийти на лінію</div>
            </div>
          </Card>

        </div>
        
        <div className="text-center text-xs text-muted-foreground pt-4">
          Ваш статус: <b>{role === 'driver' ? "ВОДІЙ" : "КОРИСТУВАЧ"}</b>
        </div>
      </div>
    </div>
  );
}