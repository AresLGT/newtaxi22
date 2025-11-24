# Посібник установки для вашого проекту

## Быстрий старт (5 хвилин)

### 1. На Replit
```bash
# Скопіюйте мій проект
git clone https://github.com/ваш-репо taxi-service
cd taxi-service

# Встановіть залежності
npm install

# Запустіть
npm run dev
```

### 2. У Telegram
1. Напишіть `@BotFather`
2. `/newbot` → отримайте токен
3. На Replit встановіть SECRET: `TELEGRAM_BOT_TOKEN`
4. Напишіть своєму боту `/start`

### 3. Готово!
- Клієнт: вибирає роль → замовляє таксі
- Водій: переглядає замовлення → пропонує ціну
- Адмін: пароль `admin123` → управління

---

## Структура папок для копіювання

### Мінімум для повної функціональності:

```
your-project/
├── shared/schema.ts          ← Копіюйте ЦЕ
├── server/
│   ├── storage.ts            ← Копіюйте ЦЕ (усь CRUD)
│   ├── routes.ts             ← Копіюйте ЦЕ (всі API)
│   ├── telegram.ts           ← Копіюйте ЦЕ (бот)
│   └── index-dev.ts, index-prod.ts, vite.ts, index.ts
├── client/src/
│   ├── pages/                ← Копіюйте ЦЕ (9 сторінок)
│   ├── components/ui/        ← Копіюйте ЦЕ (Shadcn компоненти)
│   ├── lib/                  ← Копіюйте ЦЕ (контекст + квері)
│   ├── App.tsx               ← Копіюйте ЦЕ
│   ├── main.tsx
│   └── index.css             ← Копіюйте ЦЕ (дизайн)
├── package.json              ← Переконайтесь у залежностях
├── tailwind.config.ts        ← Копіюйте ЦЕ (дизайн конфіг)
└── vite.config.ts
```

---

## Що змінити для свого проекту

1. **Назва бота** - в `server/telegram.ts` лінія 86: `Привіт, ${firstName}!` → змініть текст
2. **Пароль адміна** - в `client/src/pages/admin-login.tsx`: `admin123` → ваш пароль
3. **Кольори** - в `client/src/index.css`: замініть HSL значення
4. **Компанія/логотип** - в `client/src/pages/role-selector.tsx`: додайте свій логотип
5. **API URL** - в `server/telegram.ts`: встановіть свій APP_URL

---

## Залежності (package.json)

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "react": "^18.x",
    "react-dom": "^18.x",
    "@tanstack/react-query": "^5.x",
    "react-hook-form": "^7.x",
    "@hookform/resolvers": "^3.x",
    "zod": "^3.x",
    "drizzle-orm": "^0.29.x",
    "@neondatabase/serverless": "^0.x",
    "tailwindcss": "^3.x",
    "@radix-ui/*": "various"
  }
}
```

---

## Типові помилки і як їх виправити

| Помилка | Причина | Рішення |
|---------|---------|----------|
| EADDRINUSE port 5000 | Порт зайнятий | `pkill -f "node.*server"` |
| Bot not responding | TELEGRAM_BOT_TOKEN не встановлено | Встановіть SECRET на Replit |
| Cannot find module | Неправильний імпорт | Перевіріть відносні шляхи |
| LSP errors | TypeScript помилки | Нагнайте чинні типи в `shared/schema.ts` |

---

## Як тестувати

### Сценарій 1: Клієнт замовляє таксі
1. Вибери роль "Клієнт"
2. Натисни "Таксі"
3. Вкажи адресу "Звідки" та "Куди"
4. Відправ замовлення

### Сценарій 2: Водій приймає замовлення
1. Вибери роль "Водій"
2. Побачиш список активних замовлень
3. Натисни "Прийняти"
4. Запропонуй ціну
5. Чекай відповіді клієнта

### Сценарій 3: Адміністратор управляє
1. Вибери "Адміністратор"
2. Введи пароль `admin123`
3. Генеруй коди для водіїв
4. Видавай попередження/бонуси

---

## Налаштування для продакшену

1. Встановіть `NODE_ENV=production`
2. Встановіть `DATABASE_URL` для своєї БД
3. Змініть пароль адміна на надійний
4. Встановіть WEBHOOK_URL для webhook (замість polling)
5. Включіть HTTPS для webhook

