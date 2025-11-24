// server/index-prod.ts
import fs from "node:fs";
import path from "node:path";
import express2 from "express";

// server/app.ts
import express from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  users;
  orders;
  accessCodes;
  chatMessages;
  ratings;
  rateLimits;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.orders = /* @__PURE__ */ new Map();
    this.accessCodes = /* @__PURE__ */ new Map();
    this.chatMessages = /* @__PURE__ */ new Map();
    this.ratings = /* @__PURE__ */ new Map();
    this.rateLimits = /* @__PURE__ */ new Map();
    this.users.set("admin1", {
      id: "admin1",
      role: "admin",
      name: "\u0410\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440",
      phone: "+380501111111",
      telegramAvatarUrl: null,
      isBlocked: false,
      warnings: [],
      bonuses: []
    });
    this.users.set("7677921905", {
      id: "7677921905",
      role: "admin",
      name: "\u0410\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440",
      phone: null,
      telegramAvatarUrl: null,
      isBlocked: false,
      warnings: [],
      bonuses: []
    });
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async createUser(insertUser) {
    const user = {
      ...insertUser,
      isBlocked: false,
      warnings: [],
      bonuses: []
    };
    this.users.set(user.id, user);
    return user;
  }
  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) return void 0;
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  async getAllDrivers() {
    return Array.from(this.users.values()).filter((user) => user.role === "driver");
  }
  async registerDriverWithCode(userId, code, name, phone) {
    const accessCode = await this.validateAccessCode(code);
    if (!accessCode || accessCode.isUsed) {
      return null;
    }
    let user = await this.getUser(userId);
    if (!user) {
      user = await this.createUser({
        id: userId,
        role: "driver",
        name,
        phone,
        telegramAvatarUrl: null
      });
    } else {
      user = await this.updateUser(userId, {
        role: "driver",
        name,
        phone
      });
    }
    if (user) {
      await this.markCodeAsUsed(code, userId);
    }
    return user ?? null;
  }
  // Order methods
  async getOrder(orderId) {
    return this.orders.get(orderId);
  }
  async getAllOrders() {
    return Array.from(this.orders.values());
  }
  async getActiveOrders() {
    return Array.from(this.orders.values()).filter(
      (order) => order.status === "pending"
    );
  }
  async getOrdersByClient(clientId) {
    return Array.from(this.orders.values()).filter((order) => order.clientId === clientId);
  }
  async getOrdersByDriver(driverId) {
    return Array.from(this.orders.values()).filter((order) => order.driverId === driverId);
  }
  async createOrder(insertOrder) {
    const orderId = randomUUID();
    const order = {
      orderId,
      ...insertOrder,
      status: "pending",
      driverId: null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.orders.set(orderId, order);
    return order;
  }
  async updateOrder(orderId, updates) {
    const order = this.orders.get(orderId);
    if (!order) return void 0;
    const updatedOrder = { ...order, ...updates };
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }
  async acceptOrder(orderId, driverId) {
    const order = this.orders.get(orderId);
    if (!order || order.status !== "pending") return void 0;
    const driver = await this.getUser(driverId);
    if (!driver || driver.role !== "driver" || driver.isBlocked) {
      return void 0;
    }
    const updatedOrder = {
      ...order,
      driverId,
      status: "accepted"
    };
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }
  // Access Code methods
  async generateAccessCode(issuedBy) {
    let code;
    let attempts = 0;
    const maxAttempts = 10;
    do {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      attempts++;
      if (attempts >= maxAttempts) {
        code = randomUUID().substring(0, 8).toUpperCase();
        break;
      }
    } while (this.accessCodes.has(code));
    const accessCode = {
      code,
      isUsed: false,
      issuedBy,
      usedBy: null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.accessCodes.set(code, accessCode);
    return accessCode;
  }
  async validateAccessCode(code) {
    return this.accessCodes.get(code);
  }
  async markCodeAsUsed(code, userId) {
    const accessCode = this.accessCodes.get(code);
    if (!accessCode || accessCode.isUsed) return false;
    const updatedCode = {
      ...accessCode,
      isUsed: true,
      usedBy: userId
    };
    this.accessCodes.set(code, updatedCode);
    return true;
  }
  // Chat methods
  async getChatMessages(orderId) {
    return this.chatMessages.get(orderId) || [];
  }
  async sendChatMessage(insertMessage) {
    const id = randomUUID();
    const message = {
      id,
      ...insertMessage,
      createdAt: /* @__PURE__ */ new Date()
    };
    const messages = this.chatMessages.get(insertMessage.orderId) || [];
    messages.push(message);
    this.chatMessages.set(insertMessage.orderId, messages);
    return message;
  }
  // Rating methods
  async rateOrder(orderId, stars, comment) {
    const order = this.orders.get(orderId);
    if (!order || order.status !== "completed" || !order.driverId) {
      return false;
    }
    const existingRating = Array.from(this.ratings.values()).find(
      (rating2) => rating2.orderId === orderId
    );
    if (existingRating) {
      return false;
    }
    const normalizedStars = Math.min(5, Math.max(1, Math.floor(stars)));
    const ratingId = randomUUID();
    const rating = {
      id: ratingId,
      orderId,
      driverId: order.driverId,
      stars: normalizedStars,
      comment: comment || null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.ratings.set(ratingId, rating);
    return true;
  }
  async getAllRatings() {
    return Array.from(this.ratings.values());
  }
  async getDriverStats(driverId) {
    const completedOrders = Array.from(this.orders.values()).filter(
      (order) => order.driverId === driverId && order.status === "completed"
    );
    const driverRatings = Array.from(this.ratings.values()).filter(
      (rating) => rating.driverId === driverId
    );
    const totalRatings = driverRatings.length;
    const averageRating = totalRatings > 0 ? driverRatings.reduce((sum, r) => sum + r.stars, 0) / totalRatings : 0;
    return {
      completedOrders: completedOrders.length,
      totalRatings,
      averageRating: Math.round(averageRating * 10) / 10
    };
  }
  async getDriverBadges(driverId) {
    const stats = await this.getDriverStats(driverId);
    const badges = [];
    if (stats.averageRating >= 4.8) badges.push("\u2B50 \u0422\u043E\u043F-\u0432\u043E\u0434\u0456\u0439");
    if (stats.completedOrders >= 100) badges.push("\u{1F3C6} \u041B\u0435\u0433\u0435\u043D\u0434\u0430");
    if (stats.completedOrders >= 50) badges.push("\u{1F525} \u0410\u043A\u0442\u0438\u0432\u043D\u0438\u0439");
    if (stats.completedOrders >= 20 && stats.averageRating >= 4.5) badges.push("\u{1F48E} \u041F\u0440\u0435\u043C\u0456\u0443\u043C");
    if (stats.totalRatings >= 50 && stats.averageRating === 5) badges.push("\u26A1 \u0406\u0434\u0435\u0430\u043B\u044C\u043D\u0438\u0439");
    return badges.length > 0 ? badges.join(" ") : null;
  }
  // Rate limit methods
  async getRateLimitTimestamps(userId) {
    return this.rateLimits.get(userId) || [];
  }
  async saveRateLimitTimestamps(userId, timestamps) {
    this.rateLimits.set(userId, timestamps);
  }
  async cleanExpiredRateLimits() {
    const now = Date.now();
    const RATE_LIMIT_WINDOW2 = 6e4;
    for (const [userId, timestamps] of this.rateLimits.entries()) {
      const validTimestamps = timestamps.filter(
        (timestamp2) => now - timestamp2 < RATE_LIMIT_WINDOW2
      );
      if (validTimestamps.length === 0) {
        this.rateLimits.delete(userId);
      } else {
        this.rateLimits.set(userId, validTimestamps);
      }
    }
  }
};
var storage = new MemStorage();

// server/routes.ts
import { z as z2 } from "zod";

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey(),
  role: text("role", { enum: ["client", "driver", "admin"] }).notNull().default("client"),
  name: text("name"),
  phone: text("phone"),
  telegramAvatarUrl: text("telegram_avatar_url"),
  isBlocked: boolean("is_blocked").default(false),
  warnings: text("warnings").array().default([]),
  bonuses: text("bonuses").array().default([])
});
var orders = pgTable("orders", {
  orderId: varchar("order_id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type", { enum: ["taxi", "cargo", "courier", "towing"] }).notNull(),
  clientId: varchar("client_id").notNull(),
  driverId: varchar("driver_id"),
  from: text("from").notNull(),
  to: text("to").notNull(),
  comment: text("comment"),
  requiredDetail: text("required_detail"),
  status: text("status", {
    enum: ["pending", "accepted", "in_progress", "completed", "cancelled"]
  }).notNull().default("pending"),
  price: real("price"),
  distanceKm: real("distance_km"),
  createdAt: timestamp("created_at").defaultNow()
});
var accessCodes = pgTable("access_codes", {
  code: varchar("code").primaryKey(),
  isUsed: boolean("is_used").default(false),
  issuedBy: varchar("issued_by").notNull(),
  usedBy: varchar("used_by"),
  createdAt: timestamp("created_at").defaultNow()
});
var chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var ratings = pgTable("ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  driverId: varchar("driver_id").notNull(),
  stars: integer("stars").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertUserSchema = createInsertSchema(users).omit({
  warnings: true,
  bonuses: true
});
var insertOrderSchema = createInsertSchema(orders).omit({
  orderId: true,
  createdAt: true,
  status: true,
  driverId: true
}).extend({
  type: z.enum(["taxi", "cargo", "courier", "towing"]),
  from: z.string().min(1),
  to: z.string().min(1),
  clientId: z.string().min(1),
  comment: z.string().optional(),
  requiredDetail: z.string().optional(),
  price: z.number().optional(),
  distanceKm: z.number().optional()
});
var insertAccessCodeSchema = createInsertSchema(accessCodes).omit({
  createdAt: true
});
var insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true
});
var insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  createdAt: true
}).extend({
  stars: z.number().min(1).max(5),
  comment: z.string().optional()
});

