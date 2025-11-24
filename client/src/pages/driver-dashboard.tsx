import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MapPin, Navigation, DollarSign, User, Plus, Calculator, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/use-user";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TARIFFS, calculatePrice, type TariffKey } from "@shared/tariffs";
import type { Order } from "@shared/schema";

const orderTypeLabels = {
  taxi: "Таксі",
  cargo: "Вантажне",
  courier: "Кур'єр",
  towing: "Евакуатор",
};

const orderTypeToTariff: Record<string, TariffKey> = {
  taxi: 'Таксі 🚕',
  cargo: 'Вантажний 🚚',
  courier: 'Кур\'єр 📦',
  towing: 'Буксир 🪝',
};

const distanceSchema = z.object({
  distanceKm: z.number().min(0.1, "Вкажіть відстань"),
});

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { userId: driverId, role } = useUser();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [distanceDialog, setDistanceDialog] = useState(false);

  // Защита маршруту
  useEffect(() => {
    if (role !== "driver") {
      setLocation("/");
    }
  }, [role, setLocation]);

  // 1. Отримуємо загальний список активних замовлень
  const { data: activeOrders = [], isLoading: isLoadingActive } = useQuery<Order[]>({
    queryKey: ["/api/orders/active"],
    refetchInterval: 3000,
  });

  // 2. Отримуємо поточне замовлення водія
  const { data: currentOrders = [], isLoading: isLoadingCurrent } = useQuery<Order[]>({
    queryKey: [`/api/orders/driver/${driverId}/current`],
    enabled: !!driverId,
    refetchInterval: 2000,
  });

  const currentOrder = currentOrders[0];

  const distanceForm = useForm<z.infer<typeof distanceSchema>>({
    resolver: zodResolver(distanceSchema),
    defaultValues: {
      distanceKm: 0,
    },
  });

  const acceptOrderMutation = useMutation({
    mutationFn: async ({ orderId, distanceKm }: { orderId: string; distanceKm?: number }) => {
      if (!driverId) throw new Error("Driver ID not available");
      
      const response = await apiRequest("POST", `/api/orders/${orderId}/accept`, { 
        driverId, 
        distanceKm: distanceKm && distanceKm > 0 ? distanceKm : undefined
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active"] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/driver/${driverId}/current`] });
      
      toast({
        title: "Замовлення прийнято!",
        description: "Переходимо до режиму виконання.",
      });
      setDistanceDialog(false);
      setSelectedOrder(null);
      distanceForm.reset();
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Не вдалося прийняти замовлення";
      toast({ title: "Помилка", description: errorMessage, variant: "destructive" });
    },
  });

  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiRequest("POST", `/api/orders/${orderId}/complete`);
      if (!response.ok) throw new Error("Failed to complete order");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/driver/${driverId}/current`] });
      toast({ title: "Поїздку завершено!", description: "Можна брати нові замовлення." });
    },
    onError: () => {
      toast({ title: "Помилка", description: "Не вдалося завершити замовлення", variant: "destructive" });
    }
  });

  const handleAcceptOrder = (order: Order) => {
    setSelectedOrder(order);
    setDistanceDialog(true);
    distanceForm.reset();
  };

  const handleSubmitDistance = (data: z.infer<typeof distanceSchema>) => {
    if (selectedOrder) {
      acceptOrderMutation.mutate({
        orderId: selectedOrder.orderId,
        distanceKm: data.distanceKm,
      });
    }
  };

  const watchedDistance = distanceForm.watch("distanceKm");
  const tariffKey = selectedOrder ? orderTypeToTariff[selectedOrder.type] : null;
  const tariff = tariffKey ? TARIFFS[tariffKey] : null;
  const estimatedPrice = watchedDistance > 0 && tariff ? calculatePrice(tariffKey as TariffKey, watchedDistance) : 0;

  // --- ВІДОБРАЖЕННЯ: АКТИВНА ПОЇЗДКА ---
  if (currentOrder) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md border-primary border-2 shadow-lg">
          <CardHeader className="bg-primary/10 pb-4">
            <div className="flex justify-between items-center mb-2">
               <Badge className="bg-green-600 hover:bg-green-700 text-white animate-pulse">
                 В роботі
               </Badge>
               <span className="font-bold text-lg">{currentOrder.price} грн</span>
            </div>
            <CardTitle className="text-xl">Поточне замовлення</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <MapPin className="w-5 h-5 text-primary" />
                  <div className="w-0.5 h-full bg-border my-1" />
                  <Navigation className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Забрати клієнта:</p>
                    <p className="font-medium text-lg leading-tight">{currentOrder.from}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Відвезти до:</p>
                    <p className="font-medium text-lg leading-tight">{currentOrder.to}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
               <div className="flex justify-between">
                 <span>Дистанція:</span>
                 <span className="font-medium">{currentOrder.distanceKm} км</span>
               </div>
               {currentOrder.comment && (
                 <div className="pt-2 border-t border-border mt-2">
                   <p className="text-muted-foreground text-xs">Коментар:</p>
                   <p>{currentOrder.comment}</p>
                 </div>
               )}
            </div>

            <Button 
              className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
              onClick={() => completeOrderMutation.mutate(currentOrder.orderId)}
              disabled={completeOrderMutation.isPending}
            >
              {completeOrderMutation.isPending ? "Завершення..." : "Завершити поїздку"}
              <CheckCircle2 className="ml-2 w-6 h-6" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- ВІДОБРАЖЕННЯ: СПИСОК ---
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Кнопка "Назад" видалена */}
            <div className="flex-1">
              <h1 className="text-lg font-semibold">Активні замовлення</h1>
              <p className="text-xs text-muted-foreground">Виберіть замовлення для роботи</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/driver/profile")}
              data-testid="button-profile"
            >
              <User className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Button
          className="w-full"
          variant="outline"
          onClick={() => setLocation("/")}
          data-testid="button-create-order-as-client"
        >
          <Plus className="w-4 h-4 mr-2" />
          Створити замовлення (як клієнт)
        </Button>

        {isLoadingActive ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-card-border">
                <CardHeader className="space-y-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
              <MapPin className="w-8 h-8 text-muted-foreground opacity-40" />
            </div>
            <p className="text-base text-muted-foreground">Немає нових замовлень</p>
            <p className="text-sm text-muted-foreground mt-1">Очікуйте...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <Card
                key={order.orderId}
                className="border-card-border"
              >
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                      {orderTypeLabels[order.type]}
                    </Badge>
                    {order.price && (
                      <Badge variant="default" className="rounded-full px-3 py-1 text-xs gap-1">
                        <DollarSign className="w-3 h-3" />
                        {order.price} грн
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="text-sm flex-1">
                        <span className="font-medium">Звідки:</span> {order.from}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="text-sm flex-1">
                        <span className="font-medium">Куди:</span> {order.to}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    className="w-full h-12 font-semibold"
                    onClick={() => handleAcceptOrder(order)}
                    disabled={acceptOrderMutation.isPending}
                  >
                    Прийняти замовлення
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={distanceDialog} onOpenChange={setDistanceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Розрахунок вартості
            </DialogTitle>
            <DialogDescription>
              Підтвердіть відстань для розрахунку точної ціни
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && tariff && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Подача:</span>
                    <span className="font-bold">{tariff.basePrice} грн</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Тариф:</span>
                    <span className="font-bold">{tariff.perKm} грн/км</span>
                  </div>
                </div>
              </div>

              <Form {...distanceForm}>
                <form onSubmit={distanceForm.handleSubmit(handleSubmitDistance)} className="space-y-4">
                  <FormField
                    control={distanceForm.control}
                    name="distanceKm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дистанція (км)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="Наприклад: 15.5"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="text-lg h-12"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {estimatedPrice > 0 && (
                    <div className="p-4 bg-primary rounded-lg text-primary-foreground">
                      <div className="text-sm opacity-90">Разом до сплати:</div>
                      <div className="text-3xl font-bold">{estimatedPrice} грн</div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 font-bold text-lg"
                    disabled={acceptOrderMutation.isPending || watchedDistance <= 0}
                  >
                    {acceptOrderMutation.isPending ? "Обробка..." : "ПІДТВЕРДИТИ"}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}