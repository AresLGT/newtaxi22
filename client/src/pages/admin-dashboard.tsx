import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Car, 
  Ban, 
  CheckCircle, 
  RefreshCw, 
  Key,
  Activity,
  MapPin,
  XCircle,
  DollarSign
} from "lucide-react";
import type { User, Order, AccessCode } from "@shared/schema";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // 1. Завантаження даних
  const { data: drivers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/drivers"],
  });

  const { data: orders = [], isLoading: isOrdersLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders/all"],
    refetchInterval: 3000, // Живе оновлення кожні 3 сек
  });

  // --- МУТАЦІЇ (Дії адміна) ---

  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/generate-code", {
        adminId: "admin1", 
      });
      return await res.json();
    },
    onSuccess: (data: AccessCode) => {
      setGeneratedCode(data.code);
      toast({ title: "Код згенеровано", description: data.code });
    },
  });

  const blockDriverMutation = useMutation({
    mutationFn: async (driverId: string) => {
      await apiRequest("POST", `/api/admin/drivers/${driverId}/block`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      toast({ title: "Статус водія змінено" });
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("POST", `/api/admin/orders/${orderId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders/all"] });
      toast({ title: "Замовлення скасовано" });
    },
  });

  // --- СТАТИСТИКА ---
  const totalOrders = orders.length;
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'accepted' || o.status === 'in_progress');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.price || 0), 0);

  return (
    <div className="min-h-screen bg-background p-4 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Адмін Панель</h1>
          <p className="text-muted-foreground">Керування службою UniWay</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="h-8 px-3 text-sm">
            {activeOrders.length} замовлень в ефірі
          </Badge>
        </div>
      </div>

      {/* Вкладки */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-12">
          <TabsTrigger value="overview">Огляд</TabsTrigger>
          <TabsTrigger value="dispatcher">Диспетчер</TabsTrigger>
          <TabsTrigger value="drivers">Водії</TabsTrigger>
          <TabsTrigger value="settings">Налаштування</TabsTrigger>
        </TabsList>

        {/* Вкладка 1: ОГЛЯД (Статистика) */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Всього замовлень</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Активні зараз</CardTitle>
                <Car className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">{activeOrders.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Водіїв в базі</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{drivers.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Оборот (прибл.)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{totalRevenue} ₴</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Вкладка 2: ДИСПЕТЧЕРСЬКА (Керування замовленнями) */}
        <TabsContent value="dispatcher" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Моніторинг замовлень</CardTitle>
              <CardDescription>Список усіх активних та завершених поїздок</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Замовлень поки немає</div>
                ) : (
                  orders.map((order) => (
                    <div key={order.orderId} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                      <div className="space-y-1 mb-2 md:mb-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            order.status === 'pending' ? 'secondary' :
                            order.status === 'accepted' || order.status === 'in_progress' ? 'default' :
                            order.status === 'completed' ? 'outline' : 'destructive'
                          }>
                            {order.status.toUpperCase()}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">#{order.orderId.slice(0,6)}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(order.createdAt!).toLocaleString('uk-UA')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm mt-1">
                          <MapPin className="w-3 h-3 text-green-500" /> {order.from} 
                          <span className="text-muted-foreground">→</span>
                          <MapPin className="w-3 h-3 text-red-500" /> {order.to}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Клієнт ID: {order.clientId} | Водій: {order.driverId || "Не призначено"}
                        </div>
                      </div>
                      
                      {/* Кнопки дій для активних замовлень */}
                      {(order.status === 'pending' || order.status === 'accepted') && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => cancelOrderMutation.mutate(order.orderId)}
                          disabled={cancelOrderMutation.isPending}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Скасувати
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка 3: ВОДІЇ */}
        <TabsContent value="drivers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Керування водіями</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {drivers.map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${driver.isBlocked ? "bg-red-500" : "bg-green-500"}`} />
                      <div>
                        <div className="font-medium">{driver.name}</div>
                        <div className="text-sm text-muted-foreground">{driver.phone}</div>
                      </div>
                    </div>
                    <Button
                      variant={driver.isBlocked ? "default" : "secondary"}
                      size="sm"
                      onClick={() => blockDriverMutation.mutate(driver.id)}
                    >
                      {driver.isBlocked ? (
                        <><CheckCircle className="w-4 h-4 mr-2" /> Розблокувати</>
                      ) : (
                        <><Ban className="w-4 h-4 mr-2" /> Заблокувати</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка 4: НАЛАШТУВАННЯ (Коди) */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Реєстрація водіїв</CardTitle>
              <CardDescription>Згенеруйте код доступу для нового водія</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => generateCodeMutation.mutate()} 
                  disabled={generateCodeMutation.isPending}
                  className="w-full md:w-auto"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${generateCodeMutation.isPending ? 'animate-spin' : ''}`} />
                  Згенерувати новий код
                </Button>
              </div>
              
              {generatedCode && (
                <div className="p-4 bg-muted rounded-lg border border-primary/20 flex flex-col items-center animate-in fade-in">
                  <div className="text-sm text-muted-foreground mb-1">Код доступу:</div>
                  <div className="text-3xl font-mono font-bold tracking-widest text-primary select-all">
                    {generatedCode}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Передайте цей код водію для реєстрації
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}