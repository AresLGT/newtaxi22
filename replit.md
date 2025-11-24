# Telegram Taxi Service Web App

## Overview

This is a Telegram-based taxi service platform that enables ride-hailing, cargo transport, courier delivery, and towing services. The application features a role-based system with three distinct user types: Clients (who request rides), Drivers (who fulfill orders), and Administrators (who manage the platform). Built as a Telegram Web App, it provides a mobile-first experience optimized for quick interactions and real-time order management.

The platform implements a transparent tariff-based pricing system where clients see upfront prices calculated from distance and service type. The system includes real-time chat functionality, order tracking, driver ratings, and administrative tools for driver management through access codes.

## Recent Changes

**November 24, 2025**: Major integration of functionality from 3123-main project:
- ✅ Integrated Telegram Bot (`server/telegram-bot.ts`) with full command support (/start, /generate, /codes, /drivers, /stats)
- ✅ Implemented tariff-based pricing system (`shared/tariffs.ts`) replacing bidding mechanism
- ✅ Added driver rating system with stars (1-5) and optional comments
- ✅ Implemented rate limiting middleware (max 5 orders per minute per user, IP-based fallback)
- ✅ Simplified order workflow: pending → accepted → in_progress → completed
- ✅ Updated UI components to display upfront pricing and distance-based calculations
- ✅ Added driver statistics and badges (⭐ Топ-водій, 🏆 Легенда, 🔥 Активний, 💎 Преміум, ⚡ Ідеальний)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server.

**UI Component System**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling. The design follows a Material Design-inspired approach with mobile-first, thumb-friendly interactions. The component library uses the "new-york" style variant with custom color theming based on HSL values.

**Routing**: Wouter for lightweight client-side routing, supporting distinct paths for different user roles:
- Client views: `/`, `/order/:type`, `/chat/:orderId`
- Driver views: `/driver`, `/driver/profile`, `/chat/:orderId`
- Admin views: `/admin`
- Role selection: `/role-selector`

**State Management**: 
- React Context API for global user state (role and userId management via `UserProvider`)
- TanStack Query (React Query) for server state management with automatic caching and refetching
- Local component state with React hooks for UI interactions

**Form Handling**: React Hook Form with Zod schema validation for type-safe form management across order creation, driver registration, and profile updates.

**Design System**: Custom Tailwind configuration with:
- Custom border radius values (9px, 6px, 3px)
- HSL-based color system with CSS variables for theming
- Elevation classes for interactive elements
- Typography hierarchy using Inter (primary) and JetBrains Mono (monospace)
- Mobile-first responsive breakpoints

### Backend Architecture

**Runtime**: Node.js with Express.js framework, using ESM modules throughout.

**API Design**: RESTful API with the following endpoint structure:
- User management: `/api/users/:id`, `/api/users/register-driver`
- Order management: `/api/orders/active`, `/api/orders/:orderId/accept`, `/api/orders/:orderId/rate`
- Driver information: `/api/drivers/:id/stats`, `/api/drivers/:id/badges`
- Admin operations: `/api/admin/drivers`, `/api/admin/generate-code`
- Chat: `/api/chat/:orderId`

**Data Storage Strategy**: The application uses an abstraction layer (`IStorage` interface) allowing multiple storage implementations:
- Development: In-memory storage (`MemStorage`) for rapid prototyping
- Production-ready: Configured for PostgreSQL via Drizzle ORM with Neon serverless adapter

**Session Management**: Express sessions with `connect-pg-simple` for PostgreSQL-backed session storage.

**Development/Production Split**: 
- Development mode (`index-dev.ts`): Integrates Vite middleware for HMR and instant client updates
- Production mode (`index-prod.ts`): Serves pre-built static assets from `dist/public`

### Data Model

**Database Schema** (Drizzle ORM with PostgreSQL):

1. **Users Table**: Stores all platform users with role-based differentiation
   - Primary key: `id` (Telegram user ID)
   - Fields: `role` (client/driver/admin), `name`, `phone`, `telegramAvatarUrl`, `isBlocked`, `warnings[]`, `bonuses[]`