// server/middleware/rate-limit.ts
var RATE_LIMIT_WINDOW = 6e4;
var MAX_ORDERS_PER_MINUTE = 5;
var rateLimiter = /* @__PURE__ */ new Map();
function checkRateLimit(userId) {
  const now = Date.now();
  if (!rateLimiter.has(userId)) {
    rateLimiter.set(userId, []);
  }
  const userTimestamps = rateLimiter.get(userId);
  const validTimestamps = userTimestamps.filter(
    (timestamp2) => now - timestamp2 < RATE_LIMIT_WINDOW
  );
  rateLimiter.set(userId, validTimestamps);
  if (validTimestamps.length >= MAX_ORDERS_PER_MINUTE) {
    return {
      allowed: false,
      message: "\u23F1\uFE0F \u0417\u0430\u0431\u0430\u0433\u0430\u0442\u043E \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u044C! \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u0445\u0432\u0438\u043B\u0438\u043D\u0443."
    };
  }
  validTimestamps.push(now);
  rateLimiter.set(userId, validTimestamps);
  return { allowed: true };
}
var ADMIN_IDS = ["admin1", "7677921905"];
function rateLimitMiddleware(req, res, next) {
  const internalRequest = req.headers["x-internal-request"];
  if (internalRequest) {
    next();
    return;
  }
  let userId;
  if (req.body && typeof req.body === "object") {
    userId = req.body.clientId || req.body.userId;
  }
  if (!userId) {
    userId = req.ip || req.socket.remoteAddress || "unknown";
  }
  if (ADMIN_IDS.includes(userId)) {
    next();
    return;
  }
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    res.status(429).json({ error: rateCheck.message });
    return;
  }
  next();
}

