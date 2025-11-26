import {
  type User,
  type InsertUser,
  type Order,
  type InsertOrder,
  type AccessCode,
  type ChatMessage,
  type InsertChatMessage,
  type Rating,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface Tariff { type: string; basePrice: number; perKm: number; }
interface NotificationRecord { chatId: string; messageId: number; }
export interface SupportTicket { id: string; userId: string; userName: string; userPhone: string; message: string; status: 'open' | 'closed'; createdAt: Date; }

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllDrivers(): Promise<User[]>;
  getAllClients(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  registerDriverWithCode(userId: string, code: string, name: string, phone: string): Promise<User | null>;
  updateBalance(userId: string, amount: number): Promise<User | undefined>;
  createSupportTicket(userId: string, message: string): Promise<SupportTicket>;
  getSupportTickets(): Promise<SupportTicket[]>;
  resolveSupportTicket(id: string): Promise<void>;
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
  getRateLimitTimestamps(userId: string): Promise<number[]>;
  saveRateLimitTimestamps(userId: string, timestamps: number[]): Promise<void>;
  cleanExpiredRateLimits(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private orders: Map<string, Order> = new Map();
  private accessCodes: Map<string, AccessCode> = new Map();
  private chatMessages: Map<string, ChatMessage[]> = new Map();
  private ratings: Map<string, Rating> = new Map();
  private rateLimits: Map<string, number[]> = new Map();
  private tariffs: Map<string, Tariff> = new Map();
  private orderNotifications: Map<string, NotificationRecord[]> = new Map();
  private supportTickets: Map<string, SupportTicket> = new Map();

  constructor() {
    this.tariffs.set("taxi", { type: "taxi", basePrice: 100, perKm: 25 });
    this.tariffs.set("cargo", { type: "cargo", basePrice: 300, perKm: 40 });
    this.tariffs.set("courier", { type: "courier", basePrice: 80, perKm: 20 });
    this.tariffs.set("towing", { type: "towing", basePrice: 500, perKm: 50 });

    // ВАЖЛИВО: Тільки ви - адмін. Жодних admin1.
    this.users.set("7677921905", {
      id: "7677921905", role: "admin", name: "Адміністратор", phone: null,
      telegramAvatarUrl: null, isBlocked: false, warnings: [], bonuses: [], balance: 0
    });
  }

  async getUser(id: string) { return this.users.get(id); }
  async createUser(insertUser: InsertUser) {
    const user: User = { ...insertUser, isBlocked: false, warnings: [], bonuses: [], balance: 0 };
    this.users.set(user.id, user);
    return user;
  }
  async updateUser(id: string, updates: Partial<User>) {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  async updateBalance(userId: string, amount: number) {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updatedUser = { ...user, balance: (user.balance || 0) + amount };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  async getAllDrivers() { return Array.from(this.users.values()).filter(u => u.role === "driver" || u.role === "admin"); }
  async getAllClients() { return Array.from(this.users.values()).filter(u => u.role === "client"); }
  async getAllUsers() { return Array.from(this.users.values()); }
  
  async registerDriverWithCode(userId: string, code: string, name: string, phone: string) {
    // Перевірка коду БЕЗ чутливості до регістру і пробілів
    const cleanCode = code.trim().toUpperCase();
    
    // Шукаємо код у мапі (перебором, бо ключі можуть бути в різному регістрі)
    let accessCode: AccessCode | undefined;
    for (const [key, val] of this.accessCodes.entries()) {
      if (key.toUpperCase() === cleanCode) { accessCode = val; break; }
    }

    if (!accessCode || accessCode.isUsed) { console.log(`Code failed: ${cleanCode}`); return null; }

    let user = await this.getUser(userId);
    if (!user) user = await this.createUser({ id: userId, role: "driver", name, phone, telegramAvatarUrl: null });
    else user = await this.updateUser(userId, { role: "driver", name, phone }) || user;
    
    await this.markCodeAsUsed(accessCode.code, userId);
    return user;
  }

  async createSupportTicket(userId: string, message: string) {
    const id = randomUUID();
    const user = this.users.get(userId);
    const ticket: SupportTicket = { id, userId, userName: user?.name||"Guest", userPhone: user?.phone||"-", message, status: "open", createdAt: new Date() };
    this.supportTickets.set(id, ticket);
    return ticket;
  }
  async getSupportTickets() { return Array.from(this.supportTickets.values()).filter(t => t.status === 'open').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); }
  async resolveSupportTicket(id: string) { const t = this.supportTickets.get(id); if (t) this.supportTickets.set(id, { ...t, status: 'closed' }); }

  async getOrder(id: string) { return this.orders.get(id); }
  async getAllOrders() { return Array.from(this.orders.values()); }
  async getActiveOrders() { return Array.from(this.orders.values()).filter(o => o.status === "pending"); }
  async getOrdersByClient(id: string) { return Array.from(this.orders.values()).filter(o => o.clientId === id); }
  async getOrdersByDriver(id: string) { return Array.from(this.orders.values()).filter(o => o.driverId === id); }
  async getDriverCurrentOrder(id: string) { return Array.from(this.orders.values()).find(o => o.driverId === id && (o.status === "accepted" || o.status === "in_progress")); }
  async createOrder(d: InsertOrder) {
    const orderId = randomUUID();
    let price = d.price;
    if (!price && d.type && d.distanceKm) { const t = this.tariffs.get(d.type); if (t) price = t.basePrice + Math.ceil(d.distanceKm * t.perKm); }
    const o: Order = { orderId, ...d, price, status: "pending", driverId: null, createdAt: new Date() };
    this.orders.set(orderId, o);
    return o;
  }
  async updateOrder(id: string, u: Partial<Order>) { const o = this.orders.get(id); if (!o) return undefined; const nu = { ...o, ...u }; this.orders.set(id, nu); return nu; }
  async acceptOrder(id: string, drId: string, dist?: number) {
    const o = this.orders.get(id);
    if (!o || o.status !== "pending") return undefined;
    const d = await this.getUser(drId);
    if (!d || (d.role !== "driver" && d.role !== "admin") || d.isBlocked) return undefined;
    let price = o.price;
    if (dist) { const t = this.tariffs.get(o.type); if (t) price = t.basePrice + Math.ceil(dist * t.perKm); }
    const u: Order = { ...o, driverId: drId, status: "accepted", distanceKm: dist ?? o.distanceKm, price: price ?? o.price };
    this.orders.set(id, u);
    return u;
  }
  async releaseOrder(id: string) { const o = this.orders.get(id); if (!o) return undefined; const u: Order = { ...o, status: "pending", driverId: null }; this.orders.set(id, u); return u; }
  async completeOrder(id: string) { const o = this.orders.get(id); if (!o) return undefined; const u: Order = { ...o, status: "completed" }; this.orders.set(id, u); return u; }
  
  async addOrderNotification(oid: string, cid: string, mid: number) { const n = this.orderNotifications.get(oid) || []; n.push({ chatId: cid, messageId: mid }); this.orderNotifications.set(oid, n); }
  async getOrderNotifications(oid: string) { return this.orderNotifications.get(oid) || []; }
  
  async getTariffs() { return Array.from(this.tariffs.values()); }
  async updateTariff(t: string, b: number, p: number) { this.tariffs.set(t, { type: t, basePrice: b, perKm: p }); }
  
  async generateAccessCode(by: string) {
    let code = ""; let i=0;
    do { code = Math.random().toString(36).substr(2, 8).toUpperCase(); i++; if(i>10) break; } while(this.accessCodes.has(code));
    const ac: AccessCode = { code, isUsed: false, issuedBy: by, usedBy: null, createdAt: new Date() };
    this.accessCodes.set(code, ac);
    return ac;
  }
  async validateAccessCode(c: string) { return this.accessCodes.get(c); }
  async markCodeAsUsed(c: string, uid: string) { const ac = this.accessCodes.get(c); if(!ac || ac.isUsed) return false; this.accessCodes.set(c, { ...ac, isUsed: true, usedBy: uid }); return true; }
  
  async getChatMessages(oid: string) { return this.chatMessages.get(oid) || []; }
  async sendChatMessage(m: InsertChatMessage) { const msg: ChatMessage = { id: randomUUID(), ...m, createdAt: new Date() }; const ms = this.chatMessages.get(m.orderId) || []; ms.push(msg); this.chatMessages.set(m.orderId, ms); return msg; }
  
  async rateOrder(oid: string, s: number, c?: string) { const o = this.orders.get(oid); if (!o || o.status !== "completed" || !o.driverId) return false; if ([...this.ratings.values()].find(r => r.orderId === oid)) return false; const r: Rating = { id: randomUUID(), orderId: oid, driverId: o.driverId, stars: s, comment: c || null, createdAt: new Date() }; this.ratings.set(r.id, r); return true; }
  async getAllRatings() { return Array.from(this.ratings.values()); }
  async getDriverStats(did: string) { 
    const co = [...this.orders.values()].filter(o => o.driverId === did && o.status === "completed");
    const rs = [...this.ratings.values()].filter(r => r.driverId === did);
    const avg = rs.length > 0 ? rs.reduce((a, b) => a + b.stars, 0) / rs.length : 0;
    return { completedOrders: co.length, totalRatings: rs.length, averageRating: Math.round(avg * 10) / 10 };
  }
  async getDriverBadges(did: string) { return null; }
  async getRateLimitTimestamps(uid: string) { return this.rateLimits.get(uid) || []; }
  async saveRateLimitTimestamps(uid: string, ts: number[]) { this.rateLimits.set(uid, ts); }
  async cleanExpiredRateLimits() { const now = Date.now(); for(const [u, ts] of this.rateLimits) { const v = ts.filter(t => now - t < 60000); if(v.length===0) this.rateLimits.delete(u); else this.rateLimits.set(u, v); } }
}

export const storage = new MemStorage();