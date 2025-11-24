import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Key } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/use-user";

const registerSchema = z.object({
  code: z.string().min(5, "Вкажіть код доступу"),
  name: z.string().min(2, "Ім'я має містити мінімум 2 символи"),
  phone: z.string().min(10, "Вкажіть коректний номер телефону"),
});

export default function DriverRegister() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { userId, setRole } = useUser();

  const registerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof registerSchema>) => {
      return await apiRequest("POST", "/api/users/register-driver", {
        userId,
        ...data,
      });
    },
    onSuccess: () => {
      setRole("driver");
      toast({
        title: "Успіх",
        description: "Ви зареєстровані як водій!",
      });
      setLocation("/driver");
    },
    onError: () => {
      toast({
        title: "Помилка",
        description: "Неправильний код доступу або дані",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      code: "",
      name: "",
      phone: "",
    },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Реєстрація водія</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <Card className="border-card-border">
          <CardHeader className="space-y-1">
            <CardTitle>Введіть дані для реєстрації</CardTitle>
            <CardDescription>Адміністратор повинен надати вам код доступу</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-primary" />
                        Код доступу *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Вкажіть код від адміна"
                          {...field}
                          data-testid="input-access-code"
                          className="text-base h-12 font-mono tracking-widest"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                  data-testid="button-register"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Реєстрація..." : "Зареєструватися"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
