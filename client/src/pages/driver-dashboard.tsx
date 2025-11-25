import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MapPin, Navigation, DollarSign, User, Plus, Calculator, CheckCircle2, MessageSquare, Phone, XCircle, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/use-user";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TARIFFS, calculatePrice, type TariffKey } from "@shared/tariffs";
import type { Order, User as UserType } from "@shared/schema";

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
  const [manualActiveOrder, setManualActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (role !== "driver" && role !== "admin") {
      setLocation("/");
    }
  }, [role, setLocation]);

  // 1. Всі активні замовлення
  const { data: rawActiveOrders = [], isLoading: isLoadingActive } = useQuery<Order[]>({
    queryKey: ["/api/orders/active"],
    refetchInterval: 2000,
  });

  // Фільтрація: не показувати свої власні
  const activeOrders = rawActiveOrders.filter(order => order.clientId !== driverId);

  // 2. Поточне замовлення водія
  const { data: currentOrders = [], isLoading: isLoadingCurrent } = useQuery<Order[]>({
    queryKey: [`/api/orders/driver/${driverId}/current`],
    enabled: !!driverId,
    refetchInterval: 1000,
  });

  const currentOrder = currentOrders[0] || manualActiveOrder;

  const distanceForm = useForm<z.infer<typeof distanceSchema>>({
    resolver: zodResolver(distanceSchema),
    defaultValues: {
      distanceKm: 0,
    },
  });

  // МУТАЦІЇ
  const acceptOrderMutation = useMutation({
    mutationFn: async ({ orderId, distanceKm }: { orderId: string; distanceKm?: number }) => {
      if (!driverId) throw new Error("Driver ID not available");
      const response = await apiRequest("POST", `/api/orders/${orderId}/accept`, { 
        driverId, 
        distanceKm: distanceKm && distanceKm > 0 ? distanceKm : undefined
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data as Order;
    },
    onSuccess: (acceptedOrder) => {
      setManualActiveOrder(acceptedOrder);
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

  const releaseOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiRequest("POST", `/api/orders/${orderId}/release`);
      if (!response.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      setManualActiveOrder(null);
      queryClient.invalidateQueries({ queryKey: [`/api/orders/driver/${driverId}/current`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active"] });
      toast({ title: "Ви відмовились", description: "Замовлення повернуто в чергу." });
    },
  });

  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiRequest("POST", `/api/orders/${orderId}/complete`);
      if (!response.ok) throw new Error("Failed to complete order");
      return response.json();
    },
    onSuccess: () => {
      setManualActiveOrder(null);
      queryClient.invalidateQueries({ queryKey: [`/api/orders/driver/${driverId}/current`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active"] });
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
        <Card className="w-full max-w-md border-primary border-2 shadow-lg animate-in fade-in zoom-in duration-300">
          <CardHeader className="bg-primary/10 pb-4 relative">
            
            {/* КНОПКА ВІДМОВИ */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-100"
              onClick={() => {
                if (confirm("Ви дійсно хочете відмовитись від цього замовлення?")) {
                  releaseOrderMutation.mutate(currentOrder.orderId);
                }
              }}
            >
              <XCircle className="w-5 h-5 mr-1" /> Відмовитись
            </Button>

            <div className="flex justify-between items-center mb-2 mt-4">
               <Badge className="bg-green-600 hover:bg-green-700 text-white animate-pulse px-3 py-1 text-sm">
                 🟢 В РОБОТІ
               </Badge>
               <span className="font-bold text-xl">{currentOrder.price} грн</span>
            </div>
            <CardTitle className="text-xl text-center pt-2">Маршрут поїздки</CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6 pt-6">
            
            <ClientInfoCard clientId={currentOrder.clientId} />

            <div className="space-y-4">
              <div className="flex gap-4 items-stretch">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
                  <div className="w-0.5 flex-1 bg-border my-1" />
                  <div className="w-3 h-3 rounded-full bg-red-500 mb-2" />
                </div>
                <div className="space-y-6 flex-1 py-1">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Забрати клієнта:</p>
                    <p className="font-medium text-lg leading-tight mt-1">{currentOrder.from}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Відвезти до:</p>
                    <p className="font-medium text-lg leading-tight mt-1">{currentOrder.to}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-xl space-y-3 text-sm border border-border/50">
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">Дистанція:</span>
                 <span className="font-bold text-foreground text-base">{currentOrder.distanceKm} км</span>
               </div>
               {currentOrder.comment && (
                 <div className="pt-2 border-t border-border mt-2">
                   <p className="text-muted-foreground text-xs mb-1">Коментар клієнта:</p>
                   <p className="italic">{currentOrder.comment}</p>
                 </div>
               )}
            </div>

            <div className="space-y-3 pt-2">
              <Button
                variant="outline"
                className="w-full h-12 text-lg border-primary text-primary hover:bg-primary/5"
                onClick={() => setLocation(`/chat/${currentOrder.orderId}`)}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Чат з клієнтом
              </Button>

              <Button 
                className="w-full h-16 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20 transition-all hover:scale-[1.02]"
                onClick={() => completeOrderMutation.mutate(currentOrder.orderId)}
                disabled={completeOrderMutation.isPending}
              >
                {completeOrderMutation.isPending ? (
                  "Завершення..."
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>ЗАВЕРШИТИ ЗАМОВЛЕННЯ</span>
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                )}
              </Button>
            </div>

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
            <div className="flex-1">
              <h1 className="text-lg font-semibold">Активні замовлення</h1>
              <p className="text-xs text-muted-foreground">Виберіть замовлення для роботи</p>
            </div>
            
            <div className="flex gap-2">
              {role === "admin" && (
                <Button variant="outline" size="icon" onClick={() => setLocation("/admin")} className="border-destructive text-destructive">
                  <Shield className="w-5 h-5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setLocation("/driver/profile")} data-testid="button-profile">
                <User className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Button
          className="w-full h-12 border-dashed border-2"
          variant="outline"
          onClick={() => setLocation("/")}
          data-testid="button-create-order-as-client"
        >
          <Plus className="w-4 h-4 mr-2" />
          Створити замовлення (як клієнт)
        </Button>

        {isLoadingActive ? (
          <div className="space-y-3">
             {[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-20 h-20 mb-4 rounded-full bg-muted flex items-center justify-center animate-pulse">
              <MapPin className="w-10 h-10 text-muted-foreground opacity-40" />
            </div>
            <p className="text-lg font-medium text-foreground">Немає доступних замовлень</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <Card
                key={order.orderId}
                className="border-card-border hover:border-primary/50 transition-colors"
              >
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                      {orderTypeLabels[order.type]}
                    </Badge>
                    {order.price && (
                      <Badge variant="default" className="rounded-full px-3 py-1 text-xs gap-1 bg-green-600">
                        <DollarSign className="w-3 h-3" />
                        {order.price} грн
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm flex-1">
                        <span className="font-bold block text-muted-foreground text-xs mb-0.5">ЗВІДКИ</span>
                        {order.from}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Navigation className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm flex-1">
                        <span className="font-bold block text-muted-foreground text-xs mb-0.5">КУДИ</span>
                        {order.to}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <Button
                    className="w-full h-12 font-bold text-base"
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
                            className="text-lg h-12 font-bold"
                            autoFocus
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {estimatedPrice > 0 && (
                    <div className="p-4 bg-primary rounded-lg text-primary-foreground animate-in slide-in-from-top-2">
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

function ClientInfoCard({ clientId }: { clientId: string }) {
  const { data: client, isLoading } = useQuery<UserType>({
    queryKey: [`/api/users/${clientId}`],
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;

  return (
    <div className="bg-muted/50 p-3 rounded-lg border border-border flex items-center gap-3">
      <div className="bg-primary/20 p-2.5 rounded-full">
        <User className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-bold uppercase">Клієнт</p>
        <p className="font-bold text-lg truncate">{client?.name || "Невідомий"}</p>
      </div>
      {client?.phone && (
        <Button size="icon" className="rounded-full bg-green-600 hover:bg-green-700 h-10 w-10" asChild>
          <a href={`tel:${client.phone.replace(/[^\d+]/g, '')}`}>
            <Phone className="w-5 h-5 text-white" />
          </a>
        </Button>
      )}
    </div>
  );
}