import {
  type User,
  type InsertUser,
  type Order,
  type InsertOrder,
  type AccessCode,
  type InsertAccessCode,
  type ChatMessage,
  type InsertChatMessage,
  type Rating,
  type InsertRating,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllDrivers(): Promise<User[]>;
  registerDriverWithCode(userId: string, code: string, name: string, phone: string): Promise<User | null>;

  // Order methods
  getOrder(orderId: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getActiveOrders(): Promise<Order[]>;
  getOrdersByClient(clientId: string): Promise<Order[]>;
  getOrdersByDriver(driverId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | undefined>;
  acceptOrder(orderId: string, driverId: string, distanceKm?: number): Promise<Order | undefined>;

  // Access Code methods
  generateAccessCode(issuedBy: string): Promise<AccessCode>;
  validateAccessCode(code: string): Promise<AccessCode | undefined>;
  markCodeAsUsed(code: string, userId: string): Promise<boolean>;

  // Chat methods
  getChatMessages(orderId: string): Promise<ChatMessage[]>;
  sendChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Rating methods
  rateOrder(orderId: string, stars: number, comment?: string): Promise<boolean>;
  getAllRatings(): Promise<Rating[]>;
  getDriverStats(driverId: string): Promise<{completedOrders: number, totalRatings: number, averageRating: number}>;
  getDriverBadges(driverId: string): Promise<string | null>;

  // Rate limit methods
  getRateLimitTimestamps(userId: string): Promise<number[]>;
  saveRateLimitTimestamps(userId: string, timestamps: number[]): Promise<void>;
  cleanExpiredRateLimits(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private orders: Map<string, Order>;
  private accessCodes: Map<string, AccessCode>;
  private chatMessages: Map<string, ChatMessage[]>;
  private ratings: Map<string, Rating>;
  private rateLimits: Map<string, number[]>;

  constructor() {
    this.users = new Map();
    this.orders = new Map();
    this.accessCodes = new Map();
    this.chatMessages = new Map();
    this.ratings = new Map();
    this.rateLimits = new Map();

    // Create default admins
    this.users.set("admin1", {
      id: "admin1",
      role: "admin",
      name: "Адміністратор",
      phone: "+380501111111",
      telegramAvatarUrl: null,
      isBlocked: false,
      warnings: [],
      bonuses: [],
    });

    // Add Telegram admin
    this.users.set("7677921905", {
      id: "7677921905",
      role: "admin",
      name: "Адміністратор",
      phone: null,
      telegramAvatarUrl: null,
      isBlocked: false,
      warnings: [],
      bonuses: [],
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      ...insertUser,
      isBlocked: false,
      warnings: [],
      bonuses: [],
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getAllDrivers(): Promise<User[]> {
    return Array.from(this.users.values()).filter((user) => user.role === "driver");
  }

  async registerDriverWithCode(
    userId: string,
    code: string,
    name: string,
    phone: string
  ): Promise<User | null> {
    const accessCode = await this.validateAccessCode(code);
    if (!accessCode || accessCode.isUsed) {
      return null;
    }

    // Get or create user with driver role
    let user = await this.getUser(userId);
    if (!user) {
      user = await this.createUser({
        id: userId,
        role: "driver",
        name,
        phone,
        telegramAvatarUrl: null,
      });
    } else {
      // Update existing user to driver role
      user = await this.updateUser(userId, {
        role: "driver",
        name,
        phone,
      });
    }

    if (user) {
      await this.markCodeAsUsed(code, userId);
    }

    return user ?? null;
  }

  // Order methods
  async getOrder(orderId: string): Promise<Order | undefined> {
    return this.orders.get(orderId);
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getActiveOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.status === "pending"
    );
  }

  async getOrdersByClient(clientId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter((order) => order.clientId === clientId);
  }

  async getOrdersByDriver(driverId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter((order) => order.driverId === driverId);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const orderId = randomUUID();
    const order: Order = {
      orderId,
      ...insertOrder,
      status: "pending",
      driverId: null,
      createdAt: new Date(),
    };
    this.orders.set(orderId, order);
    return order;
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;

    const updatedOrder = { ...order, ...updates };
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }

  async acceptOrder(orderId: string, driverId: string, distanceKm?: number): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order || order.status !== "pending") return undefined;

    const driver = await this.getUser(driverId);
    
    // --- ВИПРАВЛЕНО: Дозволяємо і "driver", і "admin" приймати замовлення ---
    if (!driver || (driver.role !== "driver" && driver.role !== "admin") || driver.isBlocked) {
      console.log(`[Storage] Access denied for user ${driverId} with role ${driver?.role}`);
      return undefined;
    }

    const updatedOrder: Order = {
      ...order,
      driverId,
      status: "accepted",
      distanceKm: distanceKm ?? order.distanceKm,
    };
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }

  // Access Code methods
  async generateAccessCode(issuedBy: string): Promise<AccessCode> {
    let code: string;
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

    const accessCode: AccessCode = {
      code,
      isUsed: false,
      issuedBy,
      usedBy: null,
      createdAt: new Date(),
    };
    this.accessCodes.set(code, accessCode);
    return accessCode;
  }

  async validateAccessCode(code: string): Promise<AccessCode | undefined> {
    return this.accessCodes.get(code);
  }

  async markCodeAsUsed(code: string, userId: string): Promise<boolean> {
    const accessCode = this.accessCodes.get(code);
    if (!accessCode || accessCode.isUsed) return false;

    const updatedCode = {
      ...accessCode,
      isUsed: true,
      usedBy: userId,
    };
    this.accessCodes.set(code, updatedCode);
    return true;
  }

  // Chat methods
  async getChatMessages(orderId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(orderId) || [];
  }

  async sendChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = {
      id,
      ...insertMessage,
      createdAt: new Date(),
    };

    const messages = this.chatMessages.get(insertMessage.orderId) || [];
    messages.push(message);
    this.chatMessages.set(insertMessage.orderId, messages);

    return message;
  }

  // Rating methods
  async rateOrder(orderId: string, stars: number, comment?: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order || order.status !== "completed" || !order.driverId) {
      return false;
    }

    // Перевірка чи замовлення вже оцінено
    const existingRating = Array.from(this.ratings.values()).find(
      (rating) => rating.orderId === orderId
    );
    if (existingRating) {
      return false;
    }

    const normalizedStars = Math.min(5, Math.max(1, Math.floor(stars)));
    const ratingId = randomUUID();
    const rating: Rating = {
      id: ratingId,
      orderId,
      driverId: order.driverId,
      stars: normalizedStars,
      comment: comment || null,
      createdAt: new Date(),
    };

    this.ratings.set(ratingId, rating);
    return true;
  }

  async getAllRatings(): Promise<Rating[]> {
    return Array.from(this.ratings.values());
  }

  async getDriverStats(driverId: string): Promise<{completedOrders: number, totalRatings: number, averageRating: number}> {
    const completedOrders = Array.from(this.orders.values()).filter(
      (order) => order.driverId === driverId && order.status === "completed"
    );

    const driverRatings = Array.from(this.ratings.values()).filter(
      (rating) => rating.driverId === driverId
    );

    const totalRatings = driverRatings.length;
    const averageRating = totalRatings > 0
      ? driverRatings.reduce((sum, r) => sum + r.stars, 0) / totalRatings
      : 0;

    return {
      completedOrders: completedOrders.length,
      totalRatings,
      averageRating: Math.round(averageRating * 10) / 10,
    };
  }

  async getDriverBadges(driverId: string): Promise<string | null> {
    const stats = await this.getDriverStats(driverId);
    const badges: string[] = [];

    if (stats.averageRating >= 4.8) badges.push('⭐ Топ-водій');
    if (stats.completedOrders >= 100) badges.push('🏆 Легенда');
    if (stats.completedOrders >= 50) badges.push('🔥 Активний');
    if (stats.completedOrders >= 20 && stats.averageRating >= 4.5) badges.push('💎 Преміум');
    if (stats.totalRatings >= 50 && stats.averageRating === 5.0) badges.push('⚡ Ідеальний');

    return badges.length > 0 ? badges.join(' ') : null;
  }

  // Rate limit methods
  async getRateLimitTimestamps(userId: string): Promise<number[]> {
    return this.rateLimits.get(userId) || [];
  }

  async saveRateLimitTimestamps(userId: string, timestamps: number[]): Promise<void> {
    this.rateLimits.set(userId, timestamps);
  }

  async cleanExpiredRateLimits(): Promise<void> {
    const now = Date.now();
    const RATE_LIMIT_WINDOW = 60000; // 1 minute

    for (const [userId, timestamps] of this.rateLimits.entries()) {
      const validTimestamps = timestamps.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
      );

      if (validTimestamps.length === 0) {
        this.rateLimits.delete(userId);
      } else {
        this.rateLimits.set(userId, validTimestamps);
      }
    }
  }
}

export const storage = new MemStorage();