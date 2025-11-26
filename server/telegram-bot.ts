import TelegramBot from 'node-telegram-bot-api';
import type { IStorage } from './storage';
import type { User, Order } from '@shared/schema';

const ADMIN_ID = process.env.ADMIN_ID || '7677921905';
const WEB_APP_URL = process.env.WEB_APP_URL || "https://newtaxi22-production.up.railway.app";

interface DriverStats {
  completedOrders: number;
  totalRatings: number;
  averageRating: string;
  earnings: number;
}

export function initTelegramBot(storage: IStorage) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN not set. Bot features disabled.');
    return null;
  }

  const bot = new TelegramBot(TOKEN, { polling: true });
  console.log('✅ Telegram bot initialized successfully');

  // --- HELPER FUNCTIONS ---

  async function getOrCreateUser(userId: string, username?: string): Promise<User> {
    let user = await storage.getUser(userId);
    
    if (!user) {
      const role = String(userId) === String(ADMIN_ID) ? 'admin' : 'client';
      user = await storage.createUser({
        id: userId,
        role: role as 'client' | 'driver' | 'admin',
        name: username || null,
        phone: null,
        telegramAvatarUrl: null,
      });
    }
    
    if (String(userId) === String(ADMIN_ID) && user.role !== 'admin') {
      user = await storage.updateUser(userId, { role: 'admin' }) || user;
    }
    
    return user;
  }

  async function getAllDriversList(): Promise<string> {
    const drivers = await storage.getAllDrivers();
    const admins = await Promise.all(
      [ADMIN_ID].map(id => storage.getUser(String(id)))
    );
    
    const allDrivers = [
      ...drivers.map(d => ({ ...d, isAdmin: false })),
      ...admins.filter(Boolean).map(a => ({ ...a, isAdmin: true }))
    ].filter((d, i, arr) => arr.findIndex(x => x!.id === d!.id) === i);
    
    if (allDrivers.length === 0) {
      return '';
    }
    
    return allDrivers
      .map(driver => {
        const roleLabel = driver!.isAdmin ? '👑' : '🚖';
        const name = driver!.name || 'Без імені';
        return `${roleLabel} 🆔 <code>${driver!.id}</code> — ${name}`;
      })
      .join('\n');
  }

  async function getAdminStats() {
    const allOrders = await storage.getAllOrders();
    const drivers = await storage.getAllDrivers();
    const allRatings = await storage.getAllRatings();
    
    const completedOrders = allOrders.filter(o => o.status === 'completed');
    const pendingOrders = allOrders.filter(o => o.status === 'pending');
    
    const totalRatings = allRatings.length;
    const averageRating = totalRatings > 0 
      ? allRatings.reduce((sum, r) => sum + r.stars, 0) / totalRatings
      : 0;
    
    return {
      totalOrders: allOrders.length,
      completedOrders: completedOrders.length,
      activeDrivers: drivers.length,
      pendingOrders: pendingOrders.length,
      averageRating: totalRatings > 0 ? averageRating.toFixed(1) : 'N/A'
    };
  }

  function generateDriverCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async function createDriverCode(adminId: string): Promise<string> {
    let code: string;
    let attempts = 0;
    
    do {
      code = generateDriverCode();
      const existing = await storage.validateAccessCode(code);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);
    
    const accessCode = await storage.generateAccessCode(adminId);
    return accessCode.code;
  }

  async function getUnusedCodes(): Promise<string[]> {
    return [];
  }

  function isAdmin(userId: number | string): boolean {
    return String(userId) === String(ADMIN_ID);
  }

  // --- КОМАНДИ БОТА ---

  bot.onText(/\/start/, async (msg) => {
    const userId = String(msg.from!.id);
    const user = await getOrCreateUser(userId, msg.from!.first_name);
    const firstName = user.name || msg.from!.first_name || 'друже';
    
    let text = '';
    let keyboard: TelegramBot.KeyboardButton[][] = [];

    if (user.role === 'admin') {
      text = `Вітаю, ${firstName}! 👑\n\nВи Адміністратор і Водій.\n\n<b>Команди:</b>\n/generate - Згенерувати коди\n/codes - Невикористані коди\n/drivers - Список водіїв\n/stats - Статистика\n/setname ID ІМ'Я - Змінити ім'я`;
      keyboard = [
        [{ text: '💼 Я водій', web_app: { url: WEB_APP_URL + `/driver?userId=${userId}&asRole=driver` } }],
        [{ text: '🙋‍♂️ Я клієнт', web_app: { url: WEB_APP_URL + `/client?userId=${userId}&asRole=client` } }],
        [{ text: '📊 Панель адміна', web_app: { url: WEB_APP_URL + `/admin?userId=${userId}` } }]
      ];
    } else if (user.role === 'driver') {
      text = `Привіт, ${firstName}! 🚖\n\nВи водій. Приймайте замовлення та заробляйте!`;
      keyboard = [
        [{ text: '💼 Приймати замовлення', web_app: { url: WEB_APP_URL + `/driver?userId=${userId}` } }],
        [{ text: '🙋‍♂️ Замовити для себе', web_app: { url: WEB_APP_URL + `/client?userId=${userId}&asRole=client` } }]
      ];
    } else {
      text = `Вітаємо, ${firstName}! 🎉\n\n🚖 Швидко, зручно, надійно!\n\nДля реєстрації як водій - введіть код доступу (8 символів).`;
      keyboard = [[{ text: '📱 Замовити послугу', web_app: { url: WEB_APP_URL + `/client?userId=${userId}&asRole=client` } }]];
    }
    
    await bot.sendMessage(msg.chat.id, text, { 
      parse_mode: 'HTML',
      reply_markup: { keyboard, resize_keyboard: true }
    });
  });

  bot.onText(/\/stats/, async (msg) => {
    if (!isAdmin(msg.from!.id)) {
      await bot.sendMessage(msg.chat.id, '❌ Ця команда доступна тільки для адміністраторів');
      return;
    }
    
    const stats = await getAdminStats();
    const text = `📊 <b>Статистика:</b>\n\nВсього замовлень: ${stats.totalOrders}\nЗавершено: ${stats.completedOrders}\nОчікують: ${stats.pendingOrders}\nАктивних водіїв: ${stats.activeDrivers}\nСередній рейтинг: ${stats.averageRating}`;
    
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  bot.onText(/\/drivers/, async (msg) => {
    if (!isAdmin(msg.from!.id)) {
      await bot.sendMessage(msg.chat.id, '❌ Ця команда доступна тільки для адміністраторів');
      return;
    }
    
    const list = await getAllDriversList();
    const text = list ? `📋 <b>Водії:</b>\n\n${list}` : '📋 Водіїв немає';
    
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  bot.onText(/\/setname (\S+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from!.id)) {
      await bot.sendMessage(msg.chat.id, '❌ Ця команда доступна тільки для адміністраторів');
      return;
    }
    
    if (!match) return;
    
    const targetId = match[1];
    const newName = match[2];
    
    const updated = await storage.updateUser(targetId, { name: newName });
    
    if (updated) {
      await bot.sendMessage(msg.chat.id, `✅ Ім'я змінено на: <b>${newName}</b>`, { parse_mode: 'HTML' });
    } else {
      await bot.sendMessage(msg.chat.id, '❌ Користувача не знайдено', { parse_mode: 'HTML' });
    }
  });

  bot.onText(/\/generate(?:\s+(\d+))?/, async (msg, match) => {
    if (!isAdmin(msg.from!.id)) {
      await bot.sendMessage(msg.chat.id, '❌ Ця команда доступна тільки для адміністраторів');
      return;
    }
    
    const count = Math.min(10, Math.max(1, parseInt(match?.[1] || '1')));
    const adminId = String(msg.from!.id);
    
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = await createDriverCode(adminId);
      codes.push(code);
    }
    
    const codesList = codes.map(c => `<code>${c}</code>`).join('\n');
    await bot.sendMessage(msg.chat.id, `✅ <b>Коди (${count}):</b>\n\n${codesList}`, { parse_mode: 'HTML' });
  });

  bot.onText(/\/codes/, async (msg) => {
    if (!isAdmin(msg.from!.id)) {
      await bot.sendMessage(msg.chat.id, '❌ Ця команда доступна тільки для адміністраторів');
      return;
    }
    
    const unused = await getUnusedCodes();
    
    if (unused.length === 0) {
      await bot.sendMessage(msg.chat.id, '📋 Немає доступних кодів.\n\nВикористайте /generate для створення нових кодів.', { parse_mode: 'HTML' });
      return;
    }
    
    const list = unused.map(c => `🎫 <code>${c}</code>`).join('\n');
    await bot.sendMessage(msg.chat.id, `📋 <b>Коди (${unused.length}):</b>\n\n${list}`, { parse_mode: 'HTML' });
  });

  // --- ОСНОВНА ЗМІНА ТУТ (Обробка коду водія) ---
  bot.on('message', async (msg) => {
    // Пропускаємо команди
    if (msg.text && msg.text.startsWith('/')) return;
    
    const senderId = String(msg.from!.id);
    const messageText = msg.text;
    
    // Перевірка чи це код водія (8 символів, букви та цифри)
    if (messageText && messageText.length === 8 && /^[A-Z0-9]+$/i.test(messageText)) {
      const user = await getOrCreateUser(senderId, msg.from!.first_name);
      
      // Якщо користувач вже водій або адмін, ігноруємо (або можна написати повідомлення)
      if (user.role === 'driver' || user.role === 'admin') {
         await bot.sendMessage(msg.chat.id, '✅ Ви вже зареєстровані як водій. Натисніть /start для меню.', { parse_mode: 'HTML' });
         return;
      }
      
      const codeUpper = messageText.toUpperCase();
      const validation = await storage.validateAccessCode(codeUpper);
      
      if (!validation || validation.isUsed) {
        await bot.sendMessage(msg.chat.id, '❌ Невірний або вже використаний код!', { parse_mode: 'HTML' });
        return;
      }
      
      // --- МИТТЄВА АКТИВАЦІЯ ---
      // Позначаємо код як використаний
      await storage.markCodeAsUsed(codeUpper, senderId);
      
      // Оновлюємо роль користувача на водія
      await storage.updateUser(senderId, { role: 'driver' });
      
      const firstName = msg.from!.first_name || 'Водій';
      
      // Повідомляємо користувача
      await bot.sendMessage(msg.chat.id, `✅ <b>Код прийнято!</b>\n\nВітаємо, ${firstName}! Вам надано роль водія.\nТепер ви можете приймати замовлення.\n\nНатисніть /start щоб побачити меню водія.`, { 
        parse_mode: 'HTML' 
      });
      
      // (Опціонально) Повідомляємо адміна, що хтось активував код
      await bot.sendMessage(parseInt(ADMIN_ID), `ℹ️ <b>Новий водій активований:</b>\n\n👤 ${firstName}\n🆔 <code>${senderId}</code>\n🎫 Код: <code>${codeUpper}</code>`, { parse_mode: 'HTML' });
    }
  });

  bot.on('polling_error', (error: any) => {
    if (error.code === 'ETELEGRAM' && error.response?.body?.error_code === 409) {
      console.log('⚠️  Telegram bot polling conflict detected. Stopping polling...');
      bot.stopPolling();
    } else {
      console.error('Telegram bot polling error:', error.message);
    }
  });

  return bot;
}