import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Key, Phone, User as UserIcon } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/use-user";

const registerSchema = z.object({
  code: z.string().min(1, "Вкажіть код доступу"), // Зменшив ліміт, щоб не блокувало випадково
  name: z.string().min(2, "Ім'я має містити мінімум 2 символи"),
  phone: z.string().min(10, "Номер телефону занадто короткий (мінімум 10 цифр)"),
});

export default function DriverRegister() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { userId, setRole } = useUser();

  const registerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof registerSchema>) => {
      console.log("🚀 [Frontend] Відправка запиту на сервер...", { userId, ...data });
      
      if (!userId) {
        throw new Error("Помилка: ID користувача не знайдено. Перезавантажте сторінку.");
      }

      // Явно вказуємо userId, хоча сервер може брати його з сесії
      return await apiRequest("POST", "/api/users/register-driver", {
        userId: userId,
        code: data.code,
        name: data.name,
        phone: data.phone
      });
    },
    onSuccess: (response) => {
      console.log("✅ [Frontend] Успішна відповідь:", response);
      setRole("driver");
      toast({
        title: "Вітаємо!",
        description: "Ви зареєстровані як водій. Перенаправлення...",
      });
      // Невелика затримка, щоб користувач побачив повідомлення
      setTimeout(() => setLocation("/driver"), 1000);
    },
    onError: (error: any) => {
      console.error("❌ [Frontend] Помилка запиту:", error);
      toast({
        title: "Помилка реєстрації",
        description: error.message || "Невірний код або помилка сервера",
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
    console.log("📝 [Frontend] Форма пройшла валідацію, починаємо відправку:", data);
    registerMutation.mutate(data);
  };

  // Ця функція спрацює, якщо є помилки у полях
  const onInvalid = (errors: any) => {
    console.log("⚠️ [Frontend] Помилка валідації полів:", errors);
    
    let errorMsg = "Перевірте введені дані";
    if (errors.code) errorMsg = "Введіть код доступу";
    if (errors.phone) errorMsg = "Невірний формат телефону";
    
    toast({
      title: "Перевірте форму",
      description: errorMsg,
      variant: "destructive",
    });
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
            <CardTitle>Анкета водія</CardTitle>
            <CardDescription>Введіть код, який вам надав адміністратор</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Додано onInvalid другим аргументом, щоб ловити помилки */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-primary" />
                        Код доступу (TEST777)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Введіть код"
                          {...field}
                          data-testid="input-access-code"
                          className="text-base h-12 font-mono tracking-widest uppercase"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())} // Авто-капс
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
                      <FormLabel className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4" />
                        Ваше ім'я
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Іван"
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
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Телефон
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+380..."
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
                  className="w-full h-14 text-lg font-semibold mt-4"
                  data-testid="button-register"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Обробка..." : "Стати водієм"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {/* Підказка для тестування */}
        <div className="text-center mt-4 text-xs text-muted-foreground">
           User ID: {userId || "Завантаження..."}
        </div>
      </div>
    </div>
  );
}