import {
  users, orders, accessCodes, chatMessages, ratings,
  type User, type InsertUser, type Order, type InsertOrder,
  type AccessCode, type ChatMessage, type InsertChatMessage, type Rating
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface Tariff {
  type: string;
  basePrice: number;
  perKm: number;
}

interface NotificationRecord {
  chatId: string;
  messageId: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllDrivers(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  registerDriverWithCode(userId: string, code: string, name: string, phone: string): Promise<User | null>;
  updateBalance(userId: string, amount: number): Promise<User | undefined>;

  getOrder(orderId: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getActiveOrders(): Promise<Order[]>;
  getOrdersByClient(clientId: string): Promise<Order[]>;
  getOrdersByDriver(driverId: string): Promise<Order[]>;
  getDriverCurrentOrder(driverId: string): Promise<Order | undefined>;
  
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | undefined>;
  acceptOrder(orderId: string, driverId: string, distanceKm?: number): Promise<Order | undefined>;
  releaseOrder(orderId: string): Promise<Order | undefined>;
  completeOrder(orderId: string): Promise<Order | undefined>;

  addOrderNotification(orderId: string, chatId: string, messageId: number): Promise<void>;
  getOrderNotifications(orderId: string): Promise<NotificationRecord[]>;

  getTariffs(): Promise<Tariff[]>;
  updateTariff(type: string, basePrice: number, perKm: number): Promise<void>;

  generateAccessCode(issuedBy: string): Promise<AccessCode>;
  validateAccessCode(code: string): Promise<AccessCode | undefined>;
  markCodeAsUsed(code: string, userId: string): Promise<boolean>;
  getChatMessages(orderId: string): Promise<ChatMessage[]>;
  sendChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  rateOrder(orderId: string, stars: number, comment?: string): Promise<boolean>;
  getAllRatings(): Promise<Rating[]>;
  getDriverStats(driverId: string): Promise<{completedOrders: number, totalRatings: number, averageRating: number}>;
  getDriverBadges(driverId: string): Promise<string | null>;
}

export class DatabaseStorage implements IStorage {
  // Тимчасове сховище для тарифів і повідомлень (бо їх простіше тримати в пам'яті для швидкості, або треба створити таблиці)
  // Для простоти поки залишимо тарифи в пам'яті, але це скидатиметься. 
  // Краще захардкодити дефолтні значення.
  private tariffs: Map<string, Tariff>;
  private orderNotifications: Map<string, NotificationRecord[]>;

  constructor() {
    this.tariffs = new Map();
    this.orderNotifications = new Map();
    
    this.tariffs.set("taxi", { type: "taxi", basePrice: 100, perKm: 25 });
    this.tariffs.set("cargo", { type: "cargo", basePrice: 300, perKm: 40 });
    this.tariffs.set("courier", { type: "courier", basePrice: 80, perKm: 20 });
    this.tariffs.set("towing", { type: "towing", basePrice: 500, perKm: 50 });
  }

  // --- USERS ---
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllDrivers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "driver"));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async registerDriverWithCode(userId: string, code: string, name: string, phone: string): Promise<User | null> {
    const accessCode = await this.validateAccessCode(code);
    if (!accessCode || accessCode.isUsed) return null;

    let user = await this.getUser(userId);
    if (!user) {
      user = await this.createUser({ id: userId, role: "driver", name, phone, telegramAvatarUrl: null });
    } else {
      user = await this.updateUser(userId, { role: "driver", name, phone });
    }
    
    if (user) await this.markCodeAsUsed(code, userId);
    return user || null;
  }

  async updateBalance(userId: string, amount: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    const newBalance = (user.balance || 0) + amount;
    return await this.updateUser(userId, { balance: newBalance });
  }

  // --- ORDERS ---
  async getOrder(orderId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderId, orderId));
    return order;
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async getActiveOrders(): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.status, "pending"));
  }

  async getOrdersByClient(clientId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.clientId, clientId));
  }

  async getOrdersByDriver(driverId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.driverId, driverId));
  }

  async getDriverCurrentOrder(driverId: string): Promise<Order | undefined> {
    // Drizzle doesn't support OR easily in this version without import, doing manual filter for now or simple check
    // Let's fetch active statuses
    const activeStatuses = ["accepted", "arrived", "in_progress"];
    const driverOrders = await this.getOrdersByDriver(driverId);
    return driverOrders.find(o => activeStatuses.includes(o.status));
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    let price = insertOrder.price;
    if (!price && insertOrder.type && insertOrder.distanceKm) {
        const tariff = this.tariffs.get(insertOrder.type);
        if (tariff) price = tariff.basePrice + Math.ceil(insertOrder.distanceKm * tariff.perKm);
    }
    // @ts-ignore
    const [order] = await db.insert(orders).values({ ...insertOrder, price }).returning();
    return order;
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | undefined> {
    const [order] = await db.update(orders).set(updates).where(eq(orders.orderId, orderId)).returning();
    return order;
  }

  async acceptOrder(orderId: string, driverId: string, distanceKm?: number): Promise<Order | undefined> {
    const order = await this.getOrder(orderId);
    if (!order || order.status !== "pending") return undefined;

    let finalPrice = order.price;
    if (distanceKm) {
       const tariff = this.tariffs.get(order.type);
       if (tariff) finalPrice = tariff.basePrice + Math.ceil(distanceKm * tariff.perKm);
    }

    return await this.updateOrder(orderId, { 
      driverId, 
      status: "accepted",
      distanceKm: distanceKm ?? order.distanceKm,
      price: finalPrice ?? order.price
    });
  }

  async releaseOrder(orderId: string): Promise<Order | undefined> {
    return await this.updateOrder(orderId, { status: "pending", driverId: null });
  }

  async completeOrder(orderId: string): Promise<Order | undefined> {
    return await this.updateOrder(orderId, { status: "completed" });
  }

  // --- NOTIFICATIONS (Memory only for now) ---
  async addOrderNotification(orderId: string, chatId: string, messageId: number): Promise<void> {
    const notifications = this.orderNotifications.get(orderId) || [];
    notifications.push({ chatId, messageId });
    this.orderNotifications.set(orderId, notifications);
  }

  async getOrderNotifications(orderId: string): Promise<NotificationRecord[]> {
    return this.orderNotifications.get(orderId) || [];
  }

  // --- TARIFFS (Memory only) ---
  async getTariffs(): Promise<Tariff[]> { return Array.from(this.tariffs.values()); }
  async updateTariff(type: string, basePrice: number, perKm: number): Promise<void> {
    this.tariffs.set(type, { type, basePrice, perKm });
  }

  // --- CODES ---
  async generateAccessCode(issuedBy: string): Promise<AccessCode> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const [newCode] = await db.insert(accessCodes).values({ code, issuedBy, isUsed: false }).returning();
    return newCode;
  }

  async validateAccessCode(code: string): Promise<AccessCode | undefined> {
    const [accessCode] = await db.select().from(accessCodes).where(eq(accessCodes.code, code));
    return accessCode;
  }

  async markCodeAsUsed(code: string, userId: string): Promise<boolean> {
    await db.update(accessCodes).set({ isUsed: true, usedBy: userId }).where(eq(accessCodes.code, code));
    return true;
  }

  // --- CHAT ---
  async getChatMessages(orderId: string): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages).where(eq(chatMessages.orderId, orderId));
  }

  async sendChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [msg] = await db.insert(chatMessages).values(message).returning();
    return msg;
  }

  // --- RATINGS ---
  async rateOrder(orderId: string, stars: number, comment?: string): Promise<boolean> {
    const order = await this.getOrder(orderId);
    if (!order || !order.driverId) return false;
    
    // Check existing (simplified)
    const [existing] = await db.select().from(ratings).where(eq(ratings.orderId, orderId));
    if (existing) return false;

    await db.insert(ratings).values({
      orderId,
      driverId: order.driverId,
      stars: Math.min(5, Math.max(1, stars)),
      comment
    });
    return true;
  }

  async getAllRatings(): Promise<Rating[]> {
    return await db.select().from(ratings);
  }

  async getDriverStats(driverId: string): Promise<{completedOrders: number, totalRatings: number, averageRating: number}> {
    const driverOrders = await this.getOrdersByDriver(driverId);
    const completedOrders = driverOrders.filter(o => o.status === "completed").length;
    
    const driverRatings = await db.select().from(ratings).where(eq(ratings.driverId, driverId));
    const totalRatings = driverRatings.length;
    const averageRating = totalRatings > 0 
      ? driverRatings.reduce((sum, r) => sum + r.stars, 0) / totalRatings 
      : 0;

    return { completedOrders, totalRatings, averageRating: Math.round(averageRating * 10) / 10 };
  }

  async getDriverBadges(driverId: string): Promise<string | null> {
    const stats = await this.getDriverStats(driverId);
    const badges: string[] = [];
    if (stats.averageRating >= 4.8) badges.push('⭐ Топ-водій');
    if (stats.completedOrders >= 100) badges.push('🏆 Легенда');
    if (stats.completedOrders >= 50) badges.push('🔥 Активний');
    return badges.length > 0 ? badges.join(' ') : null;
  }
}

export const storage = new DatabaseStorage();