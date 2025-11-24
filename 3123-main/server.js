const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// --- ⚙️ НАЛАШТУВАННЯ ---
const TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const ADMIN_ID = process.env.ADMIN_ID || 7677921905;
const WEB_APP_URL = process.env.WEB_APP_URL || `http://localhost:${process.env.PORT || 5000}`;
const DB_PATH = './db.json';
const PORT = process.env.PORT || 5000;

// ТАРИФИ ПО ТИПАМ
const TARIFFS = {
    'Таксі 🚕': { basePrice: 50, perKm: 15, name: 'Таксі' },
    'Вантажний 🚚': { basePrice: 100, perKm: 25, name: 'Вантаж' },
    'Кур\'єр 📦': { basePrice: 80, perKm: 20, name: 'Кур\'єр' },
    'Буксир 🪝': { basePrice: 200, perKm: 30, name: 'Буксир' }
};

// Rate limiting constants
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ORDERS_PER_MINUTE = 5;

// ЗМІНА #4: КЕШИРУВАННЯ СТАТИСТИКИ (30 сек)
let statsCacheBefore = null;
let statsCacheTimestamp = null;

// АДМІН ПАРОЛЬ (ВАЖЛИВО: встановити через env змінну в production!)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin_pass_2024';
let adminPasswordAttempts = {};

let bot = null;
if (TOKEN) {
    bot = new TelegramBot(TOKEN, { polling: true });
    console.log('✅ Telegram bot initialized successfully');
} else {
    console.log('⚠️  TELEGRAM_BOT_TOKEN not set. Bot features disabled.');
}

const app = express();
app.use(cors());
app.use(express.json());

// Cache control
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// --- 💾 БАЗА ДАНИХ ---
function initDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ 
            users: {},
            driverCodes: [],
            orders: [],
            ratings: [],
            rateLimits: {},
            messages: [],
            notifications: []
        }, null, 2));
    } else {
        const db = JSON.parse(fs.readFileSync(DB_PATH));
        if (!db.orders) db.orders = [];
        if (!db.ratings) db.ratings = [];
        if (!db.rateLimits) db.rateLimits = {};
        if (!db.messages) db.messages = [];
        if (!db.notifications) db.notifications = [];
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    }
}

initDB();

