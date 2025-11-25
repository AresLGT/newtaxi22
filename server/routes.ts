import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertOrderSchema, insertChatMessageSchema } from "@shared/schema";
import { rateLimitMiddleware } from "./middleware/rate-limit";

export async function registerRoutes(app: Express): Promise<Server> {
  // ... (інші маршрути Users, Orders залишаються такими ж) ...
  // Я покажу тільки змінений маршрут broadcast та інші для контексту

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
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body;
      let user = await storage.getUser(req.params.id);
      if (!user) {
        user = await storage.createUser({
          id: req.params.id, role: "client", name: updates.name || "Новий клієнт",
          phone: updates.phone || null, telegramAvatarUrl: null,
        });
      }
      const updatedUser = await storage.updateUser(req.params.id, updates);
      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.post("/api/users/register-driver", async (req, res) => {
    try {
      const schema = z.object({ userId: z.string(), code: z.string(), name: z.string(), phone: z.string() });
      const data = schema.parse(req.body);
      const user = await storage.registerDriverWithCode(data.userId, data.code, data.name, data.phone);
      if (!user) return res.status(400).json({ error: "Invalid access code" });
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid registration data" });
    }
  });

  // Tariffs & Finance
  app.get("/api/admin/tariffs", async (req, res) => { const tariffs = await storage.getTariffs(); res.json(tariffs); });
  app.post("/api/admin/tariffs", async (req, res) => {
    try {
      const schema = z.object({ type: z.string(), basePrice: z.number(), perKm: z.number() });
      const data = schema.parse(req.body);
      await storage.updateTariff(data.type, data.basePrice, data.perKm);
      res.json({ success: true });
    } catch (error) { res.status(400).json({ error: "Invalid tariff data" }); }
  });
  app.post("/api/admin/finance/update", async (req, res) => {
    try {
      const schema = z.object({ userId: z.string(), amount: z.number() });
      const data = schema.parse(req.body);
      const user = await storage.updateBalance(data.userId, data.amount);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (error) { res.status(400).json({ error: "Invalid finance data" }); }
  });

  // Reviews
  app.get("/api/admin/reviews", async (req, res) => { const reviews = await storage.getAllRatings(); res.json(reviews); });

  // --- РЕАЛЬНА РОЗСИЛКА (BROADCAST) ---
  app.post("/api/admin/broadcast", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      const users = await storage.getAllUsers();
      const token = process.env.BOT_TOKEN;

      if (!token) {
        console.error("BOT_TOKEN not found in env vars");
        return res.status(500).json({ error: "Server misconfiguration: No bot token" });
      }

      let sentCount = 0;
      
      // Асинхронно відправляємо всім
      // (У реальному проекті краще використовувати чергу, але для старту так ок)
      users.forEach(async (user) => {
        // Перевіряємо, чи ID схожий на Telegram ID (цифри)
        if (user.id && /^\d+$/.test(user.id)) {
          try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: user.id,
                text: `📢 <b>Оголошення від UniWay:</b>\n\n${message}`,
                parse_mode: 'HTML'
              })
            });
            sentCount++;
          } catch (err) {
            console.error(`Failed to send to ${user.id}`, err);
          }
        }
      });

      res.json({ success: true, message: `Broadcast started for ${users.length} users` });
    } catch (error) {
      res.status(500).json({ error: "Broadcast failed" });
    }
  });
  // ------------------------------------

  // Orders
  app.get("/api/orders/active", async (req, res) => { const orders = await storage.getActiveOrders(); res.json(orders); });
  app.get("/api/orders/:id", async (req, res) => { const order = await storage.getOrder(req.params.id); if (!order) return res.status(404).json({ error: "Order not found" }); res.json(order); });
  app.get("/api/orders/client/:clientId", async (req, res) => { const orders = await storage.getOrdersByClient(req.params.clientId); res.json(orders); });
  app.get("/api/orders/driver/:driverId", async (req, res) => { const orders = await storage.getOrdersByDriver(req.params.driverId); res.json(orders); });
  app.get("/api/orders/driver/:driverId/current", async (req, res) => { const order = await storage.getDriverCurrentOrder(req.params.driverId); res.json(order ? [order] : []); });
  app.get("/api/admin/orders/all", async (req, res) => { const orders = await storage.getAllOrders(); orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()); res.json(orders); });

  app.post("/api/orders", rateLimitMiddleware, async (req, res) => {
    try {
      const data = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(data);
      res.status(201).json(order);
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
      res.json(order);
    } catch (error: any) { res.status(400).json({ error: error?.message }); }
  });

  app.post("/api/orders/:id/release", async (req, res) => {
    try { const updated = await storage.releaseOrder(req.params.id); if (!updated) return res.status(404).json({ error: "Order not found" }); res.json(updated); } catch (e) { res.status(500).json({ error: "Error releasing" }); }
  });
  app.post("/api/orders/:id/cancel", async (req, res) => {
    try { const updated = await storage.updateOrder(req.params.id, { status: "cancelled" }); if (!updated) return res.status(404).json({ error: "Order not found" }); res.json(updated); } catch (e) { res.status(500).json({ error: "Error cancelling" }); }
  });
  app.post("/api/orders/:id/complete", async (req, res) => {
     try { const updated = await storage.completeOrder(req.params.id); if (!updated) return res.status(404).json({ error: "Order not found" }); res.json(updated); } catch (e) { res.status(500).json({ error: "Error completing" }); }
  });
  app.post("/api/admin/orders/:id/cancel", async (req, res) => {
    try { const updated = await storage.updateOrder(req.params.id, { status: "cancelled" }); if (!updated) return res.status(404).json({ error: "Order not found" }); res.json(updated); } catch (e) { res.status(500).json({ error: "Error" }); }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try { const updates = req.body; const order = await storage.updateOrder(req.params.id, updates); if (!order) return res.status(404).json({ error: "Order not found" }); res.json(order); } catch (error) { res.status(400).json({ error: "Invalid data" }); }
  });

  app.post("/api/orders/:id/rate", async (req, res) => {
    try { const schema = z.object({ stars: z.number().min(1).max(5), comment: z.string().optional() }); const data = schema.parse(req.body); const success = await storage.rateOrder(req.params.id, data.stars, data.comment); if (!success) return res.status(400).json({ error: "Cannot rate" }); res.json({ success: true }); } catch (error) { res.status(400).json({ error: "Invalid data" }); }
  });

  app.get("/api/admin/drivers", async (req, res) => { const drivers = await storage.getAllDrivers(); res.json(drivers); });
  app.post("/api/admin/generate-code", async (req, res) => {
    try { const schema = z.object({ adminId: z.string() }); const data = schema.parse(req.body); const code = await storage.generateAccessCode(data.adminId); res.status(201).json(code); } catch (error) { res.status(400).json({ error: "Invalid request" }); }
  });
  app.post("/api/admin/drivers/:id/block", async (req, res) => {
    try { const driver = await storage.getUser(req.params.id); if (!driver || driver.role !== "driver") return res.status(404).json({ error: "Driver not found" }); const updated = await storage.updateUser(req.params.id, { isBlocked: !driver.isBlocked }); res.json(updated); } catch (error) { res.status(400).json({ error: "Error" }); }
  });

  app.get("/api/drivers/:id/stats", async (req, res) => { try { const stats = await storage.getDriverStats(req.params.id); res.json(stats); } catch (error) { res.status(500).json({ error: "Error" }); } });
  app.get("/api/drivers/:id/badges", async (req, res) => { try { const badges = await storage.getDriverBadges(req.params.id); res.json({ badges }); } catch (error) { res.status(500).json({ error: "Error" }); } });

  app.get("/api/chat/:orderId", async (req, res) => { const messages = await storage.getChatMessages(req.params.orderId); res.json(messages); });
  app.post("/api/chat", async (req, res) => {
    try { const data = insertChatMessageSchema.parse(req.body); const message = await storage.sendChatMessage(data); res.status(201).json(message); } catch (error) { res.status(400).json({ error: "Invalid message" }); }
  });

  const httpServer = createServer(app);
  return httpServer;
}