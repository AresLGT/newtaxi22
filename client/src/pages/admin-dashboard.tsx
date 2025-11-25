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
  Users, Car, Ban, RefreshCw, Activity, 
  XCircle, ArrowLeft, Settings, Star, Megaphone, Wallet, Coins, User, Shield, Trash2, Archive, MessageCircle, Key
} from "lucide-react";
import type { User as UserType, Order, AccessCode, Rating } from "@shared/schema";

type AdminView = "menu" | "overview" | "dispatcher" | "drivers" | "clients" | "archive" | "support" | "finance" | "tariffs" | "reviews" | "broadcast" | "settings";

const TARIFF_NAMES: Record<string, string> = {
  taxi: "🚕 Таксі (Легкове)",
  cargo: "🚚 Вантажне",
  courier: "📦 Кур'єр",
  towing: "🪝 Евакуатор"
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<AdminView>("menu");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");

  // DATA
  const { data: drivers = [] } = useQuery<UserType[]>({ queryKey: ["/api/admin/drivers"] });
  const { data: clients = [] } = useQuery<UserType[]>({ queryKey: ["/api/admin/clients"] });
  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ["/api/admin/orders/all"], refetchInterval: 3000 });
  const { data: reviews = [] } = useQuery<Rating[]>({ queryKey: ["/api/admin/reviews"] });
  const { data: tariffs = [] } = useQuery<any[]>({ queryKey: ["/api/admin/tariffs"] });
  const { data: supportTickets = [] } = useQuery<any[]>({ queryKey: ["/api/admin/support"], refetchInterval: 5000 });

  // MUTATIONS
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
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/admin/tariffs", data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] }); toast({ title: "Збережено" }); },
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string, amount: number }) => { await apiRequest("POST", "/api/admin/finance/update", { userId, amount }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] }); toast({ title: "Баланс оновлено" }); },
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/admin/broadcast", { message: broadcastMsg }); },
    onSuccess: () => { setBroadcastMsg(""); toast({ title: "Надіслано" }); },
  });

  const blockUserMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/admin/drivers/${id}/block`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] }); }
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => { await apiRequest("POST", `/api/admin/orders/${orderId}/cancel`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/orders/all"] }); toast({ title: "Скасовано" }); }
  });

  const resolveTicketMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/admin/support/${id}/resolve`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/support"] }); toast({ title: "Вирішено" }); }
  });

  const cleanupKeyboardMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/admin/cleanup-keyboard", { userId: "7677921905" }); },
    onSuccess: () => { toast({ title: "Успішно" }); }
  });

  // STATS
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'accepted' || o.status === 'in_progress');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.price || 0), 0);

  const menuItems = [
    { id: "dispatcher", title: "Диспетчерська", desc: "Активні замовлення", icon: Car, color: "text-orange-500", bg: "bg-orange-500/10" },
    { id: "settings", title: "Генерація кодів", desc: "Доступ та інтерфейс", icon: Key, color: "text-slate-800", bg: "bg-slate-200" }, // ВИПРАВЛЕНО
    { id: "archive", title: "Архів", desc: "Історія поїздок", icon: Archive, color: "text-gray-500", bg: "bg-gray-500/10" },
    { id: "clients", title: "Клієнти", desc: "База пасажирів", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { id: "drivers", title: "Водії", desc: "Керування штатом", icon: Car, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { id: "support", title: "Підтримка", desc: "Повідомлення", icon: MessageCircle, color: "text-pink-500", bg: "bg-pink-500/10" },
    { id: "tariffs", title: "Тарифи", desc: "Ціни за км", icon: Coins, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { id: "finance", title: "Фінанси", desc: "Баланс водіїв", icon: Wallet, color: "text-green-500", bg: "bg-green-500/10" },
    { id: "reviews", title: "Відгуки", desc: "Оцінки клієнтів", icon: Star, color: "text-purple-500", bg: "bg-purple-500/10" },
    { id: "broadcast", title: "Розсилка", desc: "Повідомлення всім", icon: Megaphone, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            {currentView !== "menu" && (
              <Button variant="ghost" size="icon" onClick={() => setCurrentView("menu")}><ArrowLeft className="w-6 h-6" /></Button>
            )}
            <h1 className="text-lg font-bold">{currentView === "menu" ? "Адмін Панель" : menuItems.find(i => i.id === currentView)?.title}</h1>
          </div>
          <Button variant="outline" size="sm" className="border-yellow-500 text-yellow-600" onClick={() => setLocation("/driver")}><Car className="w-4 h-4 mr-2" /> Таксувати</Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {currentView === "menu" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-16 border-blue-500/30 hover:bg-blue-500/10 flex flex-col gap-1" onClick={() => setLocation("/client")}><User className="w-6 h-6 text-blue-500" /><span className="font-bold">Я Клієнт</span></Button>
              <Button variant="outline" className="h-16 border-yellow-500/30 hover:bg-yellow-500/10 flex flex-col gap-1" onClick={() => setLocation("/driver")}><Car className="w-6 h-6 text-yellow-500" /><span className="font-bold">Я Водій</span></Button>
            </div>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex justify-between items-center"><div className="text-sm text-muted-foreground">Оборот:</div><div className="text-2xl font-bold text-primary">{totalRevenue} ₴</div></div>
              <div className="mt-2 flex gap-4 text-sm text-muted-foreground"><div>Активних: <span className="font-bold text-blue-500">{activeOrders.length}</span></div><div>Підтримка: <span className="font-bold text-pink-500">{supportTickets.length}</span></div></div>
            </div>
            <div className="grid gap-3">
              {menuItems.map((item) => (
                <Card key={item.id} className="cursor-pointer hover:bg-accent/50 transition-all border-primary/20" onClick={() => setCurrentView(item.id as AdminView)}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={`p-3 rounded-full ${item.bg}`}><item.icon className={`w-6 h-6 ${item.color}`} /></div>
                    <div className="flex-1"><div className="font-bold text-lg">{item.title}</div><div className="text-sm text-muted-foreground">{item.desc}</div></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {currentView === "settings" && (
           <div className="space-y-4">
             {/* БЛОК ГЕНЕРАЦІЇ КОДІВ */}
             <Card>
               <CardHeader><CardTitle>Реєстрація водіїв</CardTitle><CardDescription>Згенеруйте одноразовий код для нового водія</CardDescription></CardHeader>
               <CardContent>
                 <Button onClick={() => generateCodeMutation.mutate()} className="w-full h-12 text-lg"><RefreshCw className="mr-2 h-5 w-5" /> Згенерувати код</Button>
                 {generatedCode && <div className="mt-4 p-4 bg-muted rounded text-center font-mono text-3xl font-bold select-all border-2 border-primary">{generatedCode}</div>}
               </CardContent>
             </Card>
             
             {/* БЛОК ВИДАЛЕННЯ КНОПОК */}
             <Card className="border-red-200/50">
                <CardHeader><CardTitle className="text-red-500">Технічне обслуговування</CardTitle></CardHeader>
                <CardContent>
                  <Button variant="destructive" className="w-full bg-red-600 hover:bg-red-700" onClick={() => cleanupKeyboardMutation.mutate()} disabled={cleanupKeyboardMutation.isPending}>
                    <Trash2 className="mr-2 h-4 w-4" /> Видалити старі кнопки в чаті
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">Натисніть, якщо в Телеграмі "залипли" кнопки "Я водій / Я клієнт"</p>
                </CardContent>
             </Card>
           </div>
        )}

        {currentView === "clients" && (
          <div className="space-y-3">
            {clients.length === 0 ? <div className="text-center text-muted-foreground py-8">Клієнтів немає</div> : clients.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div><div className="font-bold">{c.name}</div><div className="text-xs text-muted-foreground">{c.phone}</div></div>
                  <Button size="sm" variant={c.isBlocked ? "default" : "secondary"} onClick={() => blockUserMutation.mutate(c.id)}>{c.isBlocked ? "Розблокувати" : "Заблокувати"}</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {currentView === "drivers" && (
          <div className="space-y-3">
             {drivers.map((d) => (
               <div key={d.id} className="flex justify-between p-4 border rounded bg-card items-center">
                 <div><div className="font-bold">{d.name}</div><div className="text-xs text-muted-foreground">{d.phone}</div></div>
                 <Button size="sm" variant={d.isBlocked ? "destructive" : "secondary"} onClick={() => blockDriverMutation.mutate(d.id)}>{d.isBlocked ? "Розблокувати" : "Блок"}</Button>
               </div>
             ))}
          </div>
        )}

        {currentView === "archive" && (
          <div className="space-y-3">
            {completedOrders.length === 0 ? <div className="text-center text-muted-foreground py-8">Архів порожній</div> : completedOrders.slice(0, 50).map((o) => (
              <Card key={o.orderId} className="opacity-80">
                <CardContent className="p-4 space-y-1">
                   <div className="flex justify-between text-sm font-bold"><span>{new Date(o.createdAt!).toLocaleDateString()}</span><span>{o.price} ₴</span></div>
                   <div className="text-sm">{o.from} <span className="text-muted-foreground">→</span> {o.to}</div>
                   <div className="text-xs text-muted-foreground">Клієнт: {o.clientId} | Водій: {o.driverId}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {currentView === "support" && (
          <div className="space-y-3">
             {supportTickets.length === 0 ? <div className="text-center text-muted-foreground py-8">Повідомлень немає</div> : supportTickets.map((t) => (
               <Card key={t.id}>
                 <CardContent className="p-4 space-y-2">
                   <div className="flex justify-between"><div className="font-bold">{t.userName}</div><div className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleTimeString()}</div></div>
                   <p className="bg-muted p-2 rounded text-sm">{t.message}</p>
                   <div className="flex justify-between items-center mt-2">
                     <a href={`tel:${t.userPhone}`} className="text-xs text-blue-500 underline">{t.userPhone}</a>
                     <Button size="sm" onClick={() => resolveTicketMutation.mutate(t.id)}>Вирішено</Button>
                   </div>
                 </CardContent>
               </Card>
             ))}
          </div>
        )}

        {currentView === "dispatcher" && (
          <div className="space-y-4">
            {orders.length === 0 ? <div className="text-center text-muted-foreground py-8">Пусто</div> : orders.map((order) => (
              <Card key={order.orderId} className="overflow-hidden">
                <div className={`h-1 w-full ${order.status==='pending'?'bg-yellow-500':'bg-green-500'}`} />
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between"><Badge variant="outline">#{order.orderId.slice(0,6)}</Badge><Badge>{order.status}</Badge></div>
                  <div className="text-sm flex items-center gap-2">{order.from} <span className="text-muted-foreground">→</span> {order.to}</div>
                  {(order.status==='pending'||order.status==='accepted') && <Button variant="destructive" size="sm" className="w-full" onClick={() => cancelOrderMutation.mutate(order.orderId)}>Скасувати</Button>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {currentView === "tariffs" && (
          <div className="space-y-4">
            {tariffs.map((t) => (
              <Card key={t.type}>
                <CardHeader className="pb-2"><CardTitle className="text-xl">{TARIFF_NAMES[t.type] || t.type}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div><div className="text-xs mb-1">Базова (грн)</div><Input type="number" defaultValue={t.basePrice} onBlur={(e) => updateTariffMutation.mutate({ ...t, basePrice: +e.target.value })} /></div>
                  <div><div className="text-xs mb-1">За км (грн)</div><Input type="number" defaultValue={t.perKm} onBlur={(e) => updateTariffMutation.mutate({ ...t, perKm: +e.target.value })} /></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {currentView === "finance" && (
          <div className="space-y-3">
            {drivers.map((driver) => (
              <Card key={driver.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div><div className="font-bold">{driver.name}</div><div className="text-2xl font-mono text-green-600">{driver.balance || 0} ₴</div></div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateBalanceMutation.mutate({ userId: driver.id, amount: -50 })}>-50</Button>
                    <Button size="sm" variant="outline" onClick={() => updateBalanceMutation.mutate({ userId: driver.id, amount: 100 })}>+100</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {currentView === "broadcast" && (
          <Card>
            <CardHeader><CardTitle>Надіслати повідомлення</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="Текст повідомлення..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} className="min-h-[100px]" />
              <Button className="w-full" onClick={() => broadcastMutation.mutate()} disabled={!broadcastMsg}>Надіслати всім</Button>
            </CardContent>
          </Card>
        )}

        {currentView === "reviews" && (
          <div className="space-y-3">
            {reviews.length === 0 ? <div className="text-center py-8 text-muted-foreground">Відгуків ще немає</div> : reviews.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex text-yellow-500">{[...Array(r.stars)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}</div>
                    <span className="text-xs text-muted-foreground">{new Date(r.createdAt!).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm italic">"{r.comment || "Без коментаря"}"</p>
                  <div className="text-xs text-muted-foreground">Замовлення #{r.orderId.slice(0,6)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}