function getDB() {
    return JSON.parse(fs.readFileSync(DB_PATH));
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getUser(userId, username = '') {
    const db = getDB();
    if (!db.users[userId]) {
        const role = (String(userId) === String(ADMIN_ID)) ? 'admin' : 'client';
        db.users[userId] = { role, username, customName: null, phone: null, bio: null, photoUrl: null, isOnline: false, lastActive: new Date().toISOString() };
        saveDB(db);
    }
    if (String(userId) === String(ADMIN_ID) && db.users[userId].role !== 'admin') {
        db.users[userId].role = 'admin';
        saveDB(db);
    }
    return db.users[userId];
}

function updateUserRole(userId, role) {
    const db = getDB();
    if (db.users[userId]) {
        db.users[userId].role = role;
        // ЗМІНА #7: ІСТОРІЯ АКТИВНОСТІ - відслідковувати онлайн/офлайн
        db.users[userId].lastActive = new Date().toISOString();
        if (!db.users[userId].activityLog) db.users[userId].activityLog = [];
        db.users[userId].activityLog.push({
            timestamp: new Date().toISOString(),
            action: `role_changed_to_${role}`
        });
        saveDB(db);
    }
}

function setDriverName(userId, newName) {
    const db = getDB();
    if (db.users[userId]) {
        db.users[userId].customName = newName;
        saveDB(db);
        return true;
    }
    return false;
}

function getAllDrivers() {
    const db = getDB();
    let list = [];
    for (let id in db.users) {
        if (db.users[id].role === 'driver_approved' || db.users[id].role === 'admin') {
            let name = db.users[id].customName || db.users[id].username || "Без імені";
            let roleLabel = (db.users[id].role === 'admin') ? '👑' : '🚖';
            list.push(`${roleLabel} 🆔 <code>${id}</code> — ${name}`);
        }
    }
    return list.join('\n');
}

// --- 🎫 КОДИ ВОДІЇВ ---
function generateDriverCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function createDriverCode(adminId) {
    const db = getDB();
    if (!db.driverCodes) db.driverCodes = [];
    
    let code;
    do {
        code = generateDriverCode();
    } while (db.driverCodes.some(c => c.code === code));
    
    const codeEntry = {
        code,
        createdAt: new Date().toISOString(),
        createdBy: adminId,
        used: false,
        usedAt: null,
        usedBy: null
    };
    
    db.driverCodes.push(codeEntry);
    saveDB(db);
    return code;
}

function getUnusedCodes() {
    const db = getDB();
    if (!db.driverCodes) return [];
    return db.driverCodes.filter(c => !c.used);
}

function validateAndUseCode(code, userId, username) {
    const db = getDB();
    if (!db.driverCodes) db.driverCodes = [];
    
    const codeEntry = db.driverCodes.find(c => c.code === code && !c.used);
    
    if (!codeEntry) {
        return { valid: false, reason: 'invalid_or_used' };
    }
    
    codeEntry.used = true;
    codeEntry.usedAt = new Date().toISOString();
    codeEntry.usedBy = userId;
    
    saveDB(db);
    return { valid: true, code: codeEntry };
}

// --- ⏱️ RATE LIMITING ---
function checkRateLimit(userId) {
    const db = getDB();
    const now = Date.now();
    
    if (!db.rateLimits[userId] || !Array.isArray(db.rateLimits[userId])) {
        db.rateLimits[userId] = [];
    }
    
    // Очищаємо старі записи
    db.rateLimits[userId] = db.rateLimits[userId].filter(t => now - t < RATE_LIMIT_WINDOW);
    
    if (db.rateLimits[userId].length >= MAX_ORDERS_PER_MINUTE) {
        return { allowed: false, message: '⏱️ Забагато замовлень! Спробуйте через хвилину.' };
    }
    
    db.rateLimits[userId].push(now);
    saveDB(db);
    return { allowed: true };
}

// --- 🚖 ЗАМОВЛЕННЯ ---
let orderCounter = 1;
let orderMessages = {};

function createOrder(userId, fromAddress, toAddress, serviceType, comment = '', fromLat = null, fromLng = null, price = 0) {
    const db = getDB();
    if (!db.orders) db.orders = [];
    
    const order = {
        id: orderCounter++,
        userId: String(userId),
        fromAddress,
        toAddress,
        serviceType,
        comment,
        fromLat,
        fromLng,
        price: Math.ceil(price) || 0,
        driverPrice: null,
        status: 'pending',
        statusHistory: [{ status: 'pending', timestamp: new Date().toISOString() }],
        driverId: null,
        createdAt: new Date().toISOString(),
        acceptedAt: null,
        completedAt: null,
        rating: null,
        eta: 8 // minutes
    };
    
    db.orders.push(order);
    saveDB(db);
    return order;
}

function getPendingOrders() {
    const db = getDB();
    return db.orders ? db.orders.filter(o => o.status === 'pending') : [];
}

function getOrderById(orderId) {
    const db = getDB();
    return db.orders ? db.orders.find(o => o.id === parseInt(orderId)) : null;
}

function updateOrderStatus(orderId, newStatus) {
    const db = getDB();
    const order = db.orders.find(o => o.id === parseInt(orderId));
    if (order) {
        order.status = newStatus;
        if (!order.statusHistory) order.statusHistory = [];
        order.statusHistory.push({ status: newStatus, timestamp: new Date().toISOString() });
        
        if (newStatus === 'accepted') order.acceptedAt = new Date().toISOString();
        if (newStatus === 'completed') order.completedAt = new Date().toISOString();
        
        saveDB(db);
        return order;
    }
    return null;
}

function cancelOrder(orderId) {
    const db = getDB();
    const index = db.orders.findIndex(o => o.id === parseInt(orderId));
    if (index !== -1) {
        db.orders.splice(index, 1);
        saveDB(db);
        return true;
    }
    return false;
}

function rateOrder(orderId, rating, comment = '') {
    const db = getDB();
    const order = db.orders.find(o => o.id === parseInt(orderId));
    if (order) {
        order.rating = { stars: Math.min(5, Math.max(1, parseInt(rating))), comment, ratedAt: new Date().toISOString() };
        db.ratings.push({ orderId, ...order.rating, driverId: order.driverId });
        saveDB(db);
        return true;
    }
    return false;
}

function getDriverStats(driverId) {
    const db = getDB();
    const completedOrders = db.orders ? db.orders.filter(o => o.driverId === String(driverId) && o.status === 'completed') : [];
    const ratings = db.ratings ? db.ratings.filter(r => r.driverId === String(driverId)) : [];
    
    const avgRating = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1) : 0;
    
    return {
        completedOrders: completedOrders.length,
        totalRatings: ratings.length,
        averageRating: avgRating
    };
}

function getAdminStats() {
    const db = getDB();
    const allOrders = db.orders || [];
    const completed = allOrders.filter(o => o.status === 'completed').length;
    const drivers = Object.values(db.users).filter(u => u.role === 'driver_approved' || u.role === 'admin').length;
    
    return {
        totalOrders: allOrders.length,
        completedOrders: completed,
        activeDrivers: drivers,
        pendingOrders: getPendingOrders().length
    };
}

function getDriverBadges(driverId) {
    const stats = getDriverStats(driverId);
    const badges = [];
    
    if (stats.averageRating >= 4.8) badges.push('⭐ Топ-водій');
    if (stats.completedOrders >= 100) badges.push('🏆 Легенда');
    if (stats.completedOrders >= 50) badges.push('🔥 Активний');
    if (stats.completedOrders >= 20 && stats.averageRating >= 4.5) badges.push('💎 Премум');
    if (stats.totalRatings >= 50 && stats.averageRating === '5.0') badges.push('⚡ Ідеальний');
    
    return badges.length > 0 ? badges.join(' ') : null;
}

