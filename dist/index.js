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
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.orders = /* @__PURE__ */ new Map();
    this.accessCodes = /* @__PURE__ */ new Map();
    this.chatMessages = /* @__PURE__ */ new Map();
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
  async getActiveOrders() {
    return Array.from(this.orders.values()).filter(
      (order) => order.status === "new" || order.status === "bidding"
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
      status: "new",
      driverId: null,
      driverBidPrice: null,
      isTaken: false,
      proposalAttempts: [],
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
    if (!order) return void 0;
    if (order.isTaken && order.driverId !== driverId) {
      return void 0;
    }
    const driver = await this.getUser(driverId);
    if (!driver || driver.role !== "driver" || driver.isBlocked) {
      return void 0;
    }
    if (order.proposalAttempts.includes(driverId)) {
      return void 0;
    }
    const updatedOrder = {
      ...order,
      driverId,
      isTaken: true,
      status: "bidding"
    };
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }
  async proposeBid(orderId, driverId, price) {
    const order = this.orders.get(orderId);
    if (!order || order.driverId !== driverId || order.status !== "bidding") {
      return void 0;
    }
    const updatedOrder = {
      ...order,
      driverBidPrice: price
    };
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }
  async respondToBid(orderId, clientId, accepted) {
    const order = this.orders.get(orderId);
    if (!order || order.clientId !== clientId || order.status !== "bidding") {
      return void 0;
    }
    if (accepted) {
      const updatedOrder = {
        ...order,
        status: "in_progress"
      };
      this.orders.set(orderId, updatedOrder);
      return updatedOrder;
    } else {
      const updatedOrder = {
        ...order,
        driverId: null,
        driverBidPrice: null,
        isTaken: false,
        status: "new",
        proposalAttempts: [...order.proposalAttempts, order.driverId]
      };
      this.orders.set(orderId, updatedOrder);
      return updatedOrder;
    }
  }
  // Access Code methods
  async generateAccessCode(issuedBy) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
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
};
var storage = new MemStorage();

// server/routes.ts
import { z as z2 } from "zod";

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, real } from "drizzle-orm/pg-core";
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
    enum: ["new", "bidding", "accepted", "in_progress", "rejected_by_client", "completed"]
  }).notNull().default("new"),
  driverBidPrice: real("driver_bid_price"),
  isTaken: boolean("is_taken").default(false),
  proposalAttempts: text("proposal_attempts").array().default([]),
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
var insertUserSchema = createInsertSchema(users).omit({
  warnings: true,
  bonuses: true
});
var insertOrderSchema = createInsertSchema(orders).omit({
  orderId: true,
  createdAt: true,
  status: true,
  driverId: true,
  driverBidPrice: true,
  isTaken: true,
  proposalAttempts: true
}).extend({
  type: z.enum(["taxi", "cargo", "courier", "towing"]),
  from: z.string().min(1),
  to: z.string().min(1),
  clientId: z.string().min(1),
  comment: z.string().optional(),
  requiredDetail: z.string().optional()
});
var insertAccessCodeSchema = createInsertSchema(accessCodes).omit({
  createdAt: true
});
var insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true
});

