import { useState, useEffect, useRef } from "react";
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
  DollarSign,
  Phone
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/use-user";
import { RatingDialog } from "@/components/rating-dialog";
import type { Order, User as UserType } from "@shared/schema";

export default function ClientHome() {
  const [, setLocation] = useLocation();
  const { userId } = useUser();
  const queryClient = useQueryClient();
  
  const [ratingDialog, setRatingDialog] = useState<{
    open: boolean;
    orderId: string;
    driverName?: string;
  }>({ open: false, orderId: "" });

  const prevOrdersRef = useRef<Record<string, string>>({});

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/client", userId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/client/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 3000, 
  });

  useEffect(() => {
    orders.forEach(order => {
      const prevStatus = prevOrdersRef.current[order.orderId];
      if (prevStatus && prevStatus !== "completed" && order.status === "completed") {
        setRatingDialog({
          open: true,
          orderId: order.orderId,
          driverName: "Водія"
        });
      }
      prevOrdersRef.current[order.orderId] = order.status;
    });
  }, [orders]);

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

  completedOrders.sort((a, b) => {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  return (
    <div className="min-h-screen bg-background">
      
      {/* ШАПКА З КНОПКОЮ ПРОФІЛЮ */}
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">UniWay</h1>
            <p className="text-xs text-muted-foreground">Ваше комфортне таксі</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/client/profile")}
          >
            <User className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="text-center space-y-2 pt-2">
          <h2 className="text-2xl font-bold text-foreground">Мої замовлення</h2>
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
                    <Card key={order.orderId} className="border-primary/50 border">
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
                          <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded">
                            <DollarSign className="w-4 h-4 text-primary" />
                            <span className="font-bold text-lg">{order.price} грн</span>
                            {order.distanceKm && (
                              <span className="text-muted-foreground text-xs ml-auto">
                                {order.distanceKm.toFixed(1)} км
                              </span>
                            )}
                          </div>
                        )}

                        <Separator />

                        {order.status === "pending" && (
                          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg animate-pulse">
                            <Clock className="w-5 h-5" />
                            <span className="text-sm font-medium">Шукаємо водія...</span>
                          </div>
                        )}

                        {(order.status === "accepted" || order.status === "in_progress") && order.driverId && (
                          <DriverInfoSection 
                            driverId={order.driverId} 
                            orderId={order.orderId} 
                            setLocation={setLocation} 
                            isInProgress={order.status === "in_progress"}
                          />
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
                                  month: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="text-muted-foreground truncate max-w-[150px]">
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

function DriverInfoSection({ 
  driverId, 
  orderId, 
  setLocation, 
  isInProgress 
}: { 
  driverId: string; 
  orderId: string; 
  setLocation: (path: string) => void;
  isInProgress: boolean;
}) {
  const { data: driver, isLoading } = useQuery<UserType>({
    queryKey: [`/api/users/${driverId}`],
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm bg-primary/10 p-3 rounded-lg">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        <span>Завантаження інформації про водія...</span>
      </div>
    );
  }

  const getCleanPhone = (phone: string) => {
    return phone.replace(/[^\d+]/g, '');
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary rounded-full p-2 text-primary-foreground">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-base">
              {isInProgress ? "Виконується поїздка" : "Водій прямує до вас"}
            </div>
            {driver?.name && (
              <div className="text-sm text-muted-foreground">
                {driver.name}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          {driver?.phone && (
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              asChild
            >
              <a href={`tel:${getCleanPhone(driver.phone)}`}>
                <Phone className="w-4 h-4 mr-2" />
                Дзвонити
              </a>
            </Button>
          )}
          
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setLocation(`/chat/${orderId}`)}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Чат
          </Button>
        </div>
      </div>
      
      {isInProgress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>В дорозі</span>
            <span>Прибуття скоро</span>
          </div>
          <Progress value={66} className="h-1.5" />
        </div>
      )}
    </div>
  );
}