import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, Car, Ban, CheckCircle, RefreshCw, Activity, 
  XCircle, ArrowLeft, Settings, Star, Megaphone, Wallet, Coins
} from "lucide-react";
import type { User, Order, AccessCode, Rating } from "@shared/schema";

type AdminView = "menu" | "overview" | "dispatcher" | "drivers" | "finance" | "tariffs" | "reviews" | "broadcast";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<AdminView>("menu");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");

  // --- ЗАВАНТАЖЕННЯ ДАНИХ ---
  const { data: drivers = [] } = useQuery<User[]>({ queryKey: ["/api/admin/drivers"] });
  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ["/api/admin/orders/all"], refetchInterval: 3000 });
  const { data: reviews = [] } = useQuery<Rating[]>({ queryKey: ["/api/admin/reviews"] });
  const { data: tariffs = [] } = useQuery<any[]>({ queryKey: ["/api/admin/tariffs"] });

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

  const updateTariffMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/tariffs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      toast({ title: "Тариф оновлено" });
    },
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string, amount: number }) => {
      await apiRequest("POST", "/api/admin/finance/update", { userId, amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      toast({ title: "Баланс оновлено" });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/broadcast", { message: broadcastMsg });
    },
    onSuccess: () => {
      setBroadcastMsg("");
      toast({ title: "Повідомлення надіслано" });
    },
  });

  const blockDriverMutation = useMutation({
    mutationFn: async (driverId: string) => { await apiRequest("POST", `/api/admin/drivers/${driverId}/block`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] }); }
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => { await apiRequest("POST", `/api/admin/orders/${orderId}/cancel`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/orders/all"] }); }
  });

  // --- СТАТИСТИКА ---
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'accepted' || o.status === 'in_progress');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.price || 0), 0);

  // --- МЕНЮ ---
  const menuItems = [
    { id: "dispatcher", title: "Диспетчерська", desc: "Активні замовлення", icon: Car, color: "text-orange-500", bg: "bg-orange-500/10" },
    { id: "tariffs", title: "Тарифи", desc: "Ціни за км", icon: Coins, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { id: "finance", title: "Фінанси", desc: "Баланс водіїв", icon: Wallet, color: "text-green-500", bg: "bg-green-500/10" },
    { id: "reviews", title: "Відгуки", desc: "Оцінки клієнтів", icon: Star, color: "text-purple-500", bg: "bg-purple-500/10" },
    { id: "broadcast", title: "Розсилка", desc: "Повідомлення всім", icon: Megaphone, color: "text-blue-500", bg: "bg-blue-500/10" },
    { id: "drivers", title: "Водії", desc: "Керування штатом", icon: Users, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { id: "settings", title: "Генерація кодів", desc: "Доступ для нових", icon: Settings, color: "text-slate-500", bg: "bg-slate-500/10" }
  ];

  return (
    <div className="min-h-screen bg-background">
      
      {/* ШАПКА */}
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            {currentView !== "menu" && (
              <Button variant="ghost" size="icon" onClick={() => setCurrentView("menu")}>
                <ArrowLeft className="w-6 h-6" />
              </Button>
            )}
            <h1 className="text-lg font-bold">
              {currentView === "menu" ? "Адмін Панель" : menuItems.find(i => i.id === currentView)?.title}
            </h1>
          </div>
          
          {/* Кнопка переходу в режим водія для адміна */}
          <Button 
            variant="outline" 
            size="sm" 
            className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
            onClick={() => setLocation("/driver")}
          >
            <Car className="w-4 h-4 mr-2" />
            Таксувати
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* ГОЛОВНЕ МЕНЮ */}
        {currentView === "menu" && (
          <div className="grid gap-3">
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-2">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">Оборот сервісу:</div>
                <div className="text-2xl font-bold text-primary">{totalRevenue} ₴</div>
              </div>
              <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                <div>Активних: <span className="font-bold text-blue-500">{activeOrders.length}</span></div>
                <div>Водіїв: <span className="font-bold text-foreground">{drivers.length}</span></div>
              </div>
            </div>

            {menuItems.map((item) => (
              <Card key={item.id} className="cursor-pointer hover:bg-accent/50 transition-all border-primary/20" onClick={() => setCurrentView(item.id as AdminView)}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`p-3 rounded-full ${item.bg}`}><item.icon className={`w-6 h-6 ${item.color}`} /></div>
                  <div className="flex-1"><div className="font-bold text-lg">{item.title}</div><div className="text-sm text-muted-foreground">{item.desc}</div></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ТАРИФИ */}
        {currentView === "tariffs" && (
          <div className="space-y-4">
            {tariffs.map((t) => (
              <Card key={t.type}>
                <CardHeader className="pb-2"><CardTitle className="capitalize">{t.type}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs mb-1">Базова (грн)</div>
                    <Input type="number" defaultValue={t.basePrice} onBlur={(e) => updateTariffMutation.mutate({ ...t, basePrice: +e.target.value })} />
                  </div>
                  <div>
                    <div className="text-xs mb-1">За км (грн)</div>
                    <Input type="number" defaultValue={t.perKm} onBlur={(e) => updateTariffMutation.mutate({ ...t, perKm: +e.target.value })} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ФІНАНСИ */}
        {currentView === "finance" && (
          <div className="space-y-3">
            {drivers.map((driver) => (
              <Card key={driver.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold">{driver.name}</div>
                    <div className="text-2xl font-mono text-green-600">{driver.balance || 0} ₴</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateBalanceMutation.mutate({ userId: driver.id, amount: -50 })}>-50</Button>
                    <Button size="sm" variant="outline" onClick={() => updateBalanceMutation.mutate({ userId: driver.id, amount: 100 })}>+100</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ДИСПЕТЧЕР */}
        {currentView === "dispatcher" && (
          <div className="space-y-4">
            {orders.length === 0 ? <div className="text-center text-muted-foreground">Пусто</div> : orders.map((order) => (
              <Card key={order.orderId} className="overflow-hidden">
                <div className={`h-1 w-full ${order.status === 'pending' ? 'bg-yellow-500' : order.status === 'completed' ? 'bg-gray-500' : 'bg-green-500'}`} />
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between"><Badge variant="outline">#{order.orderId.slice(0,6)}</Badge><Badge>{order.status}</Badge></div>
                  
                  {/* ВИПРАВЛЕНИЙ РЯДОК: */}
                  <div className="text-sm flex items-center gap-2">
                    {order.from} <span className="text-muted-foreground">→</span> {order.to}
                  </div>

                  <div className="text-xs text-muted-foreground">ID: {order.orderId} | Driver: {order.driverId || "-"}</div>

                  {(order.status === 'pending' || order.status === 'accepted') && (
                    <Button variant="destructive" size="sm" className="w-full" onClick={() => cancelOrderMutation.mutate(order.orderId)}>Скасувати</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* РОЗСИЛКА */}
        {currentView === "broadcast" && (
          <Card>
            <CardHeader><CardTitle>Надіслати повідомлення</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="Текст повідомлення..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} />
              <Button className="w-full" onClick={() => broadcastMutation.mutate()} disabled={!broadcastMsg}>Надіслати всім</Button>
            </CardContent>
          </Card>
        )}

        {/* ВІДГУКИ */}
        {currentView === "reviews" && (
          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex text-yellow-500">{[...Array(r.stars)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}</div>
                  <p className="text-sm italic">"{r.comment || "Без коментаря"}"</p>
                  <div className="text-xs text-muted-foreground">Замовлення #{r.orderId.slice(0,6)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ВОДІЇ ТА ГЕНЕРАЦІЯ */}
        {(currentView === "settings" || currentView === "drivers") && (
          <div className="space-y-4">
             {currentView === "settings" && (
               <Card>
                 <CardHeader><CardTitle>Генерація кодів</CardTitle></CardHeader>
                 <CardContent>
                   <Button onClick={() => generateCodeMutation.mutate()} className="w-full h-12"><RefreshCw className="mr-2 h-4 w-4" /> Згенерувати код</Button>
                   {generatedCode && <div className="mt-4 p-4 bg-muted rounded text-center font-mono text-2xl font-bold select-all">{generatedCode}</div>}
                 </CardContent>
               </Card>
             )}
             
             {currentView === "drivers" && drivers.map((d) => (
               <div key={d.id} className="flex justify-between p-4 border rounded bg-card items-center">
                 <div>
                   <div className="font-bold">{d.name}</div>
                   <div className="text-xs text-muted-foreground">{d.phone}</div>
                 </div>
                 <Button size="sm" variant={d.isBlocked ? "destructive" : "secondary"} onClick={() => blockDriverMutation.mutate(d.id)}>{d.isBlocked ? "Розблокувати" : "Блок"}</Button>
               </div>
             ))}
          </div>
        )}

      </div>
    </div>
  );
}