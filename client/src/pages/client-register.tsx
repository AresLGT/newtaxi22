import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/use-user";
import { User, Phone } from "lucide-react";
import type { User as UserType } from "@shared/schema";

// Правила валідації: ім'я мінімум 2 літери, телефон мінімум 10 цифр
const registerSchema = z.object({
  name: z.string().min(2, "Введіть ваше ім'я (мінімум 2 літери)"),
  phone: z.string().min(10, "Введіть коректний номер телефону"),
});

export default function ClientRegister() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { userId } = useUser();

  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof registerSchema>) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}`, data);
      if (!response.ok) throw new Error("Failed");
      return await response.json();
    },
    onSuccess: () => {
      // Оновлюємо дані користувача в пам'яті додатка
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] }); 
      
      toast({
        title: "Чудово!",
        description: "Ваші дані збережено. Тепер ви можете викликати таксі.",
      });
      
      // Перенаправляємо на головну сторінку замовлення
      setLocation("/client"); 
    },
    onError: () => {
      toast({
        title: "Помилка",
        description: "Не вдалося зберегти дані. Спробуйте ще раз.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-lg animate-in zoom-in duration-300">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mb-2">
            <User className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Вітаємо в UniWay!</CardTitle>
          <CardDescription className="text-base">
            Щоб водій міг вас знайти, нам потрібно знати, як до вас звертатись.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Ваше Ім'я</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                        <Input 
                          placeholder="Наприклад: Олександр" 
                          {...field} 
                          className="h-12 text-lg pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Номер телефону</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                        <Input 
                          type="tel" 
                          placeholder="050 123 45 67" 
                          {...field} 
                          className="h-12 text-lg pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? "Збереження..." : "Продовжити"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}