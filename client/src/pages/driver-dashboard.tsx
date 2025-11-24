import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MapPin, Navigation, DollarSign, User, Plus, ArrowLeft, Calculator } from "lucide-react";
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

  // Защита маршруту - тільки водії можуть тут бути
  useEffect(() => {
    if (role !== "driver") {
      setLocation("/");
    }
  }, [role, setLocation]);
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/active"],
    refetchInterval: 3000,
  });

  const distanceForm = useForm<z.infer<typeof distanceSchema>>({
    resolver: zodResolver(distanceSchema),
    defaultValues: {
      distanceKm: 0,
    },
  });

  const acceptOrderMutation = useMutation({
    mutationFn: async ({ orderId, distanceKm }: { orderId: string; distanceKm?: number }) => {
      return await apiRequest("POST", `/api/orders/${orderId}/accept`, { driverId, distanceKm });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active"] });
      toast({
        title: "Замовлення прийнято",
        description: "Клієнт буде повідомлений про прийняття замовлення",
      });
      setDistanceDialog(false);
      setSelectedOrder(null);
      distanceForm.reset();
    },
    onError: () => {
      toast({
        title: "Помилка",
        description: "Не вдалося прийняти замовлення",
        variant: "destructive",
      });
    },
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

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
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
              <User className="w-5 h-5" />
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
          Викликати таксі для себе
        </Button>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-card-border">
                <CardHeader className="space-y-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
              <MapPin className="w-8 h-8 text-muted-foreground opacity-40" />
            </div>
            <p className="text-base text-muted-foreground">Немає активних замовлень</p>
            <p className="text-sm text-muted-foreground mt-1">Нові замовлення з'являться тут</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Card
                key={order.orderId}
                className="border-card-border"
                data-testid={`card-order-${order.orderId}`}
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
                    {order.distanceKm && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Відстань:</span> {order.distanceKm} км
                      </div>
                    )}
                  </div>
                  {order.requiredDetail && (
                    <div className="text-sm bg-muted rounded-lg p-3">
                      <span className="font-medium">Деталі:</span> {order.requiredDetail}
                    </div>
                  )}
                  {order.comment && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Коментар:</span> {order.comment}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    className="w-full h-12 font-semibold"
                    onClick={() => handleAcceptOrder(order)}
                    data-testid={`button-accept-${order.orderId}`}
                    disabled={acceptOrderMutation.isPending}
                  >
                    {acceptOrderMutation.isPending ? "Обробка..." : "Прийняти замовлення"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Distance Dialog */}
      <Dialog open={distanceDialog} onOpenChange={setDistanceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Калькулятор вартості замовлення
            </DialogTitle>
            <DialogDescription>
              Вкажіть відстань та переглядьте розрахунок ціни
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && tariff && (
            <div className="space-y-4">
              {/* Тариф */}
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <div className="text-sm font-semibold text-foreground">Тариф</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Базова ціна:</span>
                    <span className="text-sm font-bold text-foreground">{tariff.basePrice} грн</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">За кілометр:</span>
                    <span className="text-sm font-bold text-foreground">{tariff.perKm} гривень</span>
                  </div>
                </div>
              </div>

              {/* Адреси */}
              <div className="space-y-2 px-1">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-0.5">Забрати</div>
                    <div className="text-sm font-medium">{selectedOrder.from}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Navigation className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-0.5">Куди</div>
                    <div className="text-sm font-medium">{selectedOrder.to}</div>
                  </div>
                </div>
              </div>

              <Form {...distanceForm}>
                <form onSubmit={distanceForm.handleSubmit(handleSubmitDistance)} className="space-y-4">
                  {/* Відстань */}
                  <FormField
                    control={distanceForm.control}
                    name="distanceKm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-primary" />
                          Відстань (км) *
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Наприклад: 120.39"
                            {...field}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              field.onChange(value);
                            }}
                            data-testid="input-distance-driver"
                            className="text-base h-12 font-semibold"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Орієнтовна вартість */}
                  {estimatedPrice > 0 && (
                    <div className="p-4 bg-primary rounded-lg">
                      <div className="text-xs text-primary-foreground/80 mb-2">Орієнтовна вартість</div>
                      <div className="text-3xl font-bold text-primary-foreground mb-2">{estimatedPrice} грн</div>
                      <div className="text-xs text-primary-foreground/70 space-y-0.5">
                        <div>{tariff.basePrice} грн (базова ціна)</div>
                        <div>{watchedDistance.toFixed(2)} км × {tariff.perKm} грн/км = {Math.ceil(watchedDistance * tariff.perKm)} грн</div>
                        <div className="pt-1 border-t border-primary-foreground/20 mt-1">
                          Всього: {tariff.basePrice} грн + {Math.ceil(watchedDistance * tariff.perKm)} грн = {estimatedPrice} грн
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 font-semibold"
                    data-testid="button-submit-distance"
                    disabled={acceptOrderMutation.isPending || watchedDistance <= 0}
                  >
                    {acceptOrderMutation.isPending ? "Обробка..." : "Підтвердити та прийняти"}
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
