# Taxi Bot UA

## Overview

Taxi Bot UA is a Telegram-based taxi dispatch system that connects clients with drivers through a web application integrated with Telegram's Web App API. The system supports multiple service types (taxi, cargo, courier, and tow truck services) with dynamic pricing based on distance. It features real-time order management, driver ratings, notifications, and an administrative dashboard for monitoring and managing the platform.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Multi-page Web Application**
- The system uses separate HTML pages for different user roles (client, driver, admin)
- Each page is a standalone single-page application with embedded JavaScript
- Telegram Web App SDK integration for seamless Telegram bot interaction
- Real-time updates via polling to backend REST API endpoints
- Responsive design optimized for mobile devices within Telegram

**Key Pages:**
- `index.html` - Landing page with bot information
- `client.html` - Client interface for placing orders
- `driver.html` - Driver dashboard for viewing and accepting orders
- `admin.html` - Administrative panel for system monitoring
- `announcements.html` - System-wide announcements display

**Design Pattern:**
- CSS-in-HTML approach with shared `style-enhancements.css` for common animations
- Gradient-based dark theme UI for consistency across pages
- Animation-heavy interface with skeleton loaders for better UX

### Backend Architecture

**Node.js + Express Server**
- RESTful API architecture serving both static files and API endpoints
- Single `server.js` file containing all backend logic (monolithic approach)
- No framework-level routing separation - all endpoints defined in main server file
- CORS enabled for cross-origin requests

**Data Storage:**
- File-based JSON database (`db.json`) for data persistence
- No traditional database (PostgreSQL, MongoDB, etc.) - uses simple JSON file reads/writes
- Synchronous file operations for data consistency
- In-memory caching for statistics with 30-second TTL to reduce file I/O

**Data Models:**
```
- users: User profiles with roles (client/driver/admin)
- driverCodes: Authentication codes for driver registration
- orders: Service requests with status tracking
- ratings: Driver rating system
- messages: Communication between clients and drivers
- notifications: System notifications for users
- rateLimits: Anti-spam protection tracking
```

**Architectural Decisions:**

1. **File-based Database vs Traditional Database**
   - Chosen: JSON file storage
   - Rationale: Simpler deployment, no database server required, suitable for small-to-medium scale
   - Trade-off: Limited scalability, no ACID guarantees, potential file lock issues under high concurrency

2. **Monolithic Server Structure**
   - Chosen: Single server.js file with all logic
   - Rationale: Easier to understand and deploy for small applications
   - Trade-off: Harder to maintain as application grows, no separation of concerns

3. **Polling vs WebSockets**
   - Chosen: Client-side polling for real-time updates
   - Rationale: Simpler implementation, works with static hosting
   - Trade-off: Higher latency, more server requests, less efficient than WebSockets

4. **Statistics Caching**
   - Chosen: 30-second in-memory cache for dashboard stats
   - Rationale: Reduce file I/O operations for frequently accessed data
   - Trade-off: Slightly stale data, cache invalidation complexity

### Authentication & Authorization

**Multi-level Access Control:**
- Admin: Password-protected with environment variable configuration
- Drivers: Code-based registration system with admin-generated access codes
- Clients: Telegram user ID based authentication (no separate login)

**Rate Limiting:**
- Order creation limited to 5 requests per minute per user
- Prevents spam and abuse through in-memory tracking
- Configurable window and limits via constants

### Service Pricing Engine

**Distance-based Dynamic Pricing:**
```javascript
TARIFFS = {
    'Taxi': { basePrice: 50, perKm: 15 },
    'Cargo': { basePrice: 100, perKm: 25 },
    'Courier': { basePrice: 80, perKm: 20 },
    'Tow Truck': { basePrice: 200, perKm: 30 }
}
```
- Base price + per-kilometer rate calculation
- Client sees estimated price before order confirmation
- No surge pricing or time-based variations currently implemented

## External Dependencies

### Third-Party Services

**Telegram Bot API**
- Primary integration: `node-telegram-bot-api` package
- Used for bot commands, notifications, and Web App launching
- Requires `TELEGRAM_BOT_TOKEN` from BotFather
- Polling mode for receiving updates (not webhook)

**Telegram Web App SDK**
- Loaded via CDN: `https://telegram.org/js/telegram-web-app.js`
- Provides theme integration, user data access, and native UI controls
- Enables launching web interfaces from Telegram chat

### NPM Packages

**Core Dependencies:**
- `express` (^4.19.2) - Web server framework
- `node-telegram-bot-api` (^0.66.0) - Telegram bot integration
- `cors` (^2.8.5) - Cross-origin resource sharing
- `qrcode` (^1.5.4) - QR code generation for driver codes
- `leaflet` (^1.9.4) - Map integration (referenced but usage unclear from provided files)

### Environment Configuration

**Required Environment Variables:**
- `TELEGRAM_BOT_TOKEN` - Bot authentication token
- `ADMIN_ID` - Telegram user ID of primary administrator
- `WEB_APP_URL` - Public URL where web app is hosted
- `ADMIN_PASSWORD` - Password for admin panel access
- `PORT` - Server port (defaults to 5000)

**Deployment Notes:**
- Designed for deployment on NomadHost shared hosting
- Instructions include cPanel setup steps
- `.env.nomadhost` template provided for production configuration
- No build process required - direct file upload deployment

### Data Persistence

**File System Dependency:**
- Writes to `db.json` in application directory
- Requires write permissions on hosting environment
- No backup or replication strategy evident
- No migration system for schema changes