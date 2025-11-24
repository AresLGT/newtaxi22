# Telegram Taxi Service - Структура проекту

## Назва проекту
**Telegram Taxi Service Web App** - платформа для замовлення таксі, вантажних перевезень, кур'єрських послуг та евакуаторів через Telegram

## Основні компоненти для копіювання

### 1. **Backend структура** (`server/`)

```
server/
├── index-dev.ts          # Точка входу розробки
├── index-prod.ts         # Точка входу продакшену
├── storage.ts            # Interface для роботи з даними
├── routes.ts             # REST API маршути
├── telegram.ts           # Інтеграція з Telegram Bot API
├── vite.ts              # Vite dev server
└── index.ts             # Express app setup
```

**Ключові файли для копіювання:**
- `storage.ts` - весь CRUD функціонал
- `routes.ts` - всі API endpoints
- `telegram.ts` - вся логіка бота

### 2. **Frontend структура** (`client/src/`)

```
client/src/
├── pages/
│   ├── role-selector.tsx      # Вибір ролі (Клієнт/Водій/Адмін)
│   ├── client-home.tsx        # Меню для клієнта (4 типи замовлень)
│   ├── order-form.tsx         # Форма замовлення
│   ├── driver-dashboard.tsx   # Список замовлень для водія
│   ├── driver-profile.tsx     # Профіль водія
│   ├── admin-dashboard.tsx    # Панель адміністратора
│   ├── admin-login.tsx        # Вхід в адмін (пароль: admin123)
│   ├── chat-page.tsx          # Чат клієнт-водій
│   └── not-found.tsx          # 404 сторінка
├── components/
│   ├── ui/                    # Shadcn UI компоненти
│   ├── chat.tsx              # Компонент чату
│   └── app-sidebar.tsx       # (якщо буде)
├── lib/
│   ├── user-provider.tsx     # React Context для юзера
│   ├── use-user.ts           # Hook для доступу до контексту
│   └── queryClient.ts        # TanStack Query конфіг
├── App.tsx                   # Router та провайдери
└── main.tsx                  # Entry point
```

### 3. **Дані/Схема** (`shared/schema.ts`)

```typescript
// Основні таблиці:
- Users (id, role, name, phone, telegramAvatarUrl, warnings[], bonuses[], isBlocked)
- Orders (orderId, type, clientId, driverId, from, to, status, driverBidPrice, proposalAttempts[])
- AccessCodes (code, isUsed, issuedBy, usedBy, createdAt)
- ChatMessages (id, orderId, senderId, message, createdAt)
```

---

## Як використати як шаблон

### Крок 1: Скопіюйте цільові папки
```bash
cp -r server/ your-project/server/
cp -r client/src/ your-project/client/src/
cp -r shared/ your-project/shared/
```

### Крок 2: Встановіть залежності
```bash
npm install
```

### Крок 3: Налаштуйте Telegram Bot
1. Напишіть @BotFather в Telegram
2. Створіть нового бота командою `/newbot`
3. Отримайте токен
4. Встановіть `TELEGRAM_BOT_TOKEN` в `.env`

### Крок 4: Налаштуйте базу даних
- Автоматично використовується Replit PostgreSQL
- Чи встановіть свою через `DATABASE_URL`

### Крок 5: Запустіть
```bash
npm run dev
```

---

## API Endpoints (для інтеграції)

### Users
- `GET /api/users/:id` - отримати юзера
- `POST /api/users` - створити юзера
- `PATCH /api/users/:id` - оновити юзера
- `POST /api/users/register-driver` - реєстрація водія з кодом

### Orders
- `GET /api/orders/active` - активні замовлення
- `GET /api/orders/:id` - замовлення за ID
- `POST /api/orders` - створити замовлення
- `POST /api/orders/:id/accept` - водій приймає замовлення
- `POST /api/orders/:id/bid` - водій пропонує ціну
- `POST /api/orders/:id/respond` - клієнт відповідає на ціну

### Admin
- `GET /api/admin/drivers` - список всіх водіїв
- `POST /api/admin/generate-code` - згенерувати код доступу
- `POST /api/admin/drivers/:id/block` - заблокувати водія
- `POST /api/admin/drivers/:id/warning` - видати попередження
- `POST /api/admin/drivers/:id/bonus` - видати бонус

### Chat
- `GET /api/chat/:orderId` - отримати повідомлення
- `POST /api/chat` - відправити повідомлення

---

## Типи замовлень

1. **Taxi** - звичайне таксі
2. **Cargo** - вантажне таксі (з описом вантажу)
3. **Courier** - кур'єрська доставка (з описом що везти)
4. **Towing** - евакуаторні послуги (з типом автомобіля)

---

## Роли користувачів

| Роль | Доступ |
|------|--------|
| **Client** | Створення замовлень, переглядання пропозицій, чат з водієм |
| **Driver** | Перегляд замовлень, пропозиція цін, профіль, чат |
| **Admin** | Генерація кодів, управління водіями, блокування, попередження |

---

## Ключові технології

- **Frontend:** React 18, TypeScript, Vite, Shadcn/ui, Tailwind CSS, Wouter (routing)
- **Backend:** Express.js, Node.js, ESM modules
- **State:** React Context + TanStack Query v5
- **Forms:** React Hook Form + Zod validation
- **Database:** PostgreSQL (Drizzle ORM)
- **Bot:** Telegram Bot API

---

## Як повторити дизайн

1. Скопіюйте `index.css` - містить всі кольорові змінні та Tailwind конфіг
2. Скопіюйте `tailwind.config.ts` - налаштування дизайну системи
3. Усі компоненти UI використовують Shadcn (готові, стилізовані)
4. Мобільна-first адаптивність вже вбудована

---

## Запуск на Replit

1. Завантажте цей проект на Replit
2. Натисніть "Run"
3. Бот автоматично зареєструється
4. Напишіть боту `/start` в Telegram

---

## Важливі константи

- Admin password: `admin123`
- App URL в боті: встановлюється автоматично з `REPL_OWNER.REPL_ID`
- Database: встановлюється автоматично на Replit

