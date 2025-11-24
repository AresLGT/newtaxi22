import { useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  driverName?: string;
  onSuccess?: () => void;
}

export function RatingDialog({
  open,
  onOpenChange,
  orderId,
  driverName = "водія",
  onSuccess,
}: RatingDialogProps) {
  const [stars, setStars] = useState(5);
  const [hoveredStars, setHoveredStars] = useState(0);
  const [comment, setComment] = useState("");

  const ratingMutation = useMutation({
    mutationFn: async (data: { stars: number; comment?: string }) => {
      const response = await fetch(`/api/orders/${orderId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to submit rating");
      }

      return response.json();
    },
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
      setStars(5);
      setComment("");
    },
  });

  const handleSubmit = () => {
    ratingMutation.mutate({
      stars,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Оцініть водія</DialogTitle>
          <DialogDescription>
            Як вам сподобалась поїздка з {driverName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setStars(star)}
                onMouseEnter={() => setHoveredStars(star)}
                onMouseLeave={() => setHoveredStars(0)}
                className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              >
                <Star
                  className={`w-10 h-10 ${
                    star <= (hoveredStars || stars)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="text-center text-sm text-muted-foreground">
            {stars === 1 && "Погано"}
            {stars === 2 && "Незадовільно"}
            {stars === 3 && "Нормально"}
            {stars === 4 && "Добре"}
            {stars === 5 && "Відмінно"}
          </div>

          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              Коментар (опціонально)
            </label>
            <Textarea
              id="comment"
              placeholder="Розкажіть про ваш досвід..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={ratingMutation.isPending}
          >
            Скасувати
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={ratingMutation.isPending}
          >
            {ratingMutation.isPending ? "Відправка..." : "Відправити оцінку"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
