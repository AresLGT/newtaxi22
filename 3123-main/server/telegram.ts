import { storage } from "./storage";

const TELEGRAM_API = "https://api.telegram.org";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  from: { id: number; first_name: string };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (!update.message || !update.message.text) return;

  const message = update.message;
  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const firstName = message.from.first_name;
  const text = message.text.trim();

  try {
    // Handle /start command
    if (text === "/start") {
      await sendTelegramMessage(
        chatId,
        `👋 Привіт, ${firstName}!\n\nДобро пожалувати до Таксі-Сервісу!\n\nВиберіть вашу роль:\n🚖 Клієнт\n🚗 Водій\n🛡️ Адміністратор (пароль захищено)\n\nТапни кнопку нижче, щоб запустити додаток:`,
        [
          [
            {
              text: "🚀 Запустити додаток",
              web_app: {
                url: process.env.APP_URL || "https://taxi-app.replit.dev",
              },
            },
          ],
        ]
      );
      return;
    }

    // Handle /generate_code command (admin only)
    if (text === "/generate_code") {
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        await sendTelegramMessage(
          chatId,
          "❌ Ви не маєте прав для цієї команди. Тільки адміністратори можуть генерувати коди."
        );
        return;
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await storage.generateAccessCode(userId);

      await sendTelegramMessage(
        chatId,
        `✅ Новий код доступу сгенерований:\n\n🔑 <code>${code}</code>\n\nПоділіться цим кодом з водієм для реєстрації.`,
        undefined,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Handle /help command
    if (text === "/help") {
      await sendTelegramMessage(
        chatId,
        `📖 Доступні команди:\n\n/start - Запустити додаток\n/help - Цей пункт\n/generate_code - Генерувати код доступу (тільки для адміна)\n\n🎯 Натисніть кнопку "Запустити додаток" для отримання повного доступу.`
      );
      return;
    }

    // Default response
    await sendTelegramMessage(
      chatId,
      `Я не розумію цю команду. Введіть /help для списку команд.`
    );
  } catch (error) {
    console.error("Telegram update error:", error);
    await sendTelegramMessage(
      chatId,
      "❌ Сталася помилка. Спробуйте пізніше."
    ).catch(() => {});
  }
}

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: any[],
  options?: Record<string, any>
) {
  if (!BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return;
  }

  try {
    const payload: Record<string, any> = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...options,
    };

    if (replyMarkup) {
      payload.reply_markup = {
        inline_keyboard: replyMarkup,
      };
    }

    const response = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Telegram API error:", await response.text());
    }
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}

export async function setWebhook(url: string) {
  if (!BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  try {
    const webhookUrl = `${url}/api/telegram/webhook`;
    const response = await fetch(
      `${TELEGRAM_API}/bot${BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message"],
        }),
      }
    );

    const result = await response.json();
    if (result.ok) {
      console.log(`✅ Telegram webhook configured: ${webhookUrl}`);
    } else {
      console.error("❌ Webhook error:", result.description);
    }
    return result.ok;
  } catch (error) {
    console.error("Error setting Telegram webhook:", error);
    return false;
  }
}

let webhookSetupPromise: Promise<boolean> | null = null;

export async function autoSetupWebhook(baseUrl?: string) {
  if (!BOT_TOKEN) {
    return false;
  }

  // Return existing promise if setup is already in progress
  if (webhookSetupPromise) {
    return webhookSetupPromise;
  }

  const url = baseUrl || process.env.APP_URL;
  
  if (!url) {
    return false;
  }

  webhookSetupPromise = setWebhook(url);
  return webhookSetupPromise;
}

export async function getBotInfo() {
  if (!BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return null;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/getMe`);
    const data = await response.json();
    if (data.ok) {
      console.log(`✅ Telegram Bot Connected: @${data.result.username}`);
      return data.result;
    }
    return null;
  } catch (error) {
    console.error("Error getting bot info:", error);
    return null;
  }
}
