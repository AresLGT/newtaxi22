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

// ВАЖЛИВО: Перевір, чи це правильне посилання на твій Web App
const WEBAPP_URL = "https://newtaxi22-production.up.railway.app"; 

// Функція для відправки повідомлень
async function sendTelegramMessage(chatId: string, text: string, type: 'text' | 'button' = 'text') {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;

  const body: any = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };

  // Якщо тип 'button', додаємо кнопку відкриття Web App
  if (type === 'button') {
    body.reply_markup = {
      inline_keyboard: [[
        { text: "🚖 Відкрити додаток водія", web_app: { url: `${WEBAPP_URL}/driver` } }
      ]]
    };
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error(`Failed to send message to ${chatId}`, error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // --- WEBHOOK: ОБРОБКА ПОВІДОМЛЕНЬ ---
  app.post("/api/bot/webhook", async (req, res) => {
    try {
      const update = req.body;
      
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id.toString();
        const text = update.message.text.trim();
        const firstName = update.message.from.first_name || "Водій";

        console.log(`[BOT] Отримано: ${text} від ${chatId}`);

        // 1. Якщо написали /start — вітаємось і даємо кнопку
        if (text === "/start") {
           await sendTelegramMessage(chatId, `👋 <b>Привіт, ${firstName}!</b>\n\nЩоб почати роботу, натисніть кнопку нижче.\nЯкщо ви ще не ввели код доступу — просто надішліть його сюди повідомленням.`, 'button');
           return res.sendStatus(200);
        }

        // 2. Якщо це не /start, перевіряємо чи це код доступу
        const result = await storage.registerDriverWithCode(chatId, text, firstName, "TelegramChat");

        if (result) {
          // Код підійшов!
          await sendTelegramMessage(chatId, `✅ <b>Вітаємо! Ви стали водієм.</b>\n\nТепер ви маєте доступ до замовлень. Натисніть кнопку нижче.`, 'button');
        } else {
          // Код не підійшов
          // Ігноруємо короткі повідомлення, щоб не спамити
          if (text.length > 4) {
             await sendTelegramMessage(chatId, `❌ <b>Код не знайдено.</b>\nСпробуйте ще раз або зверніться до адміна.`);
          }
        }
      }
      res.sendStatus(200);
    } catch (e) {
      console.error("Webhook Error:", e);
      res.sendStatus(500);
    }
  });

  // --- REST API (Залишаємо без змін) ---
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
      if (!user) user = await storage.createUser({ id: req.params.id, role: "client", name: updates.name || "Клієнт", phone: updates.phone, telegramAvatarUrl: null });
      const updatedUser = await storage.updateUser(req.params.id, updates);
      res.json(updatedUser);
    } catch (error) { res.status(400).json({ error: "Invalid update data" }); }
  });

  // Admin & Orders routes
  app.get("/api/admin/tariffs", async (req, res) => { const t = await storage.getTariffs(); res.json(t); });
  app.post("/api/admin/tariffs", async (req, res) => { try { const d = req.body; await storage.updateTariff(d.type, d.basePrice, d.perKm); res.json({ success: true }); } catch { res.status(400).json({ error: "Error" }); } });
  app.post("/api/admin/finance/update", async (req, res) => { try { const d = req.body; const u = await storage.updateBalance(d.userId, d.amount); if(!u) return res.status(404).json({}); res.json(u); } catch { res.status(400).json({}); } });
  app.get("/api/admin/reviews", async (req, res) => { const r = await storage.getAllRatings(); res.json(r); });
  
  app.get("/api/orders/active", async (req, res) => { const o = await storage.getActiveOrders(); res.json(o); });
  app.get("/api/orders/:id", async (req, res) => { const o = await storage.getOrder(req.params.id); if(!o) return res.status(404).json({}); res.json(o); });
  app.get("/api/orders/client/:clientId", async (req, res) => { const o = await storage.getOrdersByClient(req.params.clientId); res.json(o); });
  app.get("/api/orders/driver/:driverId", async (req, res) => { const o = await storage.getOrdersByDriver(req.params.driverId); res.json(o); });
  app.get("/api/orders/driver/:driverId/current", async (req, res) => { const o = await storage.getDriverCurrentOrder(req.params.driverId); res.json(o ? [o] : []); });
  app.get("/api/admin/orders/all", async (req, res) => { const o = await storage.getAllOrders(); o.sort((a, b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()); res.json(o); });

  app.post("/api/orders", rateLimitMiddleware, async (req, res) => {
    try {
      const data = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(data);
      res.status(201).json(order);
      const drivers = await storage.getAllDrivers();
      const orderText = `🚖 <b>Нове замовлення!</b>\n\n📍 <b>Звідки:</b> ${order.from}\n🏁 <b>Куди:</b> ${order.to}\n💰 <b>Ціна:</b> ${order.price || "?"} грн`;
      for (const driver of drivers) {
        if (driver.id && /^\d+$/.test(driver.id) && !driver.isBlocked && driver.id !== order.clientId) {
           await sendTelegramMessage(driver.id, orderText, 'button');
        }
      }
    } catch (error) { res.status(400).json({ error: "Invalid order data" }); }
  });

  app.post("/api/orders/:id/accept", async (req, res) => {
    try {
      const schema = z.object({ driverId: z.union([z.string(), z.number()]).transform(String), distanceKm: z.number().optional() });
      const data = schema.parse(req.body);
      let driver = await storage.getUser(data.driverId);
      if (!driver) driver = await storage.createUser({ id: data.driverId, role: "driver", name: `Driver ${data.driverId}`, phone: null, telegramAvatarUrl: null });
      const order = await storage.acceptOrder(req.params.id, data.driverId, data.distanceKm);
      if (!order) return res.status(400).json({ error: "Cannot accept order" });
      if (order.clientId && /^\d+$/.test(order.clientId)) {
        sendTelegramMessage(order.clientId, `✅ <b>Водій прийняв замовлення!</b>\n\nВодій: ${driver.name}\nАвто вже виїжджає.`);
      }
      res.json(order);
    } catch (error: any) { res.status(400).json({ error: error?.message }); }
  });

  app.post("/api/orders/:id/release", async (req, res) => { try { const u = await storage.releaseOrder(req.params.id); if(!u) return res.status(404).json({}); res.json(u); } catch { res.status(500).json({}); } });
  app.post("/api/orders/:id/cancel", async (req, res) => { try { const u = await storage.updateOrder(req.params.id, { status: "cancelled" }); if(!u) return res.status(404).json({}); res.json(u); } catch { res.status(500).json({}); } });
  app.post("/api/orders/:id/complete", async (req, res) => { try { const u = await storage.completeOrder(req.params.id); if(!u) return res.status(404).json({}); if (u.clientId && /^\d+$/.test(u.clientId)) sendTelegramMessage(u.clientId, `🏁 <b>Поїздку завершено!</b>`, 'button'); res.json(u); } catch { res.status(500).json({}); } });
  app.patch("/api/orders/:id", async (req, res) => { try { const u = await storage.updateOrder(req.params.id, req.body); if(!u) return res.status(404).json({}); res.json(u); } catch { res.status(400).json({}); } });
  
  app.get("/api/admin/drivers", async (req, res) => { const d = await storage.getAllDrivers(); res.json(d); });
  app.post("/api/admin/generate-code", async (req, res) => { try { const d = req.body; const c = await storage.generateAccessCode(d.adminId); res.status(201).json(c); } catch { res.status(400).json({}); } });
  app.get("/api/chat/:orderId", async (req, res) => { const m = await storage.getChatMessages(req.params.orderId); res.json(m); });
  app.post("/api/chat", async (req, res) => { try { const m = await storage.sendChatMessage(req.body); res.status(201).json(m); } catch { res.status(400).json({}); } });

  const httpServer = createServer(app);
  return httpServer;
}