2. **Orders Table**: Central entity for all service requests
   - Primary key: `orderId` (UUID)
   - Fields: `type` (taxi/cargo/courier/towing), `clientId`, `driverId`, `from`, `to`, `comment`, `requiredDetail`, `status`, `price`, `distanceKm`, `createdAt`
   - Status flow: pending → accepted → in_progress → completed (or cancelled)

3. **Access Codes Table**: Admin-generated codes for driver registration
   - Primary key: `code`
   - Fields: `isUsed`, `issuedBy`, `usedBy`, `createdAt`

4. **Chat Messages Table**: Real-time messaging between clients and drivers
   - Primary key: `id` (UUID)
   - Fields: `orderId`, `senderId`, `message`, `createdAt`

5. **Ratings Table**: Driver performance ratings from completed orders
   - Primary key: `id` (UUID)
   - Fields: `orderId`, `driverId`, `stars` (1-5), `comment`, `createdAt`

**Tariff System**:
- Таксі 🚕: Base 50₴ + 15₴/км
- Вантажний 🚚: Base 100₴ + 25₴/км
- Кур'єр 📦: Base 80₴ + 20₴/км
- Буксир 🪝: Base 200₴ + 30₴/км

**Order Workflow**:
1. Client creates order with distance input → price calculated automatically (status: "pending")
2. Driver views pending orders with pre-calculated prices
3. Driver accepts order (status: "accepted", driver assigned)
4. Driver starts ride (status: "in_progress")
5. Order completion (status: "completed")
6. Client rates driver (1-5 stars + optional comment)

### Authentication & Authorization

**Telegram Integration**: The application is designed to run as a Telegram Web App, leveraging Telegram's built-in authentication through the `telegram-web-app.js` SDK. User identity is derived from Telegram user data.

**Role-Based Access Control**: 
- Roles are stored in the users table and managed through the UserContext
- Driver registration requires a valid access code issued by administrators
- Client role is the default for new users
- Admin role is pre-configured in the system

**Access Code System**: Administrators generate single-use codes that drivers must provide during registration along with their name and phone number.

## External Dependencies

### Third-Party Services

**Telegram Bot API**: Core platform for user authentication, notifications, and Web App hosting via `node-telegram-bot-api`. Supports commands (/start, /generate, /codes, /drivers, /stats) and Web App buttons for client/driver/admin interfaces.

**Database Service**: Configured for Neon serverless PostgreSQL (`@neondatabase/serverless`), a cloud-native PostgreSQL platform optimized for serverless environments. Connection managed via `DATABASE_URL` environment variable.

### Key Libraries & Tools

**UI Framework**:
- React 18 with TypeScript
- Radix UI primitives (15+ component primitives for accessibility)
- Tailwind CSS for utility-first styling
- Lucide React for iconography

**Data & State Management**:
- TanStack Query v5 for server state synchronization
- React Hook Form with Zod resolvers for form validation
- Drizzle ORM for type-safe database queries
- Drizzle-Zod for schema-to-Zod validation conversion

**Development Tools**:
- Vite for fast development builds and HMR
- TypeScript for type safety across the stack
- ESBuild for production bundling
- Drizzle Kit for database migrations

**Build & Deployment**:
- Express serves built static assets in production
- Vite dev server with middleware integration for development
- PostgreSQL for production data persistence
- In-memory storage fallback for development/testing

### Environment Configuration

**Required Environment Variables**:
- `DATABASE_URL`: PostgreSQL connection string for Neon or compatible database
- `NODE_ENV`: Controls development vs production behavior

**Optional Replit-Specific Plugins** (development only):
- `@replit/vite-plugin-runtime-error-modal`: Error overlay for development
- `@replit/vite-plugin-cartographer`: Development tooling
- `@replit/vite-plugin-dev-banner`: Development indicator banner

### Font Assets

**Google Fonts**:
- Inter: Primary UI font (weights 400, 500, 600, 700)
- JetBrains Mono: Monospace font for codes and IDs (weights 400, 500, 600)

Fonts are preconnected for performance optimization.