# EPML Enterprise Management Platform - Design Guidelines

## Design Approach

**Selected System**: Modern Enterprise Dashboard Pattern (inspired by Linear, Stripe Dashboard, and Vercel)

**Rationale**: Enterprise management platforms demand clarity, efficiency, and sophisticated data presentation. This approach prioritizes information hierarchy, rapid task completion, and visual organization over creative expression.

**Core Principles**: Precision over decoration, function over form, consistency throughout, scannable data displays

---

## Typography System

**Primary Font**: Inter (via Google Fonts CDN)
- Headings: 600-700 weight
- Body: 400-500 weight
- Data/Numbers: 500-600 weight (tabular-nums for alignment)

**Scale**:
- Page Titles: text-3xl (30px)
- Section Headers: text-xl (20px)
- Card Titles: text-lg (18px)
- Body Text: text-sm (14px)
- Labels/Captions: text-xs (12px)
- Data Tables: text-sm with tight leading

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16** exclusively
- Component padding: p-4 to p-6
- Section spacing: gap-8 to gap-12
- Card spacing: p-6
- Table cells: px-4 py-3

**Grid Structure**:
- Main container: max-w-7xl mx-auto px-6
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Stat cards: grid-cols-2 lg:grid-cols-4 gap-4
- Split layouts: 60/40 or 70/30 ratio for detail views

---

## Application Architecture

### Global Navigation (Persistent)

**Top Bar** (h-16, fixed):
- Left: Company logo + tenant selector (dropdown)
- Center: Global search bar (max-w-md)
- Right: Notifications icon, user avatar with dropdown

**Sidebar** (w-64, fixed left):
- Navigation sections with icons (Heroicons CDN)
- Dashboard, Stores, Analytics, Reports, Settings, Users
- Active state: subtle background fill
- Collapsible on mobile (hamburger menu)

### Dashboard Layout (Default View)

**Hero Stats Section** (py-8):
- 4-column grid of metric cards (h-32)
- Large number (text-3xl font-bold), label (text-xs), trend indicator (↑ 12%)
- Include icon in top-right corner

**Main Content Area** (grid lg:grid-cols-3 gap-6):

**Left Column (col-span-2)**:
- Recent Activity Table (rounded-lg border)
- Transaction History Chart (h-80, line/area chart)
- Store Performance Grid

**Right Column (col-span-1)**:
- Quick Actions Card (Create Store, Add User, Generate Report)
- System Status Widget
- Recent Notifications List

---

## Core Components

### Data Tables
- Header row: font-medium text-xs uppercase tracking-wide, py-3
- Body rows: py-4, hover state with background shift
- Row actions: Right-aligned icon buttons (Edit, Delete, More)
- Pagination: Bottom-right with page numbers
- Filters: Top row with search, date range, status dropdowns
- Sortable columns with arrow indicators

### Forms
- Two-column layout on desktop (grid-cols-2 gap-6)
- Label above input: text-sm font-medium mb-2
- Input height: h-10, rounded-lg, border
- Required fields: Red asterisk next to label
- Submit buttons: Bottom-right, primary + secondary actions
- Validation: Inline error messages below inputs (text-xs)

### Cards
- Rounded-lg with border
- Header: px-6 py-4 border-b (title + action icon)
- Body: px-6 py-5
- Footer: px-6 py-4 border-t (for actions)

### Modals/Dialogs
- Centered overlay (backdrop blur)
- Max-w-2xl for forms, max-w-md for confirmations
- Header with title + close button
- Scrollable body if content exceeds viewport
- Footer with aligned action buttons

### Charts & Visualizations
- Use Chart.js or Recharts via CDN
- Consistent axis styling, gridlines, tooltips
- Height: h-64 for inline, h-96 for featured
- Legend placement: top-right

---

## Page Templates

### Store Management
- Header with store name + breadcrumb
- Tab navigation (Overview, Products, Orders, Analytics)
- Data table with filters and bulk actions
- Side panel for quick edits (slide-in from right)

### User Management
- Grid view with user cards (avatar, name, role, status)
- Table view toggle
- Invite user button (top-right)
- Role assignment dropdown

### Reports Dashboard
- Filter bar (date range, store selector, metrics)
- Export button (PDF, CSV)
- Multi-chart layout with comparison views
- Summary statistics cards

### Settings
- Left sidebar sub-navigation
- Form sections with clear grouping
- Save/Cancel buttons sticky at bottom
- Success confirmation toasts

---

## Images

**No large hero image** - This is a functional enterprise application, not a marketing site.

**Logo Assets**:
- Company logo: Top-left navigation (h-8)
- Tenant logos: In tenant selector dropdown (h-6, rounded)

**User Avatars**:
- Profile pictures throughout (rounded-full)
- Sizes: w-8 h-8 (nav), w-10 h-10 (lists), w-16 h-16 (profiles)
- Fallback: Initials on solid background

**Empty States**:
- Illustrative graphics for empty tables/lists (max-w-xs mx-auto)
- Simple line illustrations, not complex imagery

**Store/Product Images**:
- Thumbnail grids: w-12 h-12 rounded
- Detail views: w-full max-h-96 object-cover

---

## Interaction Patterns

**Loading States**: Skeleton screens for tables, shimmer effect for cards
**Notifications**: Toast messages top-right (auto-dismiss after 5s)
**Confirmations**: Modal dialogs for destructive actions
**Bulk Actions**: Checkbox selection with action bar appearing at top
**Inline Editing**: Double-click table cells, save/cancel icons appear
**Filters**: Dropdown menus with checkboxes, apply button
**Search**: Instant results dropdown, keyboard navigation

---

## Icons

**Library**: Heroicons (outline for navigation, solid for actions) via CDN
- Navigation: 24px icons
- Actions: 20px icons
- Status indicators: 16px icons