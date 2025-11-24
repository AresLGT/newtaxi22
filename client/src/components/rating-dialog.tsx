import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  driverName?: string;
  onSuccess?: () => void;
}

const RATING_LABELS = {
  1: "Погано 😡",
  2: "Так собі 😒",
  3: "Нормально 😐",
  4: "Добре 🙂",
  5: "Неймовірно 🤩",
};

export function RatingDialog({ open, onOpenChange, orderId, driverName, onSuccess }: RatingDialogProps) {
  const { toast } = useToast();
  const [stars, setStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");

  const rateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/rate`, {
        stars,
        comment,
      });
      if (!res.ok) throw new Error("Failed to rate");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Дякуємо за оцінку!",
        description: "Ваш відгук допомагає нам ставати кращими.",
      });
      onOpenChange(false);
      onSuccess?.();
      // Скидаємо форму після закриття (з невеликою затримкою)
      setTimeout(() => {
        setStars(0);
        setComment("");
      }, 500);
    },
    onError: () => {
      toast({
        title: "Помилка",
        description: "Не вдалося відправити оцінку. Спробуйте пізніше.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Як пройшла поїздка?</DialogTitle>
          <DialogDescription className="text-center">
            {driverName ? `Оцініть роботу водія ${driverName}` : "Оцініть вашу останню поїздку"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* Зірки */}
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className="transition-transform hover:scale-110 focus:outline-none"
                onMouseEnter={() => setHoveredStar(value)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setStars(value)}
              >
                <Star
                  className={cn(
                    "w-10 h-10 transition-all duration-200",
                    (hoveredStar ? value <= hoveredStar : value <= stars)
                      ? "fill-yellow-400 text-yellow-400 drop-shadow-md"
                      : "text-muted-foreground/30"
                  )}
                />
              </button>
            ))}
          </div>

          {/* Підпис оцінки */}
          <div className="h-6 font-medium text-lg text-primary animate-in fade-in">
            {(hoveredStar || stars) > 0 && 
              RATING_LABELS[(hoveredStar || stars) as keyof typeof RATING_LABELS]}
          </div>

          {/* Коментар */}
          <Textarea
            placeholder="Напишіть коментар (необов'язково)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="resize-none"
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            className="w-full font-bold text-lg h-12" 
            onClick={() => rateMutation.mutate()}
            disabled={stars === 0 || rateMutation.isPending}
          >
            {rateMutation.isPending ? "Відправка..." : "Оцінити"}
          </Button>
          
          <Button
            variant="ghost"
            className="w-full sm:hidden text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Закрити
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}