// server/routes.ts
async function registerRoutes(app2) {
  app2.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  });
  app2.post("/api/users", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const user = await storage.createUser(data);
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });
  app2.patch("/api/users/:id", async (req, res) => {
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
  app2.post("/api/users/register-driver", async (req, res) => {
    try {
      const schema = z2.object({
        userId: z2.string(),
        code: z2.string(),
        name: z2.string(),
        phone: z2.string()
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
  app2.get("/api/orders/active", async (req, res) => {
    const orders2 = await storage.getActiveOrders();
    res.json(orders2);
  });
  app2.get("/api/orders/:id", async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  });
  app2.get("/api/orders/client/:clientId", async (req, res) => {
    const orders2 = await storage.getOrdersByClient(req.params.clientId);
    res.json(orders2);
  });
  app2.get("/api/orders/driver/:driverId", async (req, res) => {
    const orders2 = await storage.getOrdersByDriver(req.params.driverId);
    res.json(orders2);
  });
  app2.post("/api/orders", rateLimitMiddleware, async (req, res) => {
    try {
      const data = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(data);
      res.status(201).json(order);
    } catch (error) {
      res.status(400).json({ error: "Invalid order data" });
    }
  });
  app2.post("/api/orders/:id/accept", async (req, res) => {
    try {
      const schema = z2.object({
        driverId: z2.string()
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
  app2.patch("/api/orders/:id", async (req, res) => {
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
  app2.post("/api/orders/:id/rate", async (req, res) => {
    try {
      const schema = z2.object({
        stars: z2.number().min(1).max(5),
        comment: z2.string().optional()
      });
      const data = schema.parse(req.body);
      const success = await storage.rateOrder(req.params.id, data.stars, data.comment);
      if (!success) {
        return res.status(400).json({ error: "Cannot rate order" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid rating data" });
    }
  });
  app2.get("/api/drivers/:id/stats", async (req, res) => {
    try {
      const stats = await storage.getDriverStats(req.params.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Cannot retrieve driver stats" });
    }
  });
  app2.get("/api/drivers/:id/badges", async (req, res) => {
    try {
      const badges = await storage.getDriverBadges(req.params.id);
      res.json({ badges });
    } catch (error) {
      res.status(500).json({ error: "Cannot retrieve driver badges" });
    }
  });
  app2.get("/api/admin/drivers", async (req, res) => {
    const drivers = await storage.getAllDrivers();
    res.json(drivers);
  });
  app2.post("/api/admin/generate-code", async (req, res) => {
    try {
      const schema = z2.object({
        adminId: z2.string()
      });
      const data = schema.parse(req.body);
      const code = await storage.generateAccessCode(data.adminId);
      res.status(201).json(code);
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });
  app2.post("/api/admin/drivers/:id/block", async (req, res) => {
    try {
      const driver = await storage.getUser(req.params.id);
      if (!driver || driver.role !== "driver") {
        return res.status(404).json({ error: "Driver not found" });
      }
      const updated = await storage.updateUser(req.params.id, {
        isBlocked: !driver.isBlocked
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Cannot block driver" });
    }
  });
  app2.post("/api/admin/drivers/:id/warning", async (req, res) => {
    try {
      const schema = z2.object({
        text: z2.string()
      });
      const data = schema.parse(req.body);
      const driver = await storage.getUser(req.params.id);
      if (!driver || driver.role !== "driver") {
        return res.status(404).json({ error: "Driver not found" });
      }
      const warnings = driver.warnings || [];
      const updated = await storage.updateUser(req.params.id, {
        warnings: [...warnings, data.text]
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Cannot add warning" });
    }
  });
  app2.post("/api/admin/drivers/:id/bonus", async (req, res) => {
    try {
      const schema = z2.object({
        text: z2.string()
      });
      const data = schema.parse(req.body);
      const driver = await storage.getUser(req.params.id);
      if (!driver || driver.role !== "driver") {
        return res.status(404).json({ error: "Driver not found" });
      }
      const bonuses = driver.bonuses || [];
      const updated = await storage.updateUser(req.params.id, {
        bonuses: [...bonuses, data.text]
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Cannot add bonus" });
    }
  });
  app2.get("/api/chat/:orderId", async (req, res) => {
    const messages = await storage.getChatMessages(req.params.orderId);
    res.json(messages);
  });
  app2.post("/api/chat", async (req, res) => {
    try {
      const data = insertChatMessageSchema.parse(req.body);
      const message = await storage.sendChatMessage(data);
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ error: "Invalid message data" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/telegram-bot.ts
import TelegramBot from "node-telegram-bot-api";
var ADMIN_ID = process.env.ADMIN_ID || "7677921905";
var WEB_APP_URL = process.env.WEB_APP_URL || process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : `http://localhost:${process.env.PORT || 5e3}`;
function initTelegramBot(storage2) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) {
    console.log("\u26A0\uFE0F  TELEGRAM_BOT_TOKEN not set. Bot features disabled.");
    return null;
  }
  const bot = new TelegramBot(TOKEN, { polling: true });
  console.log("\u2705 Telegram bot initialized successfully");
  async function getOrCreateUser(userId, username) {
    let user = await storage2.getUser(userId);
    if (!user) {
      const role = String(userId) === String(ADMIN_ID) ? "admin" : "client";
      user = await storage2.createUser({
        id: userId,
        role,
        name: username || null,
        phone: null,
        telegramAvatarUrl: null
      });
    }
    if (String(userId) === String(ADMIN_ID) && user.role !== "admin") {
      user = await storage2.updateUser(userId, { role: "admin" }) || user;
    }
    return user;
  }
  async function getAllDriversList() {
    const drivers = await storage2.getAllDrivers();
    const admins = await Promise.all(
      [ADMIN_ID].map((id) => storage2.getUser(String(id)))
    );
    const allDrivers = [
      ...drivers.map((d) => ({ ...d, isAdmin: false })),
      ...admins.filter(Boolean).map((a) => ({ ...a, isAdmin: true }))
    ].filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i);
    if (allDrivers.length === 0) {
      return "";
    }
    return allDrivers.map((driver) => {
      const roleLabel = driver.isAdmin ? "\u{1F451}" : "\u{1F696}";
      const name = driver.name || "\u0411\u0435\u0437 \u0456\u043C\u0435\u043D\u0456";
      return `${roleLabel} \u{1F194} <code>${driver.id}</code> \u2014 ${name}`;
    }).join("\n");
  }
  async function getDriverStats(driverId) {
    const stats = await storage2.getDriverStats(driverId);
    const orders2 = await storage2.getOrdersByDriver(driverId);
    const completedOrders = orders2.filter((o) => o.status === "completed");
    const earnings = completedOrders.reduce((sum, o) => sum + (o.price || 0), 0);
    return {
      completedOrders: stats.completedOrders,
      totalRatings: stats.totalRatings,
      averageRating: stats.totalRatings > 0 ? stats.averageRating.toFixed(1) : "N/A",
      earnings
    };
  }
  async function getAdminStats() {
    const allOrders = await storage2.getAllOrders();
    const drivers = await storage2.getAllDrivers();
    const allRatings = await storage2.getAllRatings();
    const completedOrders = allOrders.filter((o) => o.status === "completed");
    const pendingOrders = allOrders.filter((o) => o.status === "pending");
    const totalRatings = allRatings.length;
    const averageRating = totalRatings > 0 ? allRatings.reduce((sum, r) => sum + r.stars, 0) / totalRatings : 0;
    return {
      totalOrders: allOrders.length,
      completedOrders: completedOrders.length,
      activeDrivers: drivers.length,
      pendingOrders: pendingOrders.length,
      averageRating: totalRatings > 0 ? averageRating.toFixed(1) : "N/A"
    };
  }
  function generateDriverCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  async function createDriverCode(adminId) {
    let code;
    let attempts = 0;
    do {
      code = generateDriverCode();
      const existing = await storage2.validateAccessCode(code);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);
    const accessCode = await storage2.generateAccessCode(adminId);
    return accessCode.code;
  }
  async function getUnusedCodes() {
    return [];
  }
  function isAdmin(userId) {
    return String(userId) === String(ADMIN_ID);
  }
  bot.onText(/\/start/, async (msg) => {
    const userId = String(msg.from.id);
    const user = await getOrCreateUser(userId, msg.from.first_name);
    const firstName = user.name || msg.from.first_name || "\u0434\u0440\u0443\u0436\u0435";
    let text2 = "";
    let keyboard = [];
    if (user.role === "admin") {
      text2 = `\u0412\u0456\u0442\u0430\u044E, ${firstName}! \u{1F451}

\u0412\u0438 \u0410\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440 \u0456 \u0412\u043E\u0434\u0456\u0439.

<b>\u041A\u043E\u043C\u0430\u043D\u0434\u0438:</b>
/generate - \u0417\u0433\u0435\u043D\u0435\u0440\u0443\u0432\u0430\u0442\u0438 \u043A\u043E\u0434\u0438
/codes - \u041D\u0435\u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u0456 \u043A\u043E\u0434\u0438
/drivers - \u0421\u043F\u0438\u0441\u043E\u043A \u0432\u043E\u0434\u0456\u0457\u0432
/stats - \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430
/setname ID \u0406\u041C'\u042F - \u0417\u043C\u0456\u043D\u0438\u0442\u0438 \u0456\u043C'\u044F`;
      keyboard = [
        [{ text: "\u{1F4BC} \u042F \u0432\u043E\u0434\u0456\u0439", web_app: { url: WEB_APP_URL + "/driver.html" } }],
        [{ text: "\u{1F64B}\u200D\u2642\uFE0F \u042F \u043A\u043B\u0456\u0454\u043D\u0442", web_app: { url: WEB_APP_URL + "/client.html" } }],
        [{ text: "\u{1F4CA} \u041F\u0430\u043D\u0435\u043B\u044C \u0430\u0434\u043C\u0456\u043D\u0430", web_app: { url: WEB_APP_URL + "/admin.html" } }]
      ];
    } else if (user.role === "driver") {
      text2 = `\u041F\u0440\u0438\u0432\u0456\u0442, ${firstName}! \u{1F696}

\u0412\u0438 \u0432\u043E\u0434\u0456\u0439. \u041F\u0440\u0438\u0439\u043C\u0430\u0439\u0442\u0435 \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u0442\u0430 \u0437\u0430\u0440\u043E\u0431\u043B\u044F\u0439\u0442\u0435!`;
      keyboard = [
        [{ text: "\u{1F4BC} \u041F\u0440\u0438\u0439\u043C\u0430\u0442\u0438 \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F", web_app: { url: WEB_APP_URL + "/driver.html" } }],
        [{ text: "\u{1F64B}\u200D\u2642\uFE0F \u0417\u0430\u043C\u043E\u0432\u0438\u0442\u0438 \u0434\u043B\u044F \u0441\u0435\u0431\u0435", web_app: { url: WEB_APP_URL + "/client.html" } }]
      ];
    } else {
      text2 = `\u0412\u0456\u0442\u0430\u0454\u043C\u043E, ${firstName}! \u{1F389}

\u{1F696} \u0428\u0432\u0438\u0434\u043A\u043E, \u0437\u0440\u0443\u0447\u043D\u043E, \u043D\u0430\u0434\u0456\u0439\u043D\u043E!

\u0414\u043B\u044F \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u0457 \u044F\u043A \u0432\u043E\u0434\u0456\u0439 - \u0432\u0432\u0435\u0434\u0456\u0442\u044C \u043A\u043E\u0434 \u0434\u043E\u0441\u0442\u0443\u043F\u0443 (8 \u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432).`;
      keyboard = [[{ text: "\u{1F4F1} \u0417\u0430\u043C\u043E\u0432\u0438\u0442\u0438 \u043F\u043E\u0441\u043B\u0443\u0433\u0443", web_app: { url: WEB_APP_URL + "/client.html" } }]];
    }
    await bot.sendMessage(msg.chat.id, text2, {
      parse_mode: "HTML",
      reply_markup: { keyboard, resize_keyboard: true }
    });
  });
  bot.onText(/\/stats/, async (msg) => {
    if (!isAdmin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, "\u274C \u0426\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u0456\u043B\u044C\u043A\u0438 \u0434\u043B\u044F \u0430\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0456\u0432");
      return;
    }
    const stats = await getAdminStats();
    const text2 = `\u{1F4CA} <b>\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430:</b>

\u0412\u0441\u044C\u043E\u0433\u043E \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u044C: ${stats.totalOrders}
\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E: ${stats.completedOrders}
\u041E\u0447\u0456\u043A\u0443\u044E\u0442\u044C: ${stats.pendingOrders}
\u0410\u043A\u0442\u0438\u0432\u043D\u0438\u0445 \u0432\u043E\u0434\u0456\u0457\u0432: ${stats.activeDrivers}
\u0421\u0435\u0440\u0435\u0434\u043D\u0456\u0439 \u0440\u0435\u0439\u0442\u0438\u043D\u0433: ${stats.averageRating}`;
    await bot.sendMessage(msg.chat.id, text2, { parse_mode: "HTML" });
  });
  bot.onText(/\/drivers/, async (msg) => {
    if (!isAdmin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, "\u274C \u0426\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u0456\u043B\u044C\u043A\u0438 \u0434\u043B\u044F \u0430\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0456\u0432");
      return;
    }
    const list = await getAllDriversList();
    const text2 = list ? `\u{1F4CB} <b>\u0412\u043E\u0434\u0456\u0457:</b>

${list}` : "\u{1F4CB} \u0412\u043E\u0434\u0456\u0457\u0432 \u043D\u0435\u043C\u0430\u0454";
    await bot.sendMessage(msg.chat.id, text2, { parse_mode: "HTML" });
  });
  bot.onText(/\/setname (\S+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, "\u274C \u0426\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u0456\u043B\u044C\u043A\u0438 \u0434\u043B\u044F \u0430\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0456\u0432");
      return;
    }
    if (!match) return;
    const targetId = match[1];
    const newName = match[2];
    const updated = await storage2.updateUser(targetId, { name: newName });
    if (updated) {
      await bot.sendMessage(msg.chat.id, `\u2705 \u0406\u043C'\u044F \u0437\u043C\u0456\u043D\u0435\u043D\u043E \u043D\u0430: <b>${newName}</b>`, { parse_mode: "HTML" });
    } else {
      await bot.sendMessage(msg.chat.id, "\u274C \u041A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E", { parse_mode: "HTML" });
    }
  });
  bot.onText(/\/generate(?:\s+(\d+))?/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, "\u274C \u0426\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u0456\u043B\u044C\u043A\u0438 \u0434\u043B\u044F \u0430\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0456\u0432");
      return;
    }
    const count = Math.min(10, Math.max(1, parseInt(match?.[1] || "1")));
    const adminId = String(msg.from.id);
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = await createDriverCode(adminId);
      codes.push(code);
    }
    const codesList = codes.map((c) => `<code>${c}</code>`).join("\n");
    await bot.sendMessage(msg.chat.id, `\u2705 <b>\u041A\u043E\u0434\u0438 (${count}):</b>

${codesList}`, { parse_mode: "HTML" });
  });
  bot.onText(/\/codes/, async (msg) => {
    if (!isAdmin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, "\u274C \u0426\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u0456\u043B\u044C\u043A\u0438 \u0434\u043B\u044F \u0430\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0456\u0432");
      return;
    }
    const unused = await getUnusedCodes();
    if (unused.length === 0) {
      await bot.sendMessage(msg.chat.id, "\u{1F4CB} \u041D\u0435\u043C\u0430\u0454 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0438\u0445 \u043A\u043E\u0434\u0456\u0432.\n\n\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u0439\u0442\u0435 /generate \u0434\u043B\u044F \u0441\u0442\u0432\u043E\u0440\u0435\u043D\u043D\u044F \u043D\u043E\u0432\u0438\u0445 \u043A\u043E\u0434\u0456\u0432.", { parse_mode: "HTML" });
      return;
    }
    const list = unused.map((c) => `\u{1F3AB} <code>${c}</code>`).join("\n");
    await bot.sendMessage(msg.chat.id, `\u{1F4CB} <b>\u041A\u043E\u0434\u0438 (${unused.length}):</b>

${list}`, { parse_mode: "HTML" });
  });
  bot.on("callback_query", async (query) => {
    if (!isAdmin(query.from.id)) {
      await bot.answerCallbackQuery(query.id, { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043D\u044C\u043E \u043F\u0440\u0430\u0432" });
      return;
    }
    const data = query.data;
    if (!data) return;
    const [action, targetId] = data.split("_");
    if (action === "approve") {
      await storage2.updateUser(targetId, { role: "driver" });
      await bot.sendMessage(parseInt(targetId), "\u2705 \u0421\u0445\u0432\u0430\u043B\u0435\u043D\u043E! \u0412\u0438 \u0442\u0435\u043F\u0435\u0440 \u0432\u043E\u0434\u0456\u0439. \u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439\u0442\u0435 /start \u0434\u043B\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u0443 \u0434\u043E \u043F\u0430\u043D\u0435\u043B\u0456 \u0432\u043E\u0434\u0456\u044F.");
      await bot.answerCallbackQuery(query.id, { text: "\u2705 \u0412\u043E\u0434\u0456\u044F \u0441\u0445\u0432\u0430\u043B\u0435\u043D\u043E" });
    } else if (action === "reject") {
      await storage2.updateUser(targetId, { role: "client" });
      await bot.sendMessage(parseInt(targetId), "\u274C \u0417\u0430\u044F\u0432\u043A\u0443 \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043E. \u0412\u0438 \u0437\u0430\u043B\u0438\u0448\u0430\u0454\u0442\u0435\u0441\u044C \u043A\u043B\u0456\u0454\u043D\u0442\u043E\u043C.");
      await bot.answerCallbackQuery(query.id, { text: "\u274C \u0417\u0430\u044F\u0432\u043A\u0443 \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043E" });
    }
  });
  bot.on("message", async (msg) => {
    if (msg.text && msg.text.startsWith("/")) return;
    const senderId = String(msg.from.id);
    const messageText = msg.text;
    if (messageText && messageText.length === 8 && /^[A-Z0-9]+$/i.test(messageText)) {
      const user = await getOrCreateUser(senderId, msg.from.first_name);
      if (user.role !== "client") {
        return;
      }
      const codeUpper = messageText.toUpperCase();
      const validation = await storage2.validateAccessCode(codeUpper);
      if (!validation || validation.isUsed) {
        await bot.sendMessage(msg.chat.id, "\u274C \u041D\u0435\u0432\u0456\u0440\u043D\u0438\u0439 \u0430\u0431\u043E \u0432\u0436\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u0438\u0439 \u043A\u043E\u0434!", { parse_mode: "HTML" });
        return;
      }
      const firstName = msg.from.first_name || "\u041A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447";
      await bot.sendMessage(msg.chat.id, "\u2705 \u041A\u043E\u0434 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043E! \u041E\u0447\u0456\u043A\u0443\u0439\u0442\u0435 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F \u0430\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430.", { parse_mode: "HTML" });
      await bot.sendMessage(parseInt(ADMIN_ID), `\u{1F514} <b>\u041D\u043E\u0432\u0430 \u0437\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u0440\u043E\u043B\u044C \u0432\u043E\u0434\u0456\u044F:</b>

\u{1F464} ${firstName}
\u{1F194} <code>${senderId}</code>
\u{1F3AB} \u041A\u043E\u0434: <code>${codeUpper}</code>`, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "\u2705 \u0421\u0445\u0432\u0430\u043B\u0438\u0442\u0438", callback_data: `approve_${senderId}` },
            { text: "\u274C \u0412\u0456\u0434\u0445\u0438\u043B\u0438\u0442\u0438", callback_data: `reject_${senderId}` }
          ]]
        }
      });
      await storage2.markCodeAsUsed(codeUpper, senderId);
    }
  });
  bot.on("polling_error", (error) => {
    if (error.code === "ETELEGRAM" && error.response?.body?.error_code === 409) {
      console.log("\u26A0\uFE0F  Telegram bot polling conflict detected. Another instance may be running. Stopping polling...");
      bot.stopPolling();
    } else {
      console.error("Telegram bot polling error:", error.message);
    }
  });
  return bot;
}

// server/app.ts
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
var app = express();
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path2 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path2.startsWith("/api")) {
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
async function runApp(setup) {
  const server = await registerRoutes(app);
  const bot = initTelegramBot(storage);
  if (bot) {
    log("Telegram bot initialized successfully", "telegram");
  }
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  await setup(app, server);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
}

// server/index-prod.ts
async function serveStatic(app2, _server) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
(async () => {
  await runApp(serveStatic);
})();
export {
  serveStatic
};
