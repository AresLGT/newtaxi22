import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, User } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/use-user";
import type { User as UserType } from "@shared/schema";

const profileSchema = z.object({
  name: z.string().min(2, "Ім'я має містити мінімум 2 символи"),
  phone: z.string().min(10, "Вкажіть коректний номер телефону"),
});

export default function DriverProfile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { userId: driverId } = useUser();

  const { data: user } = useQuery<UserType>({
    queryKey: [`/api/users/${driverId}`],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileSchema>) => {
      return await apiRequest("PATCH", `/api/users/${driverId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${driverId}`] });
      toast({
        title: "Профіль оновлено",
        description: "Зміни успішно збережено",
      });
      setLocation("/driver");
    },
    onError: () => {
      toast({
        title: "Помилка",
        description: "Не вдалося оновити профіль",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
    },
  });

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
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
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Профіль водія</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Налаштування профілю</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Avatar className="w-24 h-24">
                <AvatarImage src={user?.telegramAvatarUrl || ""} alt="Аватар водія" />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  <User className="w-12 h-12" />
                </AvatarFallback>
              </Avatar>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Аватар автоматично завантажується з вашого профілю Telegram
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ім'я *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ваше ім'я"
                          {...field}
                          data-testid="input-name"
                          className="text-base h-12"
                        />
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
                      <FormLabel>Номер телефону *</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+380 XX XXX XX XX"
                          {...field}
                          data-testid="input-phone"
                          className="text-base h-12"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-semibold"
                  data-testid="button-save-profile"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? "Збереження..." : "Зберегти профіль"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
