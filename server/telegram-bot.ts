import TelegramBot from 'node-telegram-bot-api';
import type { IStorage } from './storage';
import type { User } from '@shared/schema';

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
    if (drivers.length === 0) return '';
    return drivers
      .map(driver => {
        const roleLabel = driver.role === 'admin' ? '👑' : '🚖';
        const name = driver.name || 'Без імені';
        return `${roleLabel} 🆔 <code>${driver.id}</code> — ${name}`;
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
    const averageRating = totalRatings > 0 ? allRatings.reduce((sum, r) => sum + r.stars, 0) / totalRatings : 0;
    
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
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
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

  function isAdmin(userId: number | string): boolean {
    return String(userId) === String(ADMIN_ID);
  }

  // --- КОМАНДИ БОТА ---

  /**
   * Команда /start - Більше ніяких кнопок!
   */
  bot.onText(/\/start/, async (msg) => {
    const userId = String(msg.from!.id);
    const user = await getOrCreateUser(userId, msg.from!.first_name);
    const firstName = user.name || msg.from!.first_name || 'друже';
    
    let text = '';

    if (user.role === 'admin') {
      text = `Вітаю, Адміне ${firstName}! 👑\n\nНатисніть кнопку <b>"UniWay"</b> зліва внизу, щоб відкрити панель керування.`;
    } else if (user.role === 'driver') {
      text = `Привіт, ${firstName}! 🚖\n\nВи на лінії. Натисніть кнопку <b>"UniWay"</b> зліва внизу, щоб зайти в кабінет водія.`;
    } else {
      // --- ТУТ ЗМІНЕНО ТЕКСТ ---
      text = `Вітаємо, ${firstName}! 🎉\n\n🚖 <b>UniWay</b> — швидко, зручно, надійно!\n\nНатисніть синю кнопку <b>"UniWay"</b> зліва внизу 👇`;
    }
    
    // ВАЖЛИВО: remove_keyboard: true видаляє старі кнопки
    await bot.sendMessage(msg.chat.id, text, { 
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true } 
    });
  });

  bot.onText(/\/stats/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    const stats = await getAdminStats();
    const text = `📊 <b>Статистика:</b>\n\nВсього: ${stats.totalOrders}\nЗавершено: ${stats.completedOrders}\nОчікують: ${stats.pendingOrders}\nВодіїв: ${stats.activeDrivers}\nРейтинг: ${stats.averageRating}`;
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  bot.onText(/\/drivers/, async (msg) => {
    if (!isAdmin(msg.from!.id)) return;
    const list = await getAllDriversList();
    const text = list ? `📋 <b>Водії:</b>\n\n${list}` : '📋 Водіїв немає';
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  bot.onText(/\/generate(?:\s+(\d+))?/, async (msg, match) => {
    if (!isAdmin(msg.from!.id)) return;
    const count = Math.min(10, Math.max(1, parseInt(match?.[1] || '1')));
    const codes: string[] = [];
    for (let i = 0; i < count; i++) codes.push(await createDriverCode(String(msg.from!.id)));
    const codesList = codes.map(c => `<code>${c}</code>`).join('\n');
    await bot.sendMessage(msg.chat.id, `✅ <b>Коди:</b>\n\n${codesList}`, { parse_mode: 'HTML' });
  });

  bot.onText(/\/setname (\S+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from!.id) || !match) return;
    const updated = await storage.updateUser(match[1], { name: match[2] });
    await bot.sendMessage(msg.chat.id, updated ? `✅ Ім'я змінено.` : '❌ Не знайдено.');
  });

  bot.on('callback_query', async (query) => {
    if (!isAdmin(query.from.id)) return;
    const data = query.data;
    if (!data) return;
    const [action, targetId] = data.split('_');
    
    if (action === 'approve') {
      await storage.updateUser(targetId, { role: 'driver' });
      await bot.sendMessage(parseInt(targetId), '✅ Схвалено! Ви тепер водій.');
      await bot.answerCallbackQuery(query.id, { text: '✅ Схвалено' });
    } else if (action === 'reject') {
      await bot.sendMessage(parseInt(targetId), '❌ Заявку відхилено.');
      await bot.answerCallbackQuery(query.id, { text: '❌ Відхилено' });
    }
  });

  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    const senderId = String(msg.from!.id);
    const messageText = msg.text;
    
    if (messageText && messageText.length === 8 && /^[A-Z0-9]+$/i.test(messageText)) {
      const user = await getOrCreateUser(senderId, msg.from!.first_name);
      if (user.role !== 'client') return;
      
      const codeUpper = messageText.toUpperCase();
      const validation = await storage.validateAccessCode(codeUpper);
      
      if (!validation || validation.isUsed) {
        await bot.sendMessage(msg.chat.id, '❌ Невірний код!', { parse_mode: 'HTML' });
        return;
      }
      
      await bot.sendMessage(msg.chat.id, '✅ Код прийнято! Очікуйте підтвердження.', { parse_mode: 'HTML' });
      await bot.sendMessage(parseInt(ADMIN_ID), `🔔 <b>Заявка на водія:</b>\n\n👤 ${msg.from!.first_name}\n🎫 Код: <code>${codeUpper}</code>`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '✅ Схвалити', callback_data: `approve_${senderId}` }, { text: '❌ Відхилити', callback_data: `reject_${senderId}` }]] }
      });
      await storage.markCodeAsUsed(codeUpper, senderId);
    }
  });

  bot.on('polling_error', (error: any) => {
    if (error.code !== 'ETELEGRAM' || error.response?.body?.error_code !== 409) {
      console.error('Polling error:', error.message);
    }
  });

  return bot;
}