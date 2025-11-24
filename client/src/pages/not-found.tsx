import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-destructive/10 rounded-full p-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">404</h1>
          <p className="text-muted-foreground">Сторінка не знайдена</p>
        </div>
        <Button
          className="w-full"
          onClick={() => setLocation("/")}
          data-testid="button-home"
        >
          Повернутися на головну
        </Button>
      </div>
    </div>
  );
}
