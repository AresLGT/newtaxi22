import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Car, 
  Truck, 
  Package, 
  Unplug, 
  Clock, 
  User, 
  MessageSquare, 
  Star,
  MapPin,
  DollarSign
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/use-user";
import { RatingDialog } from "@/components/rating-dialog";
import type { Order } from "@shared/schema";

export default function ClientHome() {
  const [, setLocation] = useLocation();
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [ratingDialog, setRatingDialog] = useState<{
    open: boolean;
    orderId: string;
    driverName?: string;
  }>({ open: false, orderId: "" });

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/client", userId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/client/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 3000, // Оновлювати кожні 3 секунди
  });

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

  const getOrderTypeLabel = (type: string) => {
    const orderType = orderTypes.find(ot => ot.type === type);
    return orderType?.label || type;
  };

  const getOrderTypeIcon = (type: string) => {
    const orderType = orderTypes.find(ot => ot.type === type);
    return orderType?.icon || Car;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Очікування", variant: "secondary" as const },
      accepted: { label: "Прийнято", variant: "default" as const },
      in_progress: { label: "В дорозі", variant: "default" as const },
      completed: { label: "Завершено", variant: "outline" as const },
      cancelled: { label: "Скасовано", variant: "destructive" as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleRateDriver = (orderId: string, driverName?: string) => {
    setRatingDialog({ open: true, orderId, driverName });
  };

  const handleRatingSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/client", userId] });
  };

  const activeOrders = orders.filter(o => 
    o.status === "pending" || o.status === "accepted" || o.status === "in_progress"
  );
  
  const completedOrders = orders.filter(o => 
    o.status === "completed" || o.status === "cancelled"
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2 py-6">
          <h1 className="text-2xl font-bold text-foreground">Мої замовлення</h1>
          <p className="text-sm text-muted-foreground">Керуйте вашими поїздками</p>
        </div>

        {/* Create New Order Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Створити нове замовлення</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {orderTypes.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.type}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-2"
                    onClick={() => setLocation(`/order/${item.type}`)}
                  >
                    <div className={`${item.color} rounded-lg p-2`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                Завантаження замовлень...
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Active Orders */}
            {activeOrders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Активні замовлення</h2>
                {activeOrders.map((order) => {
                  const Icon = getOrderTypeIcon(order.type);
                  
                  return (
                    <Card key={order.orderId}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 rounded-lg p-2">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-semibold">{getOrderTypeLabel(order.type)}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(order.createdAt!).toLocaleString('uk-UA', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="font-medium">Звідки:</div>
                              <div className="text-muted-foreground">{order.from}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="font-medium">Куди:</div>
                              <div className="text-muted-foreground">{order.to}</div>
                            </div>
                          </div>
                        </div>

                        {order.price && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold">{order.price} грн</span>
                            {order.distanceKm && (
                              <span className="text-muted-foreground">
                                • {order.distanceKm.toFixed(1)} км
                              </span>
                            )}
                          </div>
                        )}

                        <Separator />

                        {/* Status-specific UI */}
                        {order.status === "pending" && (
                          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                            <Clock className="w-5 h-5 animate-pulse" />
                            <span className="text-sm font-medium">Очікування водія...</span>
                          </div>
                        )}

                        {order.status === "accepted" && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm bg-primary/10 p-3 rounded-lg">
                              <User className="w-5 h-5 text-primary" />
                              <div>
                                <div className="font-medium">Водій знайдено</div>
                                <div className="text-xs text-muted-foreground">
                                  Очікуйте на підтвердження початку поїздки
                                </div>
                              </div>
                            </div>
                            <Button
                              className="w-full"
                              onClick={() => setLocation(`/chat/${order.orderId}`)}
                            >
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Перейти до чату
                            </Button>
                          </div>
                        )}

                        {order.status === "in_progress" && (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">Виконується поїздка</span>
                                <span className="text-muted-foreground">В дорозі...</span>
                              </div>
                              <Progress value={66} className="h-2" />
                            </div>
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={() => setLocation(`/chat/${order.orderId}`)}
                            >
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Перейти до чату
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Completed Orders */}
            {completedOrders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Завершені замовлення</h2>
                {completedOrders.slice(0, 5).map((order) => {
                  const Icon = getOrderTypeIcon(order.type);
                  
                  return (
                    <Card key={order.orderId} className="opacity-75">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-muted rounded-lg p-2">
                              <Icon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-semibold">{getOrderTypeLabel(order.type)}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(order.createdAt!).toLocaleString('uk-UA', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="text-muted-foreground">
                            {order.from} → {order.to}
                          </div>
                          {order.price && (
                            <div className="font-semibold">{order.price} грн</div>
                          )}
                        </div>

                        {order.status === "completed" && (
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => handleRateDriver(order.orderId, "водія")}
                          >
                            <Star className="w-4 h-4 mr-2" />
                            Оцінити водія
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {activeOrders.length === 0 && completedOrders.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-muted-foreground space-y-2">
                    <p className="text-lg font-medium">У вас ще немає замовлень</p>
                    <p className="text-sm">Створіть своє перше замовлення вище</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <RatingDialog
        open={ratingDialog.open}
        onOpenChange={(open) => setRatingDialog({ ...ratingDialog, open })}
        orderId={ratingDialog.orderId}
        driverName={ratingDialog.driverName}
        onSuccess={handleRatingSuccess}
      />
    </div>
  );
}
