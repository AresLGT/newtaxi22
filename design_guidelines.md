# Design Guidelines: Telegram Taxi Service Web App

## Design Approach

**Selected Approach:** Dark Cyberpunk Noir - Futuristic Neon Aesthetic

**Justification:** The cyberpunk noir theme delivers a modern, high-tech visual identity with neon colors providing excellent contrast and visual hierarchy. The dark background reduces eye strain on mobile devices while the vibrant neon accents create an engaging, premium feel for a taxi service platform.

**Core Principles:**
- Deep dark backgrounds (almost black) for reduced eye strain
- Neon cyan and magenta as primary interaction colors
- High contrast for accessibility and visual impact
- Sleek, futuristic aesthetic with glowing effects
- Mobile-first, thumb-friendly interactions

---

## Color Palette

**Primary Colors:**
- **Background:** Deep Black (#0a0a0a) - Almost pitch black for maximum contrast
- **Foreground:** Bright Cyan (#00ffff) - Used for text and interactive elements
- **Primary Action:** Neon Cyan (180° 100% 50%) - Call-to-action buttons
- **Secondary:** Neon Magenta (280° 100% 45%) - Alternative actions and emphasis
- **Accent:** Neon Green/Lime (120° 100% 50%) - Highlights and notifications

**Secondary Colors:**
- **Card Background:** Dark Gray (#141414) - Slightly elevated from main background
- **Border:** Neon Purple/Magenta - Neon borders for cyberpunk effect
- **Muted Text:** Cyan at 70% opacity - Secondary information
- **Input Fields:** Dark Gray (#262626) - Form inputs with neon focus states

**Shadows & Glow:**
- All shadows use cyan glow (rgba(0, 255, 255, 0.1-0.3))
- Creates a subtle "neon glow" effect for depth
- Shadow intensity increases on hover/active states

---

## Typography

**Font Stack:**
- Primary: Inter (Google Fonts) - weights 400, 500, 600, 700
- Monospace: JetBrains Mono for codes/IDs

**Hierarchy:**
- Page Titles: text-2xl font-bold (32px) - Bright cyan
- Section Headers: text-xl font-semibold (24px) - Cyan with slight glow
- Card Titles: text-lg font-medium (20px) - Bright cyan
- Body Text: text-base font-normal (16px) - Bright cyan/white
- Captions/Labels: text-sm font-medium (14px) - Cyan at 70% opacity
- Micro-text: text-xs (12px) - Muted cyan

---

## Layout System

**Spacing Units:** Tailwind units of 2, 4, 6, 8, 12, 16 (keeping strict rhythm)
- Component padding: p-4, p-6
- Section gaps: gap-4, gap-6
- Vertical rhythm: space-y-6, space-y-8
- Page margins: px-4, py-6

**Grid System:**
- Mobile: Single column, full-width cards with neon borders
- Order forms: Stacked inputs with space-y-4, glowing input focus
- Driver order list: Single column cards with neon accent borders
- Admin panel: Single column on mobile, 2-column grid on desktop

---

## Component Library

### Client Interface (4 Primary Actions)

**Order Type Selection:**
- 4 large tap-friendly buttons in 2x2 grid (grid-cols-2 gap-4)
- Each button: Icon + Label, min-height h-32, rounded-xl
- Background: Dark with neon purple/cyan border on hover
- Text: Bright cyan
- Active state: Neon glow effect with cyan shadow

**Order Forms:**
- Stacked vertical layout with space-y-4
- Input fields: rounded-lg, p-4, text-base, dark gray background
- Focus state: Neon cyan border with glow effect
- Labels: text-sm font-medium mb-2, bright cyan
- Required field indicator: Neon red asterisk
- Submit button: Full-width, neon cyan, h-14, text-lg font-semibold
- Button hover: Increased cyan glow, subtle scale effect

### Driver Interface

**Active Orders List:**
- Card-based layout with neon border, dark background, p-4, space-y-3
- Order header: Route display with arrow icon, bright cyan text
- Order type badge: Inline rounded-full px-3 py-1, neon magenta background
- "Accept" button: w-full, neon cyan, h-12, font-semibold, glowing hover state
- Locked orders: Slightly darkened with "Taken" overlay badge in neon

**Price Bidding Modal:**
- Dark background with neon border
- Large number input: text-4xl font-bold, center-aligned, cyan
- Currency prefix: Neon magenta
- "Propose Price" button: Full-width, neon cyan, h-14, rounded-lg

**Driver Profile Setup:**
- Avatar display: Circular, w-24 h-24, centered, with cyan border glow
- Input fields: Stacked, space-y-4, dark background with neon focus
- Save button: Sticky bottom, neon cyan

### Chat Interface

**Layout:**
- Message bubbles: max-w-[80%], rounded-2xl, p-3, dark background
- Client messages: ml-auto, neon cyan border
- Driver messages: mr-auto, neon magenta border
- Timestamp: text-xs, muted cyan, opacity-70, mt-1
- Input bar: Fixed bottom, dark background, neon border
- Rounded-full input field with neon focus glow

### Admin Panel

**Driver Management Cards:**
- List view with driver avatar (w-12 h-12 rounded-full) + name/phone
- Dark background with neon border accent
- Action buttons row: Inline flex gap-2, neon cyan text
- Block button: Neon red
- Warning/Bonus buttons: Neon magenta
- Status badges: Inline, rounded-full, px-2 py-1, neon colors

**Code Generation:**
- Single action card with neon border
- Large "Generate Code" button: Neon cyan
- Generated code display: Monospace font, text-3xl, neon green
- Letter-spacing-wider, selectable text with cyan glow

---

## Navigation & Status

**Role Indicator:**
- Top bar with role badge, dark background, neon text
- Sticky position with subtle shadow

**Order Status Flow:**
- Visual stepper with neon colors
- Status badges: rounded-full, px-3 py-1, text-xs, uppercase
- Colors: New (cyan), Bidding (magenta), In Progress (green), Completed (cyan)

**Back/Navigation Buttons:**
- Neon cyan color, subtle glow on hover
- Arrow icon clearly visible

---

## Interactions & Feedback

**Loading States:**
- Skeleton screens: Dark animated pulses with cyan glow
- Spinners: Neon cyan rotating animation

**Notifications:**
- Toast messages: Dark background, neon border, cyan glow
- Fixed top-4 right-4, rounded-lg, p-4
- Success: Neon green, Error: Neon red
- Auto-dismiss after 4s

**Empty States:**
- Centered icon (neon cyan) + text (cyan)
- Icon: w-16 h-16, opacity-70
- Text: text-base, muted cyan opacity

**Button States:**
- Default: Neon cyan background, dark text
- Hover: Intensified cyan glow, subtle scale
- Active: Deeper glow effect
- Disabled: Darker with reduced opacity

---

## Accessibility

- All interactive elements: min-height h-11 (44px touch target)
- High contrast: Neon colors on dark backgrounds ensure WCAG compliance
- Focus states: Neon cyan ring with glow effect
- Form validation: Error messages below inputs, neon red text
- No gray-on-gray combinations

---

## Images

**Avatar Images:**
- Driver profile avatars: Auto-loaded from Telegram (circular, w-24 h-24)
- Neon cyan border glow effect
- Fallback: Initials on dark background with cyan border

**Icons:**
- Lucide React icons throughout
- Color: Neon cyan for primary actions, magenta for secondary
- Consistent sizing: w-5 h-5 for inline, w-6 h-6 for buttons
- Glow effect on hover

---

## Animation & Effects

**Transitions:**
- All color transitions: 200ms ease
- Scale effects on buttons: Subtle (0.95-1.05)
- Glow effects: Fade in/out for smooth appearance

**Neon Glow:**
- Applied to primary buttons, focused inputs, and borders
- Uses cyan shadow with 0.1-0.3 opacity
- Intensity increases on hover/active states

---

This dark cyberpunk noir design creates a premium, modern mobile interface optimized for quick interactions while delivering a distinctive, high-tech visual identity. The neon aesthetic ensures excellent visibility and engagement across all user roles.