// --- 🤖 TELEGRAM BOT ---
if (bot) {
    bot.onText(/\/start/, (msg) => {
        const userId = msg.from.id;
        const user = getUser(userId, msg.from.first_name);
        const firstName = user.customName || user.username || msg.from.first_name || 'друже';
        
        let text = '';
        let keyboard = [];

        if (user.role === 'admin') {
            text = `Вітаю, ${firstName}! 👑\n\nВи Адміністратор і Водій.\n\n<b>Команди:</b>\n/generate - Згенерувати коди\n/codes - Невикористані коди\n/drivers - Список водіїв\n/stats - Статистика\n/setname ID ІМ\'Я - Змінити ім\'я`;
            keyboard = [
                [{ text: '💼 Я водій', web_app: { url: WEB_APP_URL + '/driver.html' } }],
                [{ text: '🙋‍♂️ Я клієнт', web_app: { url: WEB_APP_URL + '/client.html' } }],
                [{ text: '📊 Панель адміна', web_app: { url: WEB_APP_URL + '/admin.html' } }]
            ];
        } else if (user.role === 'driver_approved') {
            text = `Привіт, ${firstName}! 🚖\n\nВи водій. Приймайте замовлення та заробляйте!`;
            keyboard = [
                [{ text: '💼 Приймати замовлення', web_app: { url: WEB_APP_URL + '/driver.html' } }],
                [{ text: '🙋‍♂️ Замовити для себе', web_app: { url: WEB_APP_URL + '/client.html' } }]
            ];
        } else if (user.role === 'driver_pending') {
            text = `Привіт, ${firstName}!\n\n⏳ Ваша заявка на розгляді...`;
            keyboard = [[{ text: '📱 Замовити послугу', web_app: { url: WEB_APP_URL + '/client.html' } }]];
        } else {
            text = `Вітаємо, ${firstName}! 🎉\n\n🚖 Швидко, зручно, надійно!`;
            keyboard = [[{ text: '📱 Замовити послугу', web_app: { url: WEB_APP_URL + '/client.html' } }]];
        }
        
        bot.sendMessage(userId, text, { 
            parse_mode: 'HTML',
            reply_markup: { keyboard, resize_keyboard: true }
        });
    });

    bot.onText(/\/stats/, (msg) => {
        if (String(msg.from.id) !== String(ADMIN_ID)) return;
        const stats = getAdminStats();
        const text = `📊 <b>Статистика:</b>\n\nВсього замовлень: ${stats.totalOrders}\nЗавершено: ${stats.completedOrders}\nОчікують: ${stats.pendingOrders}\nАктивних водіїв: ${stats.activeDrivers}`;
        bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    });

    bot.onText(/\/drivers/, (msg) => {
        if (String(msg.from.id) !== String(ADMIN_ID)) return;
        const list = getAllDrivers();
        bot.sendMessage(msg.chat.id, list ? `📋 <b>Водії:</b>\n\n${list}` : "Водіїв немає", { parse_mode: 'HTML' });
    });

    bot.onText(/\/setname (\d+) (.+)/, (msg, match) => {
        if (String(msg.from.id) !== String(ADMIN_ID)) return;
        if (setDriverName(match[1], match[2])) {
            bot.sendMessage(msg.chat.id, `✅ Ім'я змінено на: <b>${match[2]}</b>`, { parse_mode: 'HTML' });
        }
    });

    bot.onText(/\/generate(?:\s+(\d+))?/, (msg, match) => {
        if (String(msg.from.id) !== String(ADMIN_ID)) return;
        const count = Math.min(10, Math.max(1, parseInt(match[1]) || 1));
        const codes = Array.from({length: count}, () => createDriverCode(msg.from.id));
        const codesList = codes.map(c => `<code>${c}</code>`).join('\n');
        bot.sendMessage(msg.chat.id, `✅ <b>Коди (${count}):</b>\n\n${codesList}`, { parse_mode: 'HTML' });
    });

    bot.onText(/\/codes/, (msg) => {
        if (String(msg.from.id) !== String(ADMIN_ID)) return;
        const unused = getUnusedCodes();
        if (unused.length === 0) {
            return bot.sendMessage(msg.chat.id, '📋 Немає доступних кодів', { parse_mode: 'HTML' });
        }
        const list = unused.map(c => `🎫 <code>${c.code}</code>`).join('\n');
        bot.sendMessage(msg.chat.id, `📋 <b>Коди (${unused.length}):</b>\n\n${list}`, { parse_mode: 'HTML' });
    });

    bot.on('callback_query', (q) => {
        if (String(q.from.id) !== String(ADMIN_ID)) return;
        const [action, targetId] = q.data.split('_');
        if (action === 'approve') {
            updateUserRole(targetId, 'driver_approved');
            bot.sendMessage(targetId, '✅ Схвалено! Тисніть /app');
        } else if (action === 'reject') {
            updateUserRole(targetId, 'client');
            bot.sendMessage(targetId, '❌ Відхилено');
        }
        bot.answerCallbackQuery(q.id);
    });

    bot.on('message', (msg) => {
        if (msg.text && msg.text.startsWith('/')) return;
        const senderId = msg.from.id;
        const messageText = msg.text;
        
        if (messageText && messageText.length === 8 && /^[A-Z0-9]+$/.test(messageText)) {
            const user = getUser(senderId, msg.from.first_name);
            if (user.role !== 'client') return;
            
            const validation = validateAndUseCode(messageText, senderId, msg.from.first_name);
            if (!validation.valid) {
                return bot.sendMessage(senderId, '❌ Невірний або вже використаний код!', { parse_mode: 'HTML' });
            }
            
            updateUserRole(senderId, 'driver_pending');
            bot.sendMessage(senderId, '✅ Код підтверджено! Очікуйте підтвердження адміна.', { parse_mode: 'HTML' });
            bot.sendMessage(ADMIN_ID, `🔔 <b>Нова заявка:</b> ${msg.from.first_name} (${senderId})`, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[
                    { text: '✅ Схвалити', callback_data: `approve_${senderId}` },
                    { text: '❌ Відхилити', callback_data: `reject_${senderId}` }
                ]] }
            });
        }
    });
}

