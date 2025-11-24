import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Truck, Package, Unplug } from "lucide-react";
import { useLocation } from "wouter";

export default function ClientHome() {
  const [, setLocation] = useLocation();

  const orderTypes = [
    {
      type: "taxi" as const,
      icon: Car,
      label: "Таксі",
      description: "Поїздки по місту",
      color: "bg-primary text-primary-foreground",
    },
    {
      type: "cargo" as const,
      icon: Truck,
      label: "Вантажне",
      description: "Перевезення вантажу",
      color: "bg-primary text-primary-foreground",
    },
    {
      type: "courier" as const,
      icon: Package,
      label: "Кур'єр",
      description: "Доставка посилок",
      color: "bg-primary text-primary-foreground",
    },
    {
      type: "towing" as const,
      icon: Unplug,
      label: "Евакуатор",
      description: "Буксирування авто",
      color: "bg-primary text-primary-foreground",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2 py-6">
          <h1 className="text-2xl font-bold text-foreground">Виберіть тип замовлення</h1>
          <p className="text-sm text-muted-foreground">Оберіть послугу, яка вам потрібна</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {orderTypes.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.type}
                className="overflow-hidden hover-elevate active-elevate-2 cursor-pointer border-card-border"
                onClick={() => setLocation(`/order/${item.type}`)}
                data-testid={`button-order-${item.type}`}
              >
                <div className="h-32 p-4 flex flex-col items-center justify-center space-y-3">
                  <div className={`${item.color} rounded-xl p-3`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-lg font-semibold">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
