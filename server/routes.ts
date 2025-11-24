import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import {
  insertUserSchema,
  insertOrderSchema,
  insertChatMessageSchema,
} from "@shared/schema";
import { handleTelegramUpdate, getBotInfo, autoSetupWebhook } from "./telegram";

export async function registerRoutes(app: Express): Promise<Server> {
  // User routes
  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
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
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.post("/api/users/register-driver", async (req, res) => {
    try {
      const schema = z.object({
        userId: z.string(),
        code: z.string(),
        name: z.string(),
        phone: z.string(),
      });
      const data = schema.parse(req.body);

      const user = await storage.registerDriverWithCode(
        data.userId,
        data.code,
        data.name,
        data.phone
      );

      if (!user) {
        return res.status(400).json({ error: "Invalid or used access code" });
      }

      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid registration data" });
    }
  });

  // Order routes
  app.get("/api/orders/active", async (req, res) => {
    const orders = await storage.getActiveOrders();
    res.json(orders);
  });

  app.get("/api/orders/:id", async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  });

  app.get("/api/orders/client/:clientId", async (req, res) => {
    const orders = await storage.getOrdersByClient(req.params.clientId);
    res.json(orders);
  });

  app.get("/api/orders/driver/:driverId", async (req, res) => {
    const orders = await storage.getOrdersByDriver(req.params.driverId);
    res.json(orders);
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const data = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(data);
      res.status(201).json(order);
    } catch (error) {
      res.status(400).json({ error: "Invalid order data" });
    }
  });

  app.post("/api/orders/:id/accept", async (req, res) => {
    try {
      const schema = z.object({
        driverId: z.string(),
      });
      const data = schema.parse(req.body);

      const order = await storage.acceptOrder(req.params.id, data.driverId);
      if (!order) {
        return res.status(400).json({ error: "Cannot accept order" });
      }

      res.json(order);
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/orders/:id/bid", async (req, res) => {
    try {
      const schema = z.object({
        driverId: z.string(),
        price: z.number().positive(),
      });
      const data = schema.parse(req.body);

      const order = await storage.proposeBid(req.params.id, data.driverId, data.price);
      if (!order) {
        return res.status(400).json({ error: "Cannot propose bid" });
      }

      res.json(order);
    } catch (error) {
      res.status(400).json({ error: "Invalid bid data" });
    }
  });

  app.post("/api/orders/:id/respond", async (req, res) => {
    try {
      const schema = z.object({
        clientId: z.string(),
        accepted: z.boolean(),
      });
      const data = schema.parse(req.body);

      const order = await storage.respondToBid(req.params.id, data.clientId, data.accepted);
      if (!order) {
        return res.status(400).json({ error: "Cannot respond to bid" });
      }

      res.json(order);
    } catch (error) {
      res.status(400).json({ error: "Invalid response data" });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const updates = req.body;
      const order = await storage.updateOrder(req.params.id, updates);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  // Admin routes
  app.get("/api/admin/drivers", async (req, res) => {
    const drivers = await storage.getAllDrivers();
    res.json(drivers);
  });

  app.post("/api/admin/generate-code", async (req, res) => {
    try {
      const schema = z.object({
        adminId: z.string(),
      });
      const data = schema.parse(req.body);

      const code = await storage.generateAccessCode(data.adminId);
      res.status(201).json(code);
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/admin/drivers/:id/block", async (req, res) => {
    try {
      const driver = await storage.getUser(req.params.id);
      if (!driver || driver.role !== "driver") {
        return res.status(404).json({ error: "Driver not found" });
      }

      const updated = await storage.updateUser(req.params.id, {
        isBlocked: !driver.isBlocked,
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Cannot block driver" });
    }
  });

  app.post("/api/admin/drivers/:id/warning", async (req, res) => {
    try {
      const schema = z.object({
        text: z.string(),
      });
      const data = schema.parse(req.body);

      const driver = await storage.getUser(req.params.id);
      if (!driver || driver.role !== "driver") {
        return res.status(404).json({ error: "Driver not found" });
      }

      const warnings = driver.warnings || [];
      const updated = await storage.updateUser(req.params.id, {
        warnings: [...warnings, data.text],
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Cannot add warning" });
    }
  });

  app.post("/api/admin/drivers/:id/bonus", async (req, res) => {
    try {
      const schema = z.object({
        text: z.string(),
      });
      const data = schema.parse(req.body);

      const driver = await storage.getUser(req.params.id);
      if (!driver || driver.role !== "driver") {
        return res.status(404).json({ error: "Driver not found" });
      }

      const bonuses = driver.bonuses || [];
      const updated = await storage.updateUser(req.params.id, {
        bonuses: [...bonuses, data.text],
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Cannot add bonus" });
    }
  });

  // Chat routes
  app.get("/api/chat/:orderId", async (req, res) => {
    const messages = await storage.getChatMessages(req.params.orderId);
    res.json(messages);
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const data = insertChatMessageSchema.parse(req.body);
      const message = await storage.sendChatMessage(data);
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ error: "Invalid message data" });
    }
  });

  // Telegram webhook
  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      // Setup webhook on first telegram message (auto-detect from request)
      if (!process.env.WEBHOOK_SETUP_DONE) {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        if (host) {
          const baseUrl = `${protocol}://${host}`;
          await autoSetupWebhook(baseUrl);
          process.env.WEBHOOK_SETUP_DONE = "true";
        }
      }

      const update = req.body;
      await handleTelegramUpdate(update);
      res.json({ ok: true });
    } catch (error) {
      console.error("Telegram webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Check bot connection on startup
  await getBotInfo();

  const httpServer = createServer(app);
  return httpServer;
}