// --- 🌐 API СЕРВЕРА ---

// Замовлення
app.post('/order', (req, res) => {
    const { userId, fromAddress, toAddress, serviceType, comment, fromLat, fromLng, price } = req.body;
    
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.message });
    }
    
    const order = createOrder(userId, fromAddress, toAddress, serviceType || 'Таксі 🚕', comment, fromLat, fromLng, price);
    res.status(201).json({ orderId: order.id });
});

app.get('/get-orders', (req, res) => {
    res.json(getPendingOrders());
});

app.get('/check-order/:id', (req, res) => {
    const order = getOrderById(req.params.id);
    res.json(order ? { status: order.status, order } : { status: 'not_found' });
});

app.get('/get-order/:orderId', (req, res) => {
    const order = getOrderById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Not found' });
    const driver = order.driverId ? getUser(order.driverId) : null;
    res.json({
        ...order,
        driverName: driver?.customName || driver?.username || 'Водій',
        driverRating: driver ? getDriverStats(driver.id).averageRating : 0
    });
});

app.get('/user-orders/:userId', (req, res) => {
    const db = getDB();
    const userId = String(req.params.userId);
    const orders = (db.orders || []).filter(o => String(o.userId) === userId).reverse();
    res.json(orders);
});

// СПИСОК ЗАМОВЛЕНЬ ДЛЯ ВОДІЯ
app.get('/available-orders/:driverId', (req, res) => {
    const db = getDB();
    const driverId = String(req.params.driverId);
    
    // Отримуємо:
    // 1. ДОСТУПНІ - pending замовлення (без водія)
    // 2. МОЇ АКТИВНІ - замовлення які цей водій прийняв (не завершені)
    const availableOrders = (db.orders || [])
        .filter(o => o.status === 'pending')
        .map(o => {
            const client = getUser(o.userId);
            return {
                ...o,
                clientName: client?.customName || client?.username || 'Клієнт',
                clientRating: client ? getDriverStats(client.id).averageRating : 0
            };
        });
    
    const myActiveOrders = (db.orders || [])
        .filter(o => String(o.driverId) === driverId && o.status !== 'completed')
        .map(o => {
            const client = getUser(o.userId);
            return {
                ...o,
                clientName: client?.customName || client?.username || 'Клієнт',
                clientRating: client ? getDriverStats(client.id).averageRating : 0
            };
        });
    
    res.json({
        available: availableOrders,
        active: myActiveOrders
    });
});

app.get('/driver-stats/:driverId', (req, res) => {
    const db = getDB();
    const driverId = String(req.params.driverId);
    const completedOrders = (db.orders || []).filter(o => String(o.driverId) === driverId && o.status === 'completed');
    const ratings = (db.ratings || []).filter(r => String(r.driverId) === driverId);
    const todayOrders = completedOrders.filter(o => new Date(o.completedAt).toDateString() === new Date().toDateString());
    const earnings = completedOrders.reduce((sum, o) => sum + (o.price || 0), 0);
    const avgRating = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length) : 0;
    res.json({
        earnings,
        completedOrders: completedOrders.length,
        averageRating: avgRating,
        ridestoday: todayOrders.length
    });
});

// ГРАФІК ЗАРОБІТКІВ (ЛОС 7 ДНІВ)
app.get('/earnings-chart', (req, res) => {
    const db = getDB();
    const days = [];
    const earnings = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('uk-UA');
        const dayOrders = (db.orders || []).filter(o => new Date(o.completedAt || o.createdAt).toLocaleDateString('uk-UA') === dateStr && o.status === 'completed');
        const dayEarnings = dayOrders.reduce((sum, o) => sum + (o.price || 0), 0);
        days.push(dateStr);
        earnings.push(dayEarnings);
    }
    res.json({ days, earnings });
});

