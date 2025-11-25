import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import Chat from "@/components/chat";
import { useUser } from "@/lib/use-user";
import { useQuery } from "@tanstack/react-query";
import type { Order, User } from "@shared/schema";

export default function ChatPage({ params }: { params: { orderId: string } }) {
  const [, setLocation] = useLocation();
  const { userId, role } = useUser();

  // 1. Завантажуємо дані про замовлення
  const { data: order, isLoading: isOrderLoading } = useQuery<Order>({
    queryKey: [`/api/orders/${params.orderId}`],
  });

  // Визначаємо ID співрозмовника
  // Якщо я водій -> співрозмовник це клієнт (clientId)
  // Якщо я клієнт -> співрозмовник це водій (driverId)
  const otherUserId = userId === order?.driverId ? order?.clientId : order?.driverId;

  // 2. Завантажуємо дані співрозмовника
  const { data: otherUser, isLoading: isUserLoading } = useQuery<User>({
    queryKey: [`/api/users/${otherUserId}`],
    enabled: !!otherUserId, // Запит йде тільки якщо ID знайдено
  });

  if (isOrderLoading) {
    return <div className="h-screen flex items-center justify-center">Завантаження чату...</div>;
  }

  // Визначаємо ім'я для відображення
  // Якщо профіль завантажився - беремо ім'я звідти. Якщо ні - пишемо загально.
  const displayOtherName = otherUser?.name || (role === 'driver' ? "Клієнт" : "Водій");

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            // Розумна кнопка назад: клієнта - на головну, водія - в кабінет
            onClick={() => setLocation(role === 'driver' ? '/driver' : '/')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-sm">Чат з {displayOtherName}</h1>
            <p className="text-xs text-muted-foreground">Замовлення #{params.orderId.slice(0, 8)}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="max-w-2xl mx-auto h-full">
          <Chat
            orderId={params.orderId}
            currentUserId={userId || ""} // Передаємо ваш реальний ID
            otherUserName={displayOtherName} // Передаємо реальне ім'я співрозмовника
          />
        </div>
      </div>
    </div>
  );
}