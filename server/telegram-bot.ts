import TelegramBot from 'node-telegram-bot-api';
import type { IStorage } from './storage';
import type { User } from '@shared/schema';

const ADMIN_ID = process.env.ADMIN_ID || '7677921905';

export function initTelegramBot(storage: IStorage) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN not set. Bot features disabled.');
    return null;
  }

  const bot = new TelegramBot(TOKEN, { polling: true });
  console.log('✅ Telegram bot initialized successfully');

  async function getOrCreateUser(userId: string, username?: string): Promise<User> {
    let user = await storage.getUser(userId);
    if (!user) {
      // За замовчуванням - клієнт
      const role = String(userId) === String(ADMIN_ID) ? 'admin' : 'client';
      user = await storage.createUser({
        id: userId,
        role: role as 'client' | 'driver' | 'admin',
        name: username || null,
        phone: null,
        telegramAvatarUrl: null,
      });
    }
    return user;
  }

  // /start
  bot.onText(/\/start/, async (msg) => {
    const userId = String(msg.from!.id);
    const user = await getOrCreateUser(userId, msg.from!.first_name);
    const firstName = user.name || msg.from!.first_name || 'друже';
    
    let text = '';
    if (user.role === 'admin') {
      text = `Вітаю, Адміне ${firstName}! 👑\n\nНатисніть кнопку <b>"UniWay"</b> внизу для керування.`;
    } else if (user.role === 'driver') {
      text = `Привіт, ${firstName}! 🚖\n\nВи на лінії. Натисніть кнопку <b>"UniWay"</b>, щоб працювати або замовити таксі.`;
    } else {
      text = `Вітаємо, ${firstName}! 🎉\n\n🚖 <b>UniWay</b> — зручне таксі.\n\nЯкщо ви водій і маєте код — надішліть його сюди.`;
    }
    
    await bot.sendMessage(msg.chat.id, text, { 
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true } 
    });
  });

  // Обробка кодів (текстові повідомлення)
  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    const senderId = String(msg.from!.id);
    const messageText = msg.text?.trim();
    
    // Якщо повідомлення схоже на код (8 символів)
    if (messageText && messageText.length === 8) {
      const user = await getOrCreateUser(senderId, msg.from!.first_name);
      
      // Пробуємо зареєструвати водія
      const result = await storage.registerDriverWithCode(senderId, messageText, user.name || "Водій", "Не вказано");
      
      if (result) {
        await bot.sendMessage(msg.chat.id, `✅ <b>Вітаємо!</b>\n\nВаш код прийнято. Ви отримали статус <b>ВОДІЯ</b>. 🚖\n\nВідкрийте додаток (кнопка UniWay) — у вас з'явиться нове меню.`, { parse_mode: 'HTML' });
        // Сповіщення адміну
        await bot.sendMessage(parseInt(ADMIN_ID), `🔔 Новий водій зареєструвався!\n${user.name} (ID: ${senderId})`);
      } else {
        await bot.sendMessage(msg.chat.id, '❌ Невірний або вже використаний код.', { parse_mode: 'HTML' });
      }
    }
  });

  return bot;
}