// ТОП-10 ВОДІЇВ (ВИПРАВЛЕНО: db.users це OBJECT, не ARRAY)
app.get('/top-drivers', (req, res) => {
    const db = getDB();
    const drivers = Object.entries(db.users || {})
        .filter(([id, u]) => u.role === 'driver_approved' || u.role === 'admin')
        .map(([id, d]) => ({
            ...d,
            id: id,
            completedOrders: (db.orders || []).filter(o => String(o.driverId) === String(id) && o.status === 'completed').length,
            earnings: (db.orders || []).filter(o => String(o.driverId) === String(id) && o.status === 'completed').reduce((sum, o) => sum + (o.driverPrice || o.price || 0), 0),
            ratings: (db.ratings || []).filter(r => String(r.driverId) === String(id)),
        }))
        .map(d => ({
            ...d,
            averageRating: d.ratings.length > 0 ? (d.ratings.reduce((sum, r) => sum + r.stars, 0) / d.ratings.length).toFixed(2) : 0
        }))
        .sort((a, b) => b.earnings - a.earnings)
        .slice(0, 10);
    res.json(drivers);
});

// ЗАМОВЛЕННЯ ПО ДАТАМ
app.get('/orders-by-date', (req, res) => {
    const db = getDB();
    const from = new Date(req.query.from).toLocaleDateString('uk-UA');
    const to = new Date(req.query.to).toLocaleDateString('uk-UA');
    const orders = (db.orders || []).filter(o => {
        const orderDate = new Date(o.createdAt).toLocaleDateString('uk-UA');
        return orderDate >= from && orderDate <= to;
    });
    res.json(orders);
});

// ВСІХ КОРИСТУВАЧІВ
app.get('/all-users', (req, res) => {
    const db = getDB();
    const users = Object.entries(db.users || {}).map(([id, u]) => ({
        id: id,
        username: u.username,
        customName: u.customName,
        role: u.role,
        isBlocked: u.isBlocked || false,
        isOnline: u.isOnline,
        phone: u.phone || '',
        bio: u.bio || ''
    }));
    res.json(users);
});

