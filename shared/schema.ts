import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  role: text("role", { enum: ["client", "driver", "admin"] }).notNull().default("client"),
  name: text("name"),
  phone: text("phone"),
  telegramAvatarUrl: text("telegram_avatar_url"),
  isBlocked: boolean("is_blocked").default(false),
  warnings: text("warnings").array().default([]),
  bonuses: text("bonuses").array().default([]),
});

export const orders = pgTable("orders", {
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const accessCodes = pgTable("access_codes", {
  code: varchar("code").primaryKey(),
  isUsed: boolean("is_used").default(false),
  issuedBy: varchar("issued_by").notNull(),
  usedBy: varchar("used_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  warnings: true,
  bonuses: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  orderId: true,
  createdAt: true,
  status: true,
  driverId: true,
  driverBidPrice: true,
  isTaken: true,
  proposalAttempts: true,
}).extend({
  type: z.enum(["taxi", "cargo", "courier", "towing"]),
  from: z.string().min(1),
  to: z.string().min(1),
  clientId: z.string().min(1),
  comment: z.string().optional(),
  requiredDetail: z.string().optional(),
});

export const insertAccessCodeSchema = createInsertSchema(accessCodes).omit({
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type AccessCode = typeof accessCodes.$inferSelect;
export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export type OrderType = "taxi" | "cargo" | "courier" | "towing";
export type OrderStatus = "new" | "bidding" | "accepted" | "in_progress" | "rejected_by_client" | "completed";
export type UserRole = "client" | "driver" | "admin";
