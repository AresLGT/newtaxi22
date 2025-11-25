import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Car, 
  Ban, 
  CheckCircle, 
  RefreshCw, 
  Activity,
  MapPin,
  XCircle,
  DollarSign,
  ArrowLeft,
  Settings,
  LayoutDashboard
} from "lucide-react";
import type { User, Order, AccessCode } from "@shared/schema";

type AdminView = "menu" | "overview" | "dispatcher" | "drivers" | "settings";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<AdminView>("menu");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // --- ЗАВАНТАЖЕННЯ ДАНИХ ---
  const { data: drivers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/drivers"],
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders/all"],
    refetchInterval: 3000,
  });

  // --- МУТАЦІЇ ---
  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/generate-code", { adminId: "admin1" });
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
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'accepted' || o.status === 'in_progress');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.price || 0), 0);

  // --- МЕНЮ ---
  const menuItems = [
    {
      id: "overview",
      title: "Загальна статистика",
      desc: "Доходи та активність",
      icon: Activity,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      id: "dispatcher",
      title: "Диспетчерська",
      desc: "Керування замовленнями",
      icon: Car,
      color: "text-orange-500",
      bg: "bg-orange-500/10"
    },
    {
      id: "drivers",
      title: "Водії",
      desc: "Блокування та список",
      icon: Users,
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    {
      id: "settings",
      title: "Налаштування",
      desc: "Генерація кодів доступу",
      icon: Settings,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    }
  ];

  // --- РЕНДЕР ---
  return (
    <div className="min-h-screen bg-background">
      
      {/* ШАПКА */}
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {currentView !== "menu" && (
            <Button variant="ghost" size="icon" onClick={() => setCurrentView("menu")}>
              <ArrowLeft className="w-6 h-6" />
            </Button>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              {currentView === "menu" ? "Адмін Панель" : 
               menuItems.find(i => i.id === currentView)?.title}
            </h1>
          </div>
          {activeOrders.length > 0 && (
            <Badge variant="default" className="bg-green-600 animate-pulse">
              {activeOrders.length} в роботі
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* ГОЛОВНЕ МЕНЮ */}
        {currentView === "menu" && (
          <div className="grid gap-4">
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-2">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">Оборот сервісу:</div>
                <div className="text-2xl font-bold text-primary">{totalRevenue} ₴</div>
              </div>
            </div>

            {menuItems.map((item) => (
              <Card 
                key={item.id} 
                className="cursor-pointer hover:bg-accent/50 transition-all border-primary/20"
                onClick={() => setCurrentView(item.id as AdminView)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`p-3 rounded-full ${item.bg}`}>
                    <item.icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg">{item.title}</div>
                    <div className="text-sm text-muted-foreground">{item.desc}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 1. ОГЛЯД */}
        {currentView === "overview" && (
          <div className="grid gap-4 grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Всього замовлень</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{orders.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Активні зараз</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-blue-500">{activeOrders.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Водіїв</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{drivers.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Завершено</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-600">{completedOrders.length}</div></CardContent>
            </Card>
          </div>
        )}

        {/* 2. ДИСПЕТЧЕРСЬКА */}
        {currentView === "dispatcher" && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Список порожній</div>
            ) : (
              orders.map((order) => (
                <Card key={order.orderId} className="overflow-hidden">
                  <div className={`h-1 w-full ${
                    order.status === 'pending' ? 'bg-yellow-500' :
                    order.status === 'accepted' || order.status === 'in_progress' ? 'bg-green-500' :
                    order.status === 'cancelled' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline">#{order.orderId.slice(0,6)}</Badge>
                      <Badge variant={
                        order.status === 'pending' ? 'secondary' :
                        order.status === 'accepted' ? 'default' :
                        order.status === 'cancelled' ? 'destructive' : 'outline'
                      }>
                        {order.status === 'pending' ? 'Пошук' :
                         order.status === 'accepted' ? 'Прийнято' :
                         order.status === 'in_progress' ? 'В дорозі' :
                         order.status === 'completed' ? 'Завершено' : 'Скасовано'}
                      </Badge>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-green-500"/> {order.from}</div>
                      <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-red-500"/> {order.to}</div>
                    </div>

                    <div className="text-xs text-muted-foreground flex justify-between border-t pt-2">
                      <span>Клієнт: {order.clientId}</span>
                      <span>Водій: {order.driverId || "-"}</span>
                    </div>

                    {(order.status === 'pending' || order.status === 'accepted') && (
                      <Button 
                        variant="destructive" 
                        className="w-full mt-2"
                        size="sm"
                        onClick={() => cancelOrderMutation.mutate(order.orderId)}
                        disabled={cancelOrderMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Скасувати замовлення
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* 3. ВОДІЇ */}
        {currentView === "drivers" && (
          <div className="space-y-3">
            {drivers.map((driver) => (
              <Card key={driver.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${driver.isBlocked ? "bg-red-500" : "bg-green-500"}`} />
                    <div>
                      <div className="font-bold">{driver.name}</div>
                      <div className="text-sm text-muted-foreground">{driver.phone}</div>
                    </div>
                  </div>
                  <Button
                    variant={driver.isBlocked ? "default" : "secondary"}
                    size="sm"
                    onClick={() => blockDriverMutation.mutate(driver.id)}
                  >
                    {driver.isBlocked ? "Розблокувати" : "Блок"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 4. НАЛАШТУВАННЯ */}
        {currentView === "settings" && (
          <Card>
            <CardHeader>
              <CardTitle>Реєстрація водіїв</CardTitle>
              <CardDescription>Генерація одноразових кодів</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => generateCodeMutation.mutate()} 
                disabled={generateCodeMutation.isPending}
                className="w-full h-12 text-lg"
              >
                <RefreshCw className={`mr-2 h-5 w-5 ${generateCodeMutation.isPending ? 'animate-spin' : ''}`} />
                Згенерувати код
              </Button>
              
              {generatedCode && (
                <div className="p-6 bg-muted rounded-xl border-2 border-primary border-dashed flex flex-col items-center animate-in zoom-in">
                  <div className="text-sm text-muted-foreground mb-2">Код доступу:</div>
                  <div className="text-4xl font-mono font-bold tracking-widest text-primary select-all">
                    {generatedCode}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}