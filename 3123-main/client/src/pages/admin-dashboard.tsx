import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Key, Users, Ban, AlertTriangle, Award, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, AccessCode } from "@shared/schema";

const adminId = "admin1";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<User | null>(null);
  const [warningText, setWarningText] = useState("");
  const [bonusText, setBonusText] = useState("");

  const { data: drivers = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/drivers"],
    refetchInterval: 5000,
  });

  const generateCodeMutation = useMutation({
    mutationFn: async (): Promise<AccessCode> => {
      return await apiRequest("POST", "/api/admin/generate-code", { adminId });
    },
    onSuccess: (code: AccessCode) => {
      setGeneratedCode(code.code);
      setShowCodeDialog(true);
      setCopied(false);
      toast({
        title: "Код згенеровано",
        description: `Код доступу: ${code.code}`,
      });
    },
  });

  const blockDriverMutation = useMutation({
    mutationFn: async (driverId: string) => {
      return await apiRequest("POST", `/api/admin/drivers/${driverId}/block`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
    },
  });

  const addWarningMutation = useMutation({
    mutationFn: async ({ driverId, text }: { driverId: string; text: string }) => {
      return await apiRequest("POST", `/api/admin/drivers/${driverId}/warning`, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      toast({
        title: "Попередження видано",
        description: `Попередження додано для ${selectedDriver?.name}`,
      });
      setShowWarningDialog(false);
      setWarningText("");
    },
  });

  const addBonusMutation = useMutation({
    mutationFn: async ({ driverId, text }: { driverId: string; text: string }) => {
      return await apiRequest("POST", `/api/admin/drivers/${driverId}/bonus`, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      toast({
        title: "Бонус видано",
        description: `Бонус додано для ${selectedDriver?.name}`,
      });
      setShowBonusDialog(false);
      setBonusText("");
    },
  });

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Скопійовано",
        description: "Код доступу скопійовано в буфер обміну",
      });
    }
  };

  const handleBlockDriver = (driver: User) => {
    blockDriverMutation.mutate(driver.id);
    toast({
      title: driver.isBlocked ? "Розблоковано" : "Заблоковано",
      description: `Водій ${driver.name} ${driver.isBlocked ? "розблокований" : "заблокований"}`,
    });
  };

  const handleAddWarning = () => {
    if (selectedDriver && warningText) {
      addWarningMutation.mutate({ driverId: selectedDriver.id, text: warningText });
    }
  };

  const handleAddBonus = () => {
    if (selectedDriver && bonusText) {
      addBonusMutation.mutate({ driverId: selectedDriver.id, text: bonusText });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <h1 className="text-lg font-semibold">Панель адміністратора</h1>
          <p className="text-xs text-muted-foreground">Керування водіями та кодами доступу</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <Tabs defaultValue="codes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="codes" data-testid="tab-codes">
              <Key className="w-4 h-4 mr-2" />
              Коди доступу
            </TabsTrigger>
            <TabsTrigger value="drivers" data-testid="tab-drivers">
              <Users className="w-4 h-4 mr-2" />
              Водії
            </TabsTrigger>
          </TabsList>

          <TabsContent value="codes" className="space-y-4">
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle>Генерація коду доступу</CardTitle>
                <CardDescription>
                  Створіть одноразовий код для реєстрації нового водія
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full h-14 text-lg font-semibold"
                  onClick={() => generateCodeMutation.mutate()}
                  disabled={generateCodeMutation.isPending}
                  data-testid="button-generate-code"
                >
                  <Key className="w-5 h-5 mr-2" />
                  {generateCodeMutation.isPending ? "Генерація..." : "Згенерувати код"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers" className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Card key={i} className="border-card-border">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : drivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Users className="w-8 h-8 text-muted-foreground opacity-40" />
                </div>
                <p className="text-base text-muted-foreground">Немає зареєстрованих водіїв</p>
              </div>
            ) : (
              drivers.map((driver) => (
                <Card key={driver.id} className="border-card-border" data-testid={`card-driver-${driver.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-12 h-12 flex-shrink-0">
                        <AvatarImage src={driver.telegramAvatarUrl || ""} alt={driver.name || ""} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {driver.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="font-semibold flex items-center gap-2 flex-wrap">
                            {driver.name}
                            {driver.isBlocked && (
                              <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-xs">
                                <Ban className="w-3 h-3 mr-1" />
                                Заблокований
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{driver.phone}</div>
                        </div>

                        {((driver.warnings?.length ?? 0) > 0 || (driver.bonuses?.length ?? 0) > 0) && (
                          <div className="flex flex-wrap gap-2">
                            {(driver.warnings || []).map((warning, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="rounded-full px-2 py-1 text-xs"
                              >
                                <AlertTriangle className="w-3 h-3 mr-1 text-destructive" />
                                {warning}
                              </Badge>
                            ))}
                            {(driver.bonuses || []).map((bonus, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="rounded-full px-2 py-1 text-xs"
                              >
                                <Award className="w-3 h-3 mr-1 text-primary" />
                                {bonus}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={driver.isBlocked ? "default" : "destructive"}
                            onClick={() => handleBlockDriver(driver)}
                            data-testid={`button-block-${driver.id}`}
                            disabled={blockDriverMutation.isPending}
                          >
                            <Ban className="w-3 h-3 mr-1" />
                            {driver.isBlocked ? "Розблокувати" : "Заблокувати"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDriver(driver);
                              setShowWarningDialog(true);
                            }}
                            data-testid={`button-warning-${driver.id}`}
                          >
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Попередження
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDriver(driver);
                              setShowBonusDialog(true);
                            }}
                            data-testid={`button-bonus-${driver.id}`}
                          >
                            <Award className="w-3 h-3 mr-1" />
                            Бонус
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Код доступу згенеровано</DialogTitle>
            <DialogDescription>
              Передайте цей код новому водію для реєстрації
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-6 text-center">
              <div className="text-3xl font-mono font-bold tracking-wider text-primary">
                {generatedCode}
              </div>
            </div>
            <Button
              className="w-full h-12"
              onClick={handleCopyCode}
              data-testid="button-copy-code"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Скопійовано
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Копіювати код
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Видати попередження</DialogTitle>
            <DialogDescription>
              Додайте попередження для водія {selectedDriver?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="warning-text">Текст попередження</Label>
              <Input
                id="warning-text"
                placeholder="Наприклад: Запізнення на замовлення"
                value={warningText}
                onChange={(e) => setWarningText(e.target.value)}
                data-testid="input-warning-text"
                className="h-12"
              />
            </div>
            <Button
              className="w-full h-12"
              onClick={handleAddWarning}
              disabled={!warningText || addWarningMutation.isPending}
              data-testid="button-submit-warning"
            >
              {addWarningMutation.isPending ? "Обробка..." : "Додати попередження"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBonusDialog} onOpenChange={setShowBonusDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Видати бонус</DialogTitle>
            <DialogDescription>
              Додайте позитивну відмітку для водія {selectedDriver?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bonus-text">Текст бонусу</Label>
              <Input
                id="bonus-text"
                placeholder="Наприклад: Відмінне обслуговування клієнта"
                value={bonusText}
                onChange={(e) => setBonusText(e.target.value)}
                data-testid="input-bonus-text"
                className="h-12"
              />
            </div>
            <Button
              className="w-full h-12"
              onClick={handleAddBonus}
              disabled={!bonusText || addBonusMutation.isPending}
              data-testid="button-submit-bonus"
            >
              {addBonusMutation.isPending ? "Обробка..." : "Додати бонус"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