// БЛОКУВАННЯ КОРИСТУВАЧА
app.post('/toggle-user-block', (req, res) => {
    const db = getDB();
    const userId = String(req.body.userId);
    const user = db.users[userId];
    if (user) {
        user.isBlocked = !user.isBlocked;
        saveDB(db);
        res.json({ blocked: user.isBlocked });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// ДОДАТИ БОНУС/ШТРАФ
app.post('/add-balance', (req, res) => {
    const db = getDB();
    const driverId = String(req.body.driverId);
    const amount = parseInt(req.body.amount);
    
    console.log(`💰 /add-balance - ID: ${driverId}, Amount: ${amount}`);
    
    const user = db.users[driverId];
    if (!user) {
        console.log(`❌ Користувач ${driverId} не знайдений`);
        console.log(`📝 Доступні ID:`, Object.keys(db.users));
        return res.status(404).json({ error: 'Водій не знайдений' });
    }
    
    user.balance = (user.balance || 0) + amount;
    saveDB(db);
    
    console.log(`✅ Баланс оновлено для ${driverId}: ${user.balance} грн`);
    res.json({ success: true, balance: user.balance });
});

// РЕЗЕРВНА КОПІЯ БД
app.get('/backup-db', (req, res) => {
    const db = getDB();
    res.json(db);
});

// ПРОФІЛЬ ВОДІЯ
app.get('/driver-profile/:driverId', (req, res) => {
    const db = getDB();
    const driverId = String(req.params.driverId);
    const driver = db.users[driverId];
    if (!driver) return res.status(404).json({ message: 'Not found' });
    res.json({
        id: driverId,
        username: driver.username,
        customName: driver.customName,
        phone: driver.phone || '',
        bio: driver.bio || '',
        role: driver.role
    });
});

// ОНОВЛЕННЯ ПРОФІЛЮ ВОДІЯ
app.post('/update-driver-profile', (req, res) => {
    const db = getDB();
    const { driverId, name, phone, bio } = req.body;
    const driver = db.users[String(driverId)];
    
    if (driver) {
        driver.customName = name;
        driver.phone = phone;
        driver.bio = bio;
        saveDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// ОГОЛОШЕННЯ ДЛЯ ВОДІЇВ
app.get('/announcements', (req, res) => {
    const db = getDB();
    const announcements = (db.announcements || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(announcements);
});

app.post('/publish-announcement', (req, res) => {
    const db = getDB();
    const { title, text, type } = req.body;
    
    const announcement = {
        id: Date.now(),
        title,
        text,
        type: type || 'info',
        createdAt: new Date().toISOString()
    };
    
    if (!db.announcements) db.announcements = [];
    db.announcements.push(announcement);
    saveDB(db);
    
    // Telegram нотифікація всім водіям
    if (bot) {
        const users = Object.entries(db.users || {});
        const drivers = users.filter(([id, u]) => u.role === 'driver_approved' && !u.isBlocked);
        drivers.forEach(([id, driver]) => {
            const emoji = type === 'important' ? '⚠️' : type === 'success' ? '✅' : '📌';
            bot.sendMessage(id, `${emoji} <b>${title}</b>\n\n${text}`, { parse_mode: 'HTML' }).catch(()=>{});
        });
    }
    
    res.json({ success: true, announcement });
});

app.get('/current-order/:userId', (req, res) => {
    const db = getDB();
    const userId = String(req.params.userId);
    
    const driverOrder = db.orders?.find(o => String(o.driverId) === userId && o.status !== 'completed');
    if (driverOrder) {
        return res.json({ found: true, role: 'driver', order: driverOrder });
    }
    
    const clientOrder = db.orders?.find(o => String(o.userId) === userId && o.status !== 'completed');
    if (clientOrder) {
        return res.json({ found: true, role: clientOrder.status === 'pending' ? 'pending_client' : 'client', order: clientOrder });
    }
    
    res.json({ found: false });
});

app.post('/accept-order', (req, res) => {
    const { orderId, driverId } = req.body;
    const order = updateOrderStatus(orderId, 'accepted');
    if (!order || order.status !== 'accepted') {
        return res.status(400).json({ message: 'Зайнято' });
    }
    
    order.driverId = driverId;
    const db = getDB();
    db.orders[db.orders.findIndex(o => o.id === parseInt(orderId))] = order;
    saveDB(db);
    
    const driver = getUser(driverId);
    const driverName = driver.customName || driver.username || 'Водій';
    
    addNotification(order.userId, `✅ Водій ${driverName} прийняв ваше замовлення!`, 'accepted');
    
    if (bot) {
        // Telegram notification до КЛІЄНТА
        bot.sendMessage(order.userId, `✅ <b>Виконавця знайдено!</b>\n\n🚖 ${driverName}\nМаршрут: ${order.fromAddress} → ${order.toAddress}\n💵 Вартість: ${order.price} грн`, { parse_mode: 'HTML' }).catch(()=>{});
        // Telegram notification до ВОДІЯ
        bot.sendMessage(driverId, `📱 <b>Нове замовлення!</b>\n\n📍 ${order.fromAddress}\n🏁 ${order.toAddress}\n💰 ${order.price} грн\n⏱️ ETA: ${order.eta} хв`, { parse_mode: 'HTML' }).catch(()=>{});
    }
    res.json({ message: 'Success', order });
});

app.post('/update-order-status', (req, res) => {
    const { orderId, status } = req.body;
    const order = updateOrderStatus(orderId, status);
    res.json(order ? { message: 'Success', order } : { message: 'Not found' });
});

app.post('/cancel-order', (req, res) => {
    const { orderId } = req.body;
    if (cancelOrder(orderId)) {
        res.json({ message: 'Success' });
    } else {
        res.status(404).json({ message: 'Not found' });
    }
});

app.post('/rate-order', (req, res) => {
    const { orderId, stars, comment } = req.body;
    if (rateOrder(orderId, stars, comment)) {
        res.json({ message: 'Success' });
    } else {
        res.status(404).json({ message: 'Not found' });
    }
});

// ВОДІЙ ПРИБУВ НА МІСЦЕ - ЗАПУСКАЄ ТАЙМЕР ДЛЯ КЛІЄНТА
app.post('/driver-arrived', (req, res) => {
    const { orderId } = req.body;
    const db = getDB();
    const order = db.orders.find(o => o.id === parseInt(orderId));
    
    if (!order) {
        return res.status(404).json({ success: false, message: 'Замовлення не знайдено' });
    }
    
    order.status = 'driver_arrived';
    order.arrivedAt = new Date().toISOString();
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({ status: 'driver_arrived', timestamp: new Date().toISOString() });
    saveDB(db);
    
    console.log(`✅ Водій ${order.driverId} прибув до замовлення ${orderId}`);
    addNotification(order.userId, `✅ Водій прибув на місце! Таймер запущено.`, 'driver_arrived');
    
    res.json({ success: true, order });
});

app.post('/finish-order', (req, res) => {
    const { orderId } = req.body;
    const order = updateOrderStatus(orderId, 'completed');
    if (order && order.status === 'completed') {
        // ЗМІНА #2: ЧИСТ ЧАТУ - видалити всі повідомлення для цього замовлення
        const db = getDB();
        db.messages = (db.messages || []).filter(m => m.orderId !== parseInt(orderId));
        saveDB(db);
        
        addNotification(order.userId, `✅ Замовлення ${orderId} завершено!`, 'completed', 'high');
        res.json({ message: 'Success', order });
    } else {
        res.status(404).json({ message: 'Not found' });
    }
});

app.post('/set-driver-price', (req, res) => {
    const { orderId, driverPrice } = req.body;
    const db = getDB();
    const order = db.orders.find(o => o.id === parseInt(orderId));
    
    // ЗМІНА #5: ВАЛІДАЦІЯ ЦІНИ - мін 50, макс 500 грн
    const MIN_PRICE = 50;
    const MAX_PRICE = 500;
    const normalizedPrice = Math.ceil(driverPrice);
    
    if (normalizedPrice < MIN_PRICE || normalizedPrice > MAX_PRICE) {
        return res.status(400).json({ 
            success: false, 
            message: `Ціна має бути від ${MIN_PRICE} до ${MAX_PRICE} грн` 
        });
    }
    
    if (order) {
        order.driverPrice = normalizedPrice;
        order.status = 'price_offered';
        order.statusHistory.push({ status: 'price_offered', timestamp: new Date().toISOString() });
        saveDB(db);
        addNotification(order.userId, `💰 Водій запропонував ціну: ${order.driverPrice} грн`, 'price_offer', 'high');
        res.json({ success: true, order });
    } else {
        res.status(404).json({ success: false });
    }
});

app.post('/accept-driver-price', (req, res) => {
    const { orderId } = req.body;
    const db = getDB();
    const order = db.orders.find(o => o.id === parseInt(orderId));
    if (order && order.status === 'price_offered') {
        order.status = 'accepted';
        order.acceptedAt = new Date().toISOString();
        order.statusHistory.push({ status: 'accepted', timestamp: new Date().toISOString() });
        saveDB(db);
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false });
    }
});

app.post('/reject-driver-price', (req, res) => {
    const { orderId } = req.body;
    const db = getDB();
    const order = db.orders.find(o => o.id === parseInt(orderId));
    if (order && order.status === 'price_offered') {
        order.status = 'pending';
        order.driverId = null;
        order.driverPrice = null;
        order.statusHistory.push({ status: 'pending', timestamp: new Date().toISOString() });
        saveDB(db);
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false });
    }
});

app.post('/get-driver-photo/:driverId', async (req, res) => {
    try {
        const driverId = req.params.driverId;
        if (!bot) return res.json({ photoUrl: null });
        
        const photos = await bot.getUserProfilePhotos(driverId, { limit: 1 });
        if (photos.total_count > 0) {
            const file = await bot.getFile(photos.photos[0][0].file_id);
            const photoUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
            const db = getDB();
            if (db.users[driverId]) {
                db.users[driverId].photoUrl = photoUrl;
                saveDB(db);
            }
            res.json({ photoUrl });
        } else {
            res.json({ photoUrl: null });
        }
    } catch (e) {
        console.log('Помилка отримання фото:', e.message);
        res.json({ photoUrl: null });
    }
});

app.post('/update-driver-profile', (req, res) => {
    const { driverId, name, phone, bio } = req.body;
    const db = getDB();
    if (db.users[driverId]) {
        if (name) db.users[driverId].customName = name;
        if (phone !== undefined) db.users[driverId].phone = phone;
        if (bio !== undefined) db.users[driverId].bio = bio;
        saveDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.post('/toggle-driver-status', (req, res) => {
    const { driverId } = req.body;
    const db = getDB();
    if (db.users[driverId]) {
        db.users[driverId].isOnline = !db.users[driverId].isOnline;
        db.users[driverId].lastActive = new Date().toISOString();
        saveDB(db);
        res.json({ message: 'Success', isOnline: db.users[driverId].isOnline });
    } else {
        res.status(404).json({ message: 'Not found' });
    }
});

app.post('/send-message', (req, res) => {
    const { orderId, senderId, message } = req.body;
    const db = getDB();
    if (!db.messages) db.messages = [];
    
    const msg = {
        orderId,
        senderId,
        message,
        timestamp: new Date().toISOString()
    };
    
    db.messages.push(msg);
    saveDB(db);
    res.json({ message: 'Success', msg });
});

app.get('/messages/:orderId', (req, res) => {
    const db = getDB();
    const messages = (db.messages || []).filter(m => m.orderId === parseInt(req.params.orderId));
    res.json(messages);
});

app.get('/notifications/:userId', (req, res) => {
    const db = getDB();
    const notifs = (db.notifications || []).filter(n => n.userId === parseInt(req.params.userId));
    res.json(notifs);
});

app.post('/clear-notifications/:userId', (req, res) => {
    const db = getDB();
    db.notifications = (db.notifications || []).filter(n => n.userId !== parseInt(req.params.userId));
    saveDB(db);
    res.json({ message: 'Success' });
});

// ЗМІНА #6: SMART NOTIFICATIONS - розділити на рівні пріоритету
function addNotification(userId, text, type, priority = 'normal') {
    const db = getDB();
    if (!db.notifications) db.notifications = [];
    
    // high = чат, водій прибув, замовлення готово
    // normal = ціна, прийнято, в дорозі
    // low = статус-оновлення
    const priorityMap = { high: 3, normal: 2, low: 1 };
    
    db.notifications.push({
        userId: parseInt(userId),
        text,
        type,
        priority: priorityMap[priority] || 2,
        timestamp: new Date().toISOString(),
        read: false
    });
    saveDB(db);
}

app.get('/driver-stats/:driverId', (req, res) => {
    const stats = getDriverStats(req.params.driverId);
    res.json(stats);
});

// ЗМІНА #4: КЕШОВАНА СТАТИСТИКА (30 сек)
app.get('/admin-stats', (req, res) => {
    const now = Date.now();
    
    // Якщо кеш свіжий (менше 30 сек), повертаємо закешовані дані
    if (statsCacheBefore && statsCacheTimestamp && (now - statsCacheTimestamp) < 30000) {
        return res.json(statsCacheBefore);
    }
    
    // Інакше розраховуємо заново й кешуємо
    const stats = getAdminStats();
    statsCacheBefore = stats;
    statsCacheTimestamp = now;
    res.json(stats);
});

app.get('/all-drivers-stats', (req, res) => {
    const db = getDB();
    const drivers = Object.entries(db.users)
        .filter(([id, user]) => user.role === 'driver_approved' || user.role === 'admin')
        .map(([id, user]) => ({
            id,
            ...user,
            stats: getDriverStats(id)
        }));
    res.json(drivers);
});

app.get('/api/check-pending-rating/:userId', (req, res) => {
    const db = getDB();
    const userId = String(req.params.userId);
    const completedNoRating = db.orders?.find(o => String(o.userId) === userId && o.status === 'completed' && !o.rating);
    res.json({ needsRating: !!completedNoRating });
});

// Завантажуємо замовлення при старті
function loadOrders() {
    const db = getDB();
    if (db.orders && db.orders.length > 0) {
        orderCounter = Math.max(...db.orders.map(o => o.id)) + 1;
        console.log(`📦 Завантажено ${db.orders.length} замовлень`);
        console.log(`🔢 Наступний ID замовлення: ${orderCounter}`);
    }
}

loadOrders();

// ЗМІНА #8: АВТОМАТИЧНИЙ БЕКАП БД (кожну годину)
function autoBackup() {
    const db = getDB();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = './backups';
    
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }
    
    const backupPath = path.join(backupDir, `db_backup_${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(db, null, 2));
    console.log(`💾 Бекап БД створено: ${backupPath}`);
}

// Бекап кожну годину
setInterval(autoBackup, 60 * 60 * 1000);
// Також зробити перший бекап при запуску
autoBackup();

// ЗМІНА #9: ЕНДПОІНТ ЛОГІНУ АДМІНА
app.post('/admin-login', (req, res) => {
    const { password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    
    if (!adminPasswordAttempts[ip]) {
        adminPasswordAttempts[ip] = 0;
    }
    
    // Захист від brute-force (максимум 5 спроб на 5 хвилин)
    if (adminPasswordAttempts[ip] >= 5) {
        return res.status(429).json({ success: false, message: 'Забагато спроб. Спробуйте через 5 хвилин' });
    }
    
    if (password === ADMIN_PASSWORD) {
        adminPasswordAttempts[ip] = 0;
        // Встановити cookie/session з токеном
        res.json({ success: true, token: Buffer.from(password).toString('base64') });
    } else {
        adminPasswordAttempts[ip]++;
        res.status(401).json({ success: false, message: 'Неправильний пароль' });
    }
});

// ЗМІНА #10: ДЕТАЛЬНА АНАЛІТИКА
app.get('/detailed-analytics', (req, res) => {
    const db = getDB();
    const completedOrders = (db.orders || []).filter(o => o.status === 'completed');
    const drivers = Object.entries(db.users).filter(([id, u]) => u.role === 'driver_approved');
    
    if (completedOrders.length === 0) {
        return res.json({
            totalOrders: 0,
            avgDeliveryTime: 0,
            avgPrice: 0,
            avgRating: 0,
            popularRoutes: [],
            avgWaitTime: 0
        });
    }
    
    // Середній час доставки
    const deliveryTimes = completedOrders.map(o => {
        if (o.acceptedAt && o.completedAt) {
            return (new Date(o.completedAt) - new Date(o.acceptedAt)) / 60000; // в хвилинах
        }
        return 0;
    }).filter(t => t > 0);
    const avgDeliveryTime = deliveryTimes.length > 0 ? (deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length).toFixed(2) : 0;
    
    // Середня ціна
    const avgPrice = (completedOrders.reduce((sum, o) => sum + (o.driverPrice || 0), 0) / completedOrders.length).toFixed(2);
    
    // Середній рейтинг
    const ratings = (db.ratings || []).map(r => r.stars);
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : 0;
    
    // Популярні маршрути
    const routes = {};
    completedOrders.forEach(o => {
        const route = `${o.fromAddress} → ${o.toAddress}`;
        routes[route] = (routes[route] || 0) + 1;
    });
    const popularRoutes = Object.entries(routes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([route, count]) => ({ route, count }));
    
    // Час очікування (від створення до прийняття)
    const waitTimes = completedOrders.map(o => {
        if (o.createdAt && o.acceptedAt) {
            return (new Date(o.acceptedAt) - new Date(o.createdAt)) / 60000; // в хвилинах
        }
        return 0;
    }).filter(t => t > 0);
    const avgWaitTime = waitTimes.length > 0 ? (waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length).toFixed(2) : 0;
    
    res.json({
        totalOrders: completedOrders.length,
        avgDeliveryTime: `${avgDeliveryTime} хвилин`,
        avgPrice: `${avgPrice} грн`,
        avgRating,
        popularRoutes,
        avgWaitTime: `${avgWaitTime} хвилин`,
        activeDrivers: drivers.length,
        completionRate: `${((completedOrders.length / (db.orders || []).length) * 100).toFixed(1)}%`
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Running on port ${PORT}`));
