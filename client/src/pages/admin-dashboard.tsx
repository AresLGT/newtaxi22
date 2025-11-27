import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, Car, RefreshCw, 
  ArrowLeft, Settings, Star, Megaphone, Wallet, Coins
} from "lucide-react";
import type { User, Order, AccessCode, Rating } from "@shared/schema";

type AdminView = "menu" | "overview" | "dispatcher" | "drivers" | "finance" | "tariffs" | "reviews" | "broadcast";

// Словник для перекладу тарифів
const tariffNames: Record<string, string> = {
  taxi: "Таксі",
  cargo: "Вантажне",
  courier: "Кур'єр",
  towing: "Евакуатор"
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<AdminView>("menu");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  
  // Стан для введення суми поповнення (ID водія -> Сума)
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});

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
      toast({ title: "Код: " + data.code });
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
      // Очистити поля вводу після успіху
      setAmountInputs({});
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
    { id: "overview", title: "Генерація кодів", desc: "Доступ для нових", icon: Settings, color: "text-slate-500", bg: "bg-slate-500/10" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {currentView !== "menu" && (
            <Button variant="ghost" size="icon" onClick={() => setCurrentView("menu")}>
              <ArrowLeft className="w-6 h-6" />
            </Button>
          )}
          <h1 className="text-lg font-bold">
            {currentView === "menu" ? "Адмін Панель" : menuItems.find(i => i.id === currentView)?.title}
          </h1>
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

        {/* ТАРИФИ (ПЕРЕКЛАД) */}
        {currentView === "tariffs" && (
          <div className="space-y-4">
            {tariffs.map((t) => (
              <Card key={t.type}>
                <CardHeader className="pb-2">
                  <CardTitle className="capitalize flex items-center gap-2">
                    {tariffNames[t.type] || t.type}
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">{t.type}</Badge>
                  </CardTitle>
                </CardHeader>
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

        {/* ФІНАНСИ (РУЧНИЙ ВВІД) */}
        {currentView === "finance" && (
          <div className="space-y-3">
            {drivers.length === 0 ? <div className="text-center text-muted-foreground">Немає водіїв</div> : drivers.map((driver) => (
              <Card key={driver.id}>
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold">{driver.name || "Без імені"}</div>
                      <div className="text-xs text-muted-foreground">ID: {driver.id}</div>
                    </div>
                    <div className="text-2xl font-mono font-bold text-green-600">{driver.balance || 0} ₴</div>
                  </div>
                  
                  <div className="flex gap-2 items-center pt-2 border-t mt-1">
                    <Input 
                      type="number" 
                      placeholder="Сума (напр. 200 або -50)" 
                      value={amountInputs[driver.id] || ""}
                      onChange={(e) => setAmountInputs({...amountInputs, [driver.id]: e.target.value})}
                      className="h-10 text-lg"
                    />
                    <Button 
                      onClick={() => {
                        const val = parseInt(amountInputs[driver.id]);
                        if (val) updateBalanceMutation.mutate({ userId: driver.id, amount: val });
                      }}
                      disabled={!amountInputs[driver.id]}
                    >
                      Оновити
                    </Button>
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
                  
                  <div className="text-sm flex items-center gap-2">
                    {order.from} <span className="text-muted-foreground">→</span> {order.to}
                  </div>

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
        {(currentView === "drivers" || currentView === "overview") && (
          <div className="space-y-4">
             {currentView === "overview" && (
               <Button onClick={() => generateCodeMutation.mutate()} className="w-full h-12"><RefreshCw className="mr-2 h-4 w-4" /> Згенерувати код</Button>
             )}
             {generatedCode && <div className="p-4 bg-muted rounded text-center font-mono text-2xl font-bold">{generatedCode}</div>}
             
             {currentView === "drivers" && drivers.map((d) => (
               <div key={d.id} className="flex justify-between p-4 border rounded bg-card">
                 <span>{d.name}</span>
                 <Button size="sm" variant={d.isBlocked ? "destructive" : "secondary"} onClick={() => blockDriverMutation.mutate(d.id)}>{d.isBlocked ? "Розблокувати" : "Блок"}</Button>
               </div>
             ))}
          </div>
        )}

      </div>
    </div>
  );
}