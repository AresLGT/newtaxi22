import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Navigation, DollarSign, Lock, User, Plus, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/use-user";
import type { Order } from "@shared/schema";

const orderTypeLabels = {
  taxi: "Таксі",
  cargo: "Вантажне",
  courier: "Кур'єр",
  towing: "Евакуатор",
};

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { userId: driverId } = useUser();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [bidPrice, setBidPrice] = useState("");
  const [showBidModal, setShowBidModal] = useState(false);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/active"],
    refetchInterval: 3000,
  });

  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest("POST", `/api/orders/${orderId}/accept`, { driverId });
    },
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active"] });
      setSelectedOrder(updatedOrder);
      setShowBidModal(true);
      setBidPrice("");
    },
    onError: () => {
      toast({
        title: "Помилка",
        description: "Не вдалося прийняти замовлення",
        variant: "destructive",
      });
    },
  });

  const proposeBidMutation = useMutation({
    mutationFn: async ({ orderId, price }: { orderId: string; price: number }) => {
      return await apiRequest("POST", `/api/orders/${orderId}/bid`, {
        driverId,
        price,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/active"] });
      toast({
        title: "Ціну запропоновано",
        description: "Очікуйте відповіді від клієнта",
      });
      setShowBidModal(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({
        title: "Помилка",
        description: "Не вдалося запропонувати ціну",
        variant: "destructive",
      });
    },
  });

  const handleAcceptOrder = (order: Order) => {
    acceptOrderMutation.mutate(order.orderId);
  };

  const handleSubmitBid = () => {
    if (selectedOrder && bidPrice) {
      proposeBidMutation.mutate({
        orderId: selectedOrder.orderId,
        price: Number(bidPrice),
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
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
                className={`border-card-border ${order.isTaken && order.driverId !== driverId ? "opacity-60" : ""}`}
                data-testid={`card-order-${order.orderId}`}
              >
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                      {orderTypeLabels[order.type]}
                    </Badge>
                    {order.isTaken && order.driverId !== driverId && (
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs gap-1">
                        <Lock className="w-3 h-3" />
                        Зайнято
                      </Badge>
                    )}
                    {order.status === "bidding" && order.driverId === driverId && (
                      <Badge variant="default" className="rounded-full px-3 py-1 text-xs">
                        Очікування відповіді
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
                  {!order.isTaken ? (
                    <Button
                      className="w-full h-12 font-semibold"
                      onClick={() => handleAcceptOrder(order)}
                      data-testid={`button-accept-${order.orderId}`}
                      disabled={acceptOrderMutation.isPending}
                    >
                      {acceptOrderMutation.isPending ? "Обробка..." : "Прийняти замовлення"}
                    </Button>
                  ) : order.driverId === driverId ? (
                    <Button
                      className="w-full h-12"
                      variant="outline"
                      disabled
                    >
                      Ваше замовлення - очікуйте відповіді
                    </Button>
                  ) : (
                    <Button
                      className="w-full h-12"
                      variant="secondary"
                      disabled
                    >
                      Зайнято іншим водієм
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showBidModal} onOpenChange={setShowBidModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Запропонувати ціну</DialogTitle>
            <DialogDescription>
              Вкажіть вашу ціну для замовлення
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price">Ціна (грн) *</Label>
              <Input
                id="price"
                type="number"
                placeholder="0"
                value={bidPrice}
                onChange={(e) => setBidPrice(e.target.value)}
                data-testid="input-bid-price"
                className="text-base h-12"
              />
            </div>
            <Button
              className="w-full h-12"
              onClick={handleSubmitBid}
              disabled={!bidPrice || proposeBidMutation.isPending}
              data-testid="button-submit-bid"
            >
              {proposeBidMutation.isPending ? "Відправка..." : "Відправити пропозицію"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
