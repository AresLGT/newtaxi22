import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, MapPin, Navigation } from "lucide-react";
import { useLocation } from "wouter";
import { insertOrderSchema, type OrderType } from "@shared/schema";
import { TARIFFS, calculatePrice, type TariffKey } from "@shared/tariffs";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/use-user";
import { useState } from "react";

const orderTypeToTariff: Record<OrderType, TariffKey> = {
  taxi: 'Таксі 🚕',
  cargo: 'Вантажний 🚚',
  courier: 'Кур\'єр 📦',
  towing: 'Буксир 🪝',
};

const orderTypeConfig = {
  taxi: {
    title: "Замовлення таксі",
    description: "Вкажіть адреси початку та кінця поїздки",
    requiredLabel: null,
    requiredPlaceholder: null,
  },
  cargo: {
    title: "Вантажне таксі",
    description: "Вкажіть адреси та опис вантажу",
    requiredLabel: "Опис вантажу *",
    requiredPlaceholder: "Наприклад: Меблі, коробки 2х2м, вага ~50кг",
  },
  courier: {
    title: "Кур'єр",
    description: "Вкажіть адреси та що потрібно доставити",
    requiredLabel: "Що доставити *",
    requiredPlaceholder: "Наприклад: Документи, посилка, їжа",
  },
  towing: {
    title: "Евакуатор",
    description: "Вкажіть адреси та тип автомобіля",
    requiredLabel: "Тип автомобіля *",
    requiredPlaceholder: "Наприклад: Легковий седан, позашляховик",
  },
};

export default function OrderForm({ params }: { params: { type: string } }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { userId } = useUser();
  const orderType = params.type as OrderType;
  const config = orderTypeConfig[orderType];
  const tariffKey = orderTypeToTariff[orderType];
  const tariff = TARIFFS[tariffKey];
  
  const formSchema = insertOrderSchema.extend({
    from: z.string().min(3, "Вкажіть адресу початку"),
    to: z.string().min(3, "Вкажіть адресу призначення"),
    requiredDetail: config.requiredLabel 
      ? z.string().min(2, `${config.requiredLabel.replace(" *", "")} обов'язкове`)
      : z.string().optional(),
    comment: z.string().optional(),
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return await apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      toast({
        title: "Замовлення створено",
        description: "Очікуйте на пропозиції від водіїв",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/client", userId] });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Помилка",
        description: "Не вдалося створити замовлення",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: orderType,
      from: "",
      to: "",
      requiredDetail: "",
      comment: "",
      clientId: userId,
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createOrderMutation.mutate(data);
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
            <h1 className="text-lg font-semibold">{config.title}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <Card className="border-card-border">
          <CardHeader className="space-y-1">
            <CardTitle>{config.title}</CardTitle>
            <CardDescription>{config.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="from"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        Звідки *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Вкажіть адресу початку"
                          {...field}
                          data-testid="input-from"
                          className="text-base h-12"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-primary" />
                        Куди *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Вкажіть адресу призначення"
                          {...field}
                          data-testid="input-to"
                          className="text-base h-12"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                {config.requiredLabel && (
                  <FormField
                    control={form.control}
                    name="requiredDetail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{config.requiredLabel}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={config.requiredPlaceholder || ""}
                            {...field}
                            data-testid="input-required-detail"
                            className="text-base h-12"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Коментар (опціонально)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Додаткові деталі замовлення"
                          {...field}
                          data-testid="input-comment"
                          className="resize-none text-base min-h-24"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-semibold"
                  data-testid="button-submit-order"
                  disabled={createOrderMutation.isPending}
                >
                  {createOrderMutation.isPending ? "Створення..." : "Створити замовлення"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