// server/telegram.ts
var TELEGRAM_API = "https://api.telegram.org";
var BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
async function handleTelegramUpdate(update) {
  if (!update.message) return;
  const message = update.message;
  if (!message.text) return;
  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const firstName = message.from.first_name;
  const text2 = message.text.trim();
  try {
    if (text2 === "/start") {
      await sendTelegramMessage(
        chatId,
        `\u{1F44B} \u041F\u0440\u0438\u0432\u0456\u0442, ${firstName}!

\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u0443\u0432\u0430\u0442\u0438 \u0434\u043E \u0422\u0430\u043A\u0441\u0456-\u0421\u0435\u0440\u0432\u0456\u0441\u0443!

\u0412\u0438\u0431\u0435\u0440\u0456\u0442\u044C \u0432\u0430\u0448\u0443 \u0440\u043E\u043B\u044C:
\u{1F696} \u041A\u043B\u0456\u0454\u043D\u0442
\u{1F697} \u0412\u043E\u0434\u0456\u0439
\u{1F6E1}\uFE0F \u0410\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440 (\u043F\u0430\u0440\u043E\u043B\u044C \u0437\u0430\u0445\u0438\u0449\u0435\u043D\u043E)

\u0422\u0430\u043F\u043D\u0438 \u043A\u043D\u043E\u043F\u043A\u0443 \u043D\u0438\u0436\u0447\u0435, \u0449\u043E\u0431 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u0434\u043E\u0434\u0430\u0442\u043E\u043A:`,
        [
          [
            {
              text: "\u{1F680} \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u0434\u043E\u0434\u0430\u0442\u043E\u043A",
              web_app: {
                url: process.env.APP_URL || "https://localhost:5000"
              }
            }
          ]
        ]
      );
      return;
    }
    if (text2 === "/generate_code") {
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        await sendTelegramMessage(
          chatId,
          "\u274C \u0412\u0438 \u043D\u0435 \u043C\u0430\u0454\u0442\u0435 \u043F\u0440\u0430\u0432 \u0434\u043B\u044F \u0446\u0456\u0454\u0457 \u043A\u043E\u043C\u0430\u043D\u0434\u0438. \u0422\u0456\u043B\u044C\u043A\u0438 \u0430\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0438 \u043C\u043E\u0436\u0443\u0442\u044C \u0433\u0435\u043D\u0435\u0440\u0443\u0432\u0430\u0442\u0438 \u043A\u043E\u0434\u0438."
        );
        return;
      }
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await storage.generateAccessCode(userId);
      await sendTelegramMessage(
        chatId,
        `\u2705 \u041D\u043E\u0432\u0438\u0439 \u043A\u043E\u0434 \u0434\u043E\u0441\u0442\u0443\u043F\u0443 \u0441\u0433\u0435\u043D\u0435\u0440\u043E\u0432\u0430\u043D\u0438\u0439:

\u{1F511} <code>${code}</code>

\u041F\u043E\u0434\u0456\u043B\u0456\u0442\u044C\u0441\u044F \u0446\u0438\u043C \u043A\u043E\u0434\u043E\u043C \u0437 \u0432\u043E\u0434\u0456\u0454\u043C \u0434\u043B\u044F \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u0457.`,
        void 0,
        { parse_mode: "HTML" }
      );
      return;
    }
    if (text2 === "/help") {
      await sendTelegramMessage(
        chatId,
        `\u{1F4D6} \u0414\u043E\u0441\u0442\u0443\u043F\u043D\u0456 \u043A\u043E\u043C\u0430\u043D\u0434\u0438:

/start - \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u0434\u043E\u0434\u0430\u0442\u043E\u043A
/help - \u0426\u0435\u0439 \u043F\u0443\u043D\u043A\u0442
/generate_code - \u0413\u0435\u043D\u0435\u0440\u0443\u0432\u0430\u0442\u0438 \u043A\u043E\u0434 \u0434\u043E\u0441\u0442\u0443\u043F\u0443 (\u0442\u0456\u043B\u044C\u043A\u0438 \u0434\u043B\u044F \u0430\u0434\u043C\u0456\u043D\u0430)

\u{1F3AF} \u041D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C \u043A\u043D\u043E\u043F\u043A\u0443 "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u0434\u043E\u0434\u0430\u0442\u043E\u043A" \u0434\u043B\u044F \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043D\u044F \u043F\u043E\u0432\u043D\u043E\u0433\u043E \u0434\u043E\u0441\u0442\u0443\u043F\u0443.`
      );
      return;
    }
    await sendTelegramMessage(
      chatId,
      `\u042F \u043D\u0435 \u0440\u043E\u0437\u0443\u043C\u0456\u044E \u0446\u044E \u043A\u043E\u043C\u0430\u043D\u0434\u0443. \u0412\u0432\u0435\u0434\u0456\u0442\u044C /help \u0434\u043B\u044F \u0441\u043F\u0438\u0441\u043A\u0443 \u043A\u043E\u043C\u0430\u043D\u0434.`
    );
  } catch (error) {
    console.error("Telegram update error:", error);
    await sendTelegramMessage(
      chatId,
      "\u274C \u0421\u0442\u0430\u043B\u0430\u0441\u044F \u043F\u043E\u043C\u0438\u043B\u043A\u0430. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u0456\u0437\u043D\u0456\u0448\u0435."
    ).catch(() => {
    });
  }
}
async function sendTelegramMessage(chatId, text2, replyMarkup, options) {
  if (!BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return;
  }
  try {
    const payload = {
      chat_id: chatId,
      text: text2,
      parse_mode: "Markdown",
      ...options
    };
    if (replyMarkup) {
      payload.reply_markup = {
        inline_keyboard: replyMarkup
      };
    }
    const response = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      console.error("Telegram API error:", await response.text());
    }
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}
async function setWebhook(url) {
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
          allowed_updates: ["message"]
        })
      }
    );
    const result = await response.json();
    if (result.ok) {
      console.log(`\u2705 Telegram webhook configured: ${webhookUrl}`);
    } else {
      console.error("\u274C Webhook error:", result.description);
    }
    return result.ok;
  } catch (error) {
    console.error("Error setting Telegram webhook:", error);
    return false;
  }
}
var webhookSetupPromise = null;
async function autoSetupWebhook(baseUrl) {
  if (!BOT_TOKEN) {
    return false;
  }
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
async function getBotInfo() {
  if (!BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return null;
  }
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/getMe`);
    const data = await response.json();
    if (data.ok) {
      console.log(`\u2705 Telegram Bot Connected: @${data.result.username}`);
      return data.result;
    }
    return null;
  } catch (error) {
    console.error("Error getting bot info:", error);
    return null;
  }
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
  app2.post("/api/orders", async (req, res) => {
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
  app2.post("/api/orders/:id/bid", async (req, res) => {
    try {
      const schema = z2.object({
        driverId: z2.string(),
        price: z2.number().positive()
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
  app2.post("/api/orders/:id/respond", async (req, res) => {
    try {
      const schema = z2.object({
        clientId: z2.string(),
        accepted: z2.boolean()
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
  app2.post("/api/telegram/webhook", async (req, res) => {
    try {
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
  await getBotInfo();
  const httpServer = createServer(app2);
  return httpServer;
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
