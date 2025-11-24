import type { Request, Response, NextFunction } from "express";

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ORDERS_PER_MINUTE = 5;

export const rateLimiter = new Map<string, number[]>();

export function checkRateLimit(userId: string): { allowed: boolean; message?: string } {
  const now = Date.now();

  if (!rateLimiter.has(userId)) {
    rateLimiter.set(userId, []);
  }

  const userTimestamps = rateLimiter.get(userId)!;

  // Очищаємо старі записи (старші за 1 хвилину)
  const validTimestamps = userTimestamps.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
  );
  rateLimiter.set(userId, validTimestamps);

  // Перевіряємо ліміт
  if (validTimestamps.length >= MAX_ORDERS_PER_MINUTE) {
    return {
      allowed: false,
      message: "⏱️ Забагато замовлень! Спробуйте через хвилину.",
    };
  }

  // Додаємо новий timestamp
  validTimestamps.push(now);
  rateLimiter.set(userId, validTimestamps);

  return { allowed: true };
}

const ADMIN_IDS = ["admin1", "7677921905"];

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const internalRequest = req.headers["x-internal-request"];
  if (internalRequest) {
    next();
    return;
  }

  // Отримуємо userId з body або використовуємо IP якщо body відсутній
  let userId: string | undefined;
  
  if (req.body && typeof req.body === 'object') {
    userId = req.body.clientId || req.body.userId;
  }
  
  // Якщо немає userId - використовуємо IP адресу для rate limiting
  if (!userId) {
    userId = req.ip || req.socket.remoteAddress || 'unknown';
  }

  // Bypass для адмінів
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

export function getRateLimitInfo(userId: string): {
  requestsInWindow: number;
  remaining: number;
  resetsIn: number;
} {
  const now = Date.now();
  const userTimestamps = rateLimiter.get(userId) || [];
  const validTimestamps = userTimestamps.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
  );

  const remaining = Math.max(0, MAX_ORDERS_PER_MINUTE - validTimestamps.length);
  const oldestTimestamp = validTimestamps[0];
  const resetsIn = oldestTimestamp
    ? Math.ceil((oldestTimestamp + RATE_LIMIT_WINDOW - now) / 1000)
    : 0;

  return {
    requestsInWindow: validTimestamps.length,
    remaining,
    resetsIn,
  };
}
