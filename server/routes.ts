import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertOrderSchema, insertChatMessageSchema } from "@shared/schema";
import { rateLimitMiddleware } from "./middleware/rate-limit";

const WEBAPP_URL = "https://newtaxi22-production.up.railway.app";

async function sendTelegramMessage(chatId: string, text: string, openWebApp: boolean = false) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  const body: any = { chat_id: chatId, text: text, parse_mode: 'HTML' };
  if (openWebApp) body.reply_markup = { inline_keyboard: [[{ text: "↗️ Прийняти замовлення", web_app: { url: `${WEBAPP_URL}/driver` } }]] };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    return await res.json();
  } catch (error) { console.error(error); return null; }
}

async function deleteTelegramMessage(chatId: string, messageId: number) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;
  try { await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: messageId }) }); } catch (error) { console.error(error); }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // --- ROUTES FOR ADMIN & SYSTEM ---

  app.post("/api/admin/cleanup-keyboard", async (req, res) => {
    try {
      const { userId } = req.body;
      const token = process.env.BOT_TOKEN;
      if (!token || !userId) return res.status(400).json({ error: "No token" });
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: userId, text: "✅ Кнопки видалено.", reply_markup: { remove_keyboard: true } })
      });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Failed" }); }
  });

  // НОВЕ: Отримати всіх клієнтів
  app.get("/api/admin/clients", async (req, res) => {
    const clients = await storage.getAllClients();
    res.json(clients);
  });

  // НОВЕ: Підтримка
  app.post("/api/support", async (req, res) => {
    try {
      const { userId, message } = req.body;
      await storage.createSupportTicket(userId, message);
      // Сповіщення адміну в телеграм (опціонально)
      sendTelegramMessage("7677921905", `📩 <b>Нове повідомлення в підтримку!</b>\n\n"${message}"`);
      res.json({ success: true });
    } catch { res.status(500).json({}); }
  });

  app.get("/api/admin/support", async (req, res) => {
    const tickets = await storage.getSupportTickets();
    res.json(tickets);
  });

  app.post("/api/admin/support/:id/resolve", async (req, res) => {
    await storage.resolveSupportTicket(req.params.id);
    res.json({ success: true });
  });

  // User routes
  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  });
  app.post("/api/users", async (req, res) => {
    try { const d = insertUserSchema.parse(req.body); const u = await storage.createUser(d); res.status(201).json(u); } catch { res.status(400).json({}); }
  });
  app.patch("/api/users/:id", async (req, res) => {
    try { const d = req.body; let u = await storage.getUser(req.params.id); if(!u) u = await storage.createUser({id: req.params.id, role: "client", name: d.name||"New", phone: d.phone||null, telegramAvatarUrl: null}); const up = await storage.updateUser(req.params.id, d); res.json(up); } catch { res.status(400).json({}); }
  });
  app.post("/api/users/register-driver", async (req, res) => {
    try { const s = z.object({ userId: z.string(), code: z.string(), name: z.string(), phone: z.string() }); const d = s.parse(req.body); const u = await storage.registerDriverWithCode(d.userId, d.code, d.name, d.phone); if(!u) return res.status(400).json({}); res.status(201).json(u); } catch { res.status(400).json({}); }
  });

  // Tariffs, Finance, Broadcast
  app.get("/api/admin/tariffs", async (req, res) => { const t = await storage.getTariffs(); res.json(t); });
  app.post("/api/admin/tariffs", async (req, res) => { try { const d = req.body; await storage.updateTariff(d.type, d.basePrice, d.perKm); res.json({ success: true }); } catch { res.status(400).json({}); } });
  app.post("/api/admin/finance/update", async (req, res) => { try { const d = req.body; const u = await storage.updateBalance(d.userId, d.amount); res.json(u); } catch { res.status(400).json({}); } });
  app.get("/api/admin/reviews", async (req, res) => { const r = await storage.getAllRatings(); res.json(r); });
  app.post("/api/admin/broadcast", async (req, res) => { try { const { message } = req.body; const u = await storage.getAllUsers(); u.forEach(user => { if (user.id && /^\d+$/.test(user.id)) sendTelegramMessage(user.id, `📢 <b>Оголошення:</b>\n\n${message}`); }); res.json({ success: true }); } catch { res.status(500).json({}); } });

  // Orders
  app.get("/api/orders/active", async (req, res) => { const o = await storage.getActiveOrders(); res.json(o); });
  app.get("/api/orders/:id", async (req, res) => { const o = await storage.getOrder(req.params.id); if(!o) return res.status(404).json({}); res.json(o); });
  app.get("/api/orders/client/:clientId", async (req, res) => { const o = await storage.getOrdersByClient(req.params.clientId); res.json(o); });
  app.get("/api/orders/driver/:driverId", async (req, res) => { const o = await storage.getOrdersByDriver(req.params.driverId); res.json(o); });
  app.get("/api/orders/driver/:driverId/current", async (req, res) => { const o = await storage.getDriverCurrentOrder(req.params.driverId); res.json(o ? [o] : []); });
  app.get("/api/admin/orders/all", async (req, res) => { const o = await storage.getAllOrders(); o.sort((a, b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()); res.json(o); });

  app.post("/api/orders", rateLimitMiddleware, async (req, res) => {
    try {
      const d = insertOrderSchema.parse(req.body);
      const o = await storage.createOrder(d);
      res.status(201).json(o);
      const drivers = await storage.getAllDrivers();
      const txt = `🚖 <b>Нове замовлення!</b>\n\n📍 ${o.from}\n🏁 ${o.to}\n💰 ~${o.price} грн`;
      for (const dr of drivers) {
        if (dr.id && /^\d+$/.test(dr.id) && !dr.isBlocked && dr.id !== o.clientId) {
           const r = await sendTelegramMessage(dr.id, txt, true);
           if (r && r.ok && r.result.message_id) await storage.addOrderNotification(o.orderId, dr.id, r.result.message_id);
        }
      }
    } catch { res.status(400).json({}); }
  });

  app.post("/api/orders/:id/accept", async (req, res) => {
    try {
      const s = z.object({ driverId: z.union([z.string(), z.number()]).transform(String), distanceKm: z.number().optional() });
      const d = s.parse(req.body);
      let dr = await storage.getUser(d.driverId);
      if (!dr) dr = await storage.createUser({ id: d.driverId, role: "driver", name: `Driver ${d.driverId}`, phone: null, telegramAvatarUrl: null });
      const o = await storage.acceptOrder(req.params.id, d.driverId, d.distanceKm);
      if (!o) return res.status(400).json({});
      const ns = await storage.getOrderNotifications(req.params.id);
      ns.forEach(n => deleteTelegramMessage(n.chatId, n.messageId));
      if (o.clientId && /^\d+$/.test(o.clientId)) sendTelegramMessage(o.clientId, `✅ <b>Водій прийняв замовлення!</b>\n\nВодій: ${dr.name}`);
      res.json(o);
    } catch { res.status(400).json({}); }
  });

  app.post("/api/orders/:id/release", async (req, res) => { try { const u = await storage.releaseOrder(req.params.id); res.json(u); } catch { res.status(500).json({}); } });
  app.post("/api/orders/:id/cancel", async (req, res) => { try { const u = await storage.updateOrder(req.params.id, { status: "cancelled" }); res.json(u); } catch { res.status(500).json({}); } });
  app.post("/api/orders/:id/complete", async (req, res) => { 
    try { const u = await storage.completeOrder(req.params.id); if(u && u.clientId && /^\d+$/.test(u.clientId)) sendTelegramMessage(u.clientId, `🏁 <b>Поїздку завершено!</b>`, true); res.json(u); } catch { res.status(500).json({}); } 
  });
  app.post("/api/admin/orders/:id/cancel", async (req, res) => { try { const u = await storage.updateOrder(req.params.id, { status: "cancelled" }); res.json(u); } catch { res.status(500).json({}); } });
  app.patch("/api/orders/:id", async (req, res) => { try { const u = await storage.updateOrder(req.params.id, req.body); res.json(u); } catch { res.status(400).json({}); } });
  app.post("/api/orders/:id/rate", async (req, res) => { try { const d = req.body; await storage.rateOrder(req.params.id, d.stars, d.comment); res.json({ success: true }); } catch { res.status(400).json({}); } });
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