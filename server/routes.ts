import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import {
  insertUserSchema,
  insertOrderSchema,
  insertChatMessageSchema,
} from "@shared/schema";
import { rateLimitMiddleware } from "./middleware/rate-limit";

// --- НАЛАШТУВАННЯ ---
const WEBAPP_URL = process.env.WEB_APP_URL || "https://newtaxi22-production.up.railway.app";

// Функція відправки
async function sendTelegramMessage(chatId: string, text: string, openWebApp: boolean = false) {
  // ВИПРАВЛЕНО: Використовуємо правильну змінну середовища
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  
  if (!token) {
    console.error("❌ Telegram token not found in environment variables!");
    return null;
  }

  const body: any = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };

  if (openWebApp) {
    body.reply_markup = {
      inline_keyboard: [[{ text: "↗️ Відкрити додаток", web_app: { url: `${WEBAPP_URL}/client` } }]]
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`Failed to send message to ${chatId}`, error);
    return null;
  }
}

// Функція видалення повідомлення
async function deleteTelegramMessage(chatId: string, messageId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
  } catch (error) {
    console.error(`Failed to delete message ${messageId} from ${chatId}`, error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // User routes
  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  app.post("/api/users", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const user = await storage.createUser(data);
      res.status(201).json(user);
    } catch (error) { res.status(400).json({ error: "Invalid user data" }); }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body;
      let user = await storage.getUser(req.params.id);
      if (!user) {
        user = await storage.createUser({ id: req.params.id, role: "client", name: updates.name || "Клієнт", phone: updates.phone || null, telegramAvatarUrl: null });
      }
      const updatedUser = await storage.updateUser(req.params.id, updates);
      res.json(updatedUser);
    } catch (error) { res.status(400).json({ error: "Invalid update data" }); }
  });

  app.post("/api/users/register-driver", async (req, res) => {
    try {
      const schema = z.object({ userId: z.string(), code: z.string(), name: z.string(), phone: z.string() });
      const data = schema.parse(req.body);
      const user = await storage.registerDriverWithCode(data.userId, data.code, data.name, data.phone);
      if (!user) return res.status(400).json({ error: "Invalid code" });
      res.status(201).json(user);
    } catch (error) { res.status(400).json({ error: "Invalid data" }); }
  });

  // Admin, Tariffs, Finance, Reviews, Broadcast
  app.get("/api/admin/tariffs", async (req, res) => { const t = await storage.getTariffs(); res.json(t); });
  app.post("/api/admin/tariffs", async (req, res) => {
    try { const d = req.body; await storage.updateTariff(d.type, d.basePrice, d.perKm); res.json({ success: true }); } catch { res.status(400).json({ error: "Error" }); }
  });
  app.post("/api/admin/finance/update", async (req, res) => {
    try { const d = req.body; const u = await storage.updateBalance(d.userId, d.amount); if(!u) return res.status(404).json({}); res.json(u); } catch { res.status(400).json({}); }
  });
  app.get("/api/admin/reviews", async (req, res) => { const r = await storage.getAllRatings(); res.json(r); });
  
  // --- ВИПРАВЛЕНИЙ BROADCAST ---
  app.post("/api/admin/broadcast", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      const users = await storage.getAllUsers();
      
      // Відправляємо асинхронно, щоб не блокувати сервер
      // Використовуємо for...of для послідовної відправки (щоб не зловити бан від Телеграму за спам)
      (async () => {
        for (const user of users) {
          if (user.id && /^\d+$/.test(user.id) && !user.isBlocked) {
            await sendTelegramMessage(user.id, `📢 <b>Оголошення:</b>\n\n${message}`);
            // Маленька затримка щоб не перевантажити API
            await new Promise(resolve => setTimeout(resolve, 50)); 
          }
        }
      })();

      res.json({ success: true, count: users.length });
    } catch { res.status(500).json({ error: "Failed to broadcast" }); }
  });

  // Orders Read
  app.get("/api/orders/active", async (req, res) => { const o = await storage.getActiveOrders(); res.json(o); });
  app.get("/api/orders/:id", async (req, res) => { const o = await storage.getOrder(req.params.id); if(!o) return res.status(404).json({}); res.json(o); });
  app.get("/api/orders/client/:clientId", async (req, res) => { const o = await storage.getOrdersByClient(req.params.clientId); res.json(o); });
  app.get("/api/orders/driver/:driverId", async (req, res) => { const o = await storage.getOrdersByDriver(req.params.driverId); res.json(o); });
  app.get("/api/orders/driver/:driverId/current", async (req, res) => { const o = await storage.getDriverCurrentOrder(req.params.driverId); res.json(o ? [o] : []); });
  app.get("/api/admin/orders/all", async (req, res) => { const o = await storage.getAllOrders(); o.sort((a, b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()); res.json(o); });

  // --- СТВОРЕННЯ ЗАМОВЛЕННЯ ---
  app.post("/api/orders", rateLimitMiddleware, async (req, res) => {
    try {
      const data = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(data);
      res.status(201).json(order);

      const drivers = await storage.getAllDrivers();
      const orderText = `🚖 <b>Нове замовлення!</b>\n\n📍 <b>Звідки:</b> ${order.from}\n🏁 <b>Куди:</b> ${order.to}\n💰 <b>Орієнтовно:</b> ${order.price || "?"} грн`;
      
      for (const driver of drivers) {
        if (driver.id && /^\d+$/.test(driver.id) && !driver.isBlocked && driver.id !== order.clientId) {
           const result = await sendTelegramMessage(driver.id, orderText, true);
           if (result && result.ok && result.result && result.result.message_id) {
             await storage.addOrderNotification(order.orderId, driver.id, result.result.message_id);
           }
        }
      }
    } catch (error) { res.status(400).json({ error: "Invalid order data" }); }
  });

  // --- ПРИЙНЯТТЯ ЗАМОВЛЕННЯ ---
  app.post("/api/orders/:id/accept", async (req, res) => {
    try {
      const schema = z.object({ driverId: z.union([z.string(), z.number()]).transform(String), distanceKm: z.number().optional() });
      const data = schema.parse(req.body);
      let driver = await storage.getUser(data.driverId);
      if (!driver) driver = await storage.createUser({ id: data.driverId, role: "driver", name: `Driver ${data.driverId}`, phone: null, telegramAvatarUrl: null });
      
      const order = await storage.acceptOrder(req.params.id, data.driverId, data.distanceKm);
      if (!order) return res.status(400).json({ error: "Cannot accept order" });

      const notifications = await storage.getOrderNotifications(req.params.id);
      notifications.forEach(note => {
         deleteTelegramMessage(note.chatId, note.messageId);
      });

      if (order.clientId && /^\d+$/.test(order.clientId)) {
        sendTelegramMessage(order.clientId, `✅ <b>Водій прийняв замовлення!</b>\n\nВодій: ${driver.name}\nАвто вже виїжджає.`);
      }

      res.json(order);
    } catch (error: any) { res.status(400).json({ error: error?.message }); }
  });

  app.post("/api/orders/:id/release", async (req, res) => { try { const u = await storage.releaseOrder(req.params.id); if(!u) return res.status(404).json({}); res.json(u); } catch { res.status(500).json({}); } });
  app.post("/api/orders/:id/cancel", async (req, res) => { try { const u = await storage.updateOrder(req.params.id, { status: "cancelled" }); if(!u) return res.status(404).json({}); res.json(u); } catch { res.status(500).json({}); } });
  app.post("/api/admin/orders/:id/cancel", async (req, res) => { try { const u = await storage.updateOrder(req.params.id, { status: "cancelled" }); if(!u) return res.status(404).json({}); res.json(u); } catch { res.status(500).json({}); } });
  
  app.post("/api/orders/:id/complete", async (req, res) => { 
    try { 
      const u = await storage.completeOrder(req.params.id); 
      if(!u) return res.status(404).json({}); 
      if (u.clientId && /^\d+$/.test(u.clientId)) sendTelegramMessage(u.clientId, `🏁 <b>Поїздку завершено!</b>\n\nБудь ласка, оцініть поїздку.`, true);
      res.json(u); 
    } catch { res.status(500).json({}); } 
  });

  app.patch("/api/orders/:id", async (req, res) => { try { const u = await storage.updateOrder(req.params.id, req.body); if(!u) return res.status(404).json({}); res.json(u); } catch { res.status(400).json({}); } });
  app.post("/api/orders/:id/rate", async (req, res) => { try { const d = req.body; const s = await storage.rateOrder(req.params.id, d.stars, d.comment); if(!s) return res.status(400).json({}); res.json({ success: true }); } catch { res.status(400).json({}); } });

  app.get("/api/admin/drivers", async (req, res) => { const d = await storage.getAllDrivers(); res.json(d); });
  app.post("/api/admin/generate-code", async (req, res) => { try { const d = req.body; const c = await storage.generateAccessCode(d.adminId); res.status(201).json(c); } catch { res.status(400).json({}); } });
  app.post("/api/admin/drivers/:id/block", async (req, res) => { try { const d = await storage.getUser(req.params.id); if(!d) return res.status(404).json({}); const u = await storage.updateUser(req.params.id, { isBlocked: !d.isBlocked }); res.json(u); } catch { res.status(400).json({}); } });

  app.get("/api/drivers/:id/stats", async (req, res) => { try { const s = await storage.getDriverStats(req.params.id); res.json(s); } catch { res.status(500).json({}); } });
  app.get("/api/drivers/:id/badges", async (req, res) => { try { const b = await storage.getDriverBadges(req.params.id); res.json({ badges: b }); } catch { res.status(500).json({}); } });

  app.get("/api/chat/:orderId", async (req, res) => { const m = await storage.getChatMessages(req.params.orderId); res.json(m); });
  app.post("/api/chat", async (req, res) => { try { const m = await storage.sendChatMessage(req.body); res.status(201).json(m); } catch { res.status(400).json({}); } });

  const httpServer = createServer(app);
  return httpServer;
}