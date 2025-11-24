import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import Chat from "@/components/chat";

export default function ChatPage({ params }: { params: { orderId: string } }) {
  const [, setLocation] = useLocation();

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/driver")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="max-w-2xl mx-auto h-full">
          <Chat
            orderId={params.orderId}
            currentUserId="driver1"
            otherUserName="Іван Петренко"
          />
        </div>
      </div>
    </div>
  );
}
