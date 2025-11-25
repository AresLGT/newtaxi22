// ... (весь код імпортів та функцій залишається без змін) ...
// Я покажу тільки блок return, де додана кнопка в шапці

// ...

  // --- СПИСОК ---
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-lg font-semibold">Активні замовлення</h1>
              <p className="text-xs text-muted-foreground">Виберіть замовлення для роботи</p>
            </div>
            
            <div className="flex gap-2">
              {/* КНОПКА НАЗАД В АДМІНКУ (ТІЛЬКИ ДЛЯ АДМІНА) */}
              {role === "admin" && (
                <Button variant="outline" size="icon" onClick={() => setLocation("/admin")} className="border-destructive text-destructive hover:bg-destructive/10">
                  <Shield className="w-5 h-5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setLocation("/driver/profile")} data-testid="button-profile">
                <User className="w-6 h-6" />
              </Button>
            </div>

          </div>
        </div>
      </div>

// ... (решта коду сторінки без змін) ...