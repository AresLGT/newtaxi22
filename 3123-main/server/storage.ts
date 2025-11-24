import {
  type User,
  type InsertUser,
  type Order,
  type InsertOrder,
  type AccessCode,
  type InsertAccessCode,
  type ChatMessage,
  type InsertChatMessage,
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
  getActiveOrders(): Promise<Order[]>;
  getOrdersByClient(clientId: string): Promise<Order[]>;
  getOrdersByDriver(driverId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | undefined>;
  acceptOrder(orderId: string, driverId: string): Promise<Order | undefined>;
  proposeBid(orderId: string, driverId: string, price: number): Promise<Order | undefined>;
  respondToBid(orderId: string, clientId: string, accepted: boolean): Promise<Order | undefined>;

  // Access Code methods
  generateAccessCode(issuedBy: string): Promise<AccessCode>;
  validateAccessCode(code: string): Promise<AccessCode | undefined>;
  markCodeAsUsed(code: string, userId: string): Promise<boolean>;

  // Chat methods
  getChatMessages(orderId: string): Promise<ChatMessage[]>;
  sendChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private orders: Map<string, Order>;
  private accessCodes: Map<string, AccessCode>;
  private chatMessages: Map<string, ChatMessage[]>;

  constructor() {
    this.users = new Map();
    this.orders = new Map();
    this.accessCodes = new Map();
    this.chatMessages = new Map();

    // Create a default admin for testing
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

    const user = await this.createUser({
      id: userId,
      role: "driver",
      name,
      phone,
      telegramAvatarUrl: null,
    });

    await this.markCodeAsUsed(code, userId);
    return user;
  }

  // Order methods
  async getOrder(orderId: string): Promise<Order | undefined> {
    return this.orders.get(orderId);
  }

  async getActiveOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.status === "new" || order.status === "bidding"
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
      status: "new",
      driverId: null,
      driverBidPrice: null,
      isTaken: false,
      proposalAttempts: [],
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

  async acceptOrder(orderId: string, driverId: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;

    // Check if order is already taken
    if (order.isTaken && order.driverId !== driverId) {
      return undefined;
    }

    const driver = await this.getUser(driverId);
    if (!driver || driver.role !== "driver" || driver.isBlocked) {
      return undefined;
    }

    // Check if driver already attempted this order and was rejected
    if (order.proposalAttempts.includes(driverId)) {
      return undefined;
    }

    const updatedOrder = {
      ...order,
      driverId,
      isTaken: true,
      status: "bidding" as const,
    };
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }

  async proposeBid(orderId: string, driverId: string, price: number): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order || order.driverId !== driverId || order.status !== "bidding") {
      return undefined;
    }

    const updatedOrder = {
      ...order,
      driverBidPrice: price,
    };
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }

  async respondToBid(
    orderId: string,
    clientId: string,
    accepted: boolean
  ): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order || order.clientId !== clientId || order.status !== "bidding") {
      return undefined;
    }

    if (accepted) {
      const updatedOrder = {
        ...order,
        status: "in_progress" as const,
      };
      this.orders.set(orderId, updatedOrder);
      return updatedOrder;
    } else {
      // Reject - add driver to proposal attempts and reset
      const updatedOrder = {
        ...order,
        driverId: null,
        driverBidPrice: null,
        isTaken: false,
        status: "new" as const,
        proposalAttempts: [...order.proposalAttempts, order.driverId!],
      };
      this.orders.set(orderId, updatedOrder);
      return updatedOrder;
    }
  }

  // Access Code methods
  async generateAccessCode(issuedBy: string): Promise<AccessCode> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
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
}

export const storage = new MemStorage();
