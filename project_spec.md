# UTV & Multi-Modal Trail Mapping Program: Master Implementation Specification (V7)

This document represents the unified, comprehensive architectural specification for the Trail Mapping platform. It integrates official scrapers, real-time hazard reporting, multi-modal routing (UTV, MTB, Hike), Lightweight PIN Authentication, and Row Level Security (RLS) for private custom route sharing.

---

## 1. System Architecture & Tech Stack

- **Frontend**: Next.js (Vercel) with Tailwind CSS. Responsive architecture supporting both handheld mobile phones and 8–10 inch tablets mounted in roll cages.
- **Mapping Engine**: Mapbox GL JS utilizing vector tiles, custom layer styling, and offline tile caching.
- **Auth**: Lightweight Profile Authentication. Users log in using their First Name, Last Name, and a 4-digit PIN for rapid, glove-friendly authentication.
- **Backend & Database**: Supabase PostgreSQL with PostGIS, pgRouting, and strict Row Level Security (RLS) to enforce route privacy.

---

## 2. Supabase Database Schema & RLS Policies

Supabase Row Level Security (RLS) is utilized to ensure private trails are mathematically impossible to query by unauthorized users. By leveraging Postgres primitives, RLS ensures end-to-end user security from the browser straight down to the database row.

### Table: `riders`
- `id` (uuid, PK): Matches Supabase `auth.uid()`.
- `first_name`, `last_name` (text): Rider's display name.
- `pin_hash` (text): Bcrypt hashed 4-digit PIN for rapid login.

### Table: `trails` (UPDATED)
- `id` (uuid, PK): Trail identifier.
- `geom` (`geometry(LineString, 4326)`): PostGIS spatial line string for the trail/road geometry.
- `route_type` (enum): `designated_trail`, `unmaintained_fire_road`, `street_legal_city`, `prohibited`, `user_submitted`.
- `official_status` (enum): `open`, `closed`, `caution`.
- `creator_id` (uuid, FK): References `riders.id`.
- `visibility` (enum): `'private'`, `'shared'`, `'public'`. Defaults to `'private'`.
- `cost_utv`, `cost_mtb`, `cost_hike` (numeric): Mode-specific cost multipliers for pgRouting/Valhalla.

### Table: `trail_shares`
- `trail_id`, `rider_id` (uuid, FKs): Maps which specific riders can see a 'shared' trail.

### Row Level Security (RLS) Policy for Trails
To enforce privacy, the database agent must enable RLS on the `trails` table and implement this exact RLS policy to control which rows are visible:

```sql
ALTER TABLE trails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View Access for Trails" ON trails FOR SELECT USING (
  visibility = 'public' 
  OR creator_id = auth.uid() 
  OR id IN (SELECT trail_id FROM trail_shares WHERE rider_id = auth.uid())
);
```

---

## 3. Google Stitch Workflow: UI/UX System

### 3.1 Stitch Setup
- Operate in Standard Mode with both Mobile Layout and Tablet Layout enabled.
- Ensure all touch targets meet or exceed 48x48px (FAB buttons minimum 60x60px) to allow effortless operation with riding gloves.
- Maintain high-contrast outdoor mode with bold typography and vibrant accent colors.

### 3.2 Stitch Master Prompt Sequence
Apply updates sequentially (one change per prompt) to preserve layout stability:

1. **Base Navigation Dashboard**:
   > "Design a high-contrast outdoor mobile and tablet navigation dashboard for an off-road UTV mapping app. Full-screen map background. Top floating search bar and GPS status indicator. Bottom-right oversized floating action button (FAB) labeled 'Report Hazard' (min 60x60px). Bottom minimal navigation bar."

2. **Hazard Reporting Flow**:
   > "Add the hazard reporting interface. On mobile, this should be a slide-up bottom sheet; on tablet, a side-panel card. Grid of oversized buttons for: 'Tree Down', 'Washout / Rut', 'Mud / Flooded', 'Active Logging', and 'Trail Impassable'."

3. **Track Recording ("Breadcrumbing")**:
   > "Add a secondary oversized FAB labeled 'Record Route'. When active, display a persistent top warning banner showing '🔴 Recording: 2.4 miles' and render the active path as a bold dashed purple line."

4. **Multi-Modal Transport Selector**:
   > "Add a horizontal, pill-shaped segmented control below the top search bar with three modes: 'UTV', 'MTB', and 'Hike'. Switching modes updates active map line styling."

5. **PIN Auth Screen**:
   > "Add a new 'Rider Profile' login screen overlay. Include large text inputs for 'First Name' and 'Last Name', and a massive 4-digit numeric keypad for entering a PIN code with gloves on. Add a large 'Enter Map' button."

6. **Privacy Toggle**:
   > "Create a 'Finish Route' modal to categorize and submit the track. Add a 'Visibility' section with a 3-way segmented toggle: 'Private (Only Me)', 'Shared (Specific Riders)', and 'Public'. Set the default active state to 'Private'."

---

## 4. Google Antigravity Agent Execution Strategy

### Step 1: Workspace Seeding
Place the exported `DESIGN.md` and this specification document (as `project_spec.md`) in the root of the Antigravity workspace.

### Step 2: Frontend & Agent Manager Prompt
> "Agent Manager: Initialize a Next.js project with Tailwind CSS configured for Vercel deployment. Connect Mapbox GL JS and Supabase PostGIS.
> 
> Read DESIGN.md and project_spec.md. Implement the full responsive navigation UI supporting both mobile phone viewports and roll-cage tablet displays (using md: and lg: breakpoints). Implement the multi-modal transport selector (UTV, MTB, Hike).
> 
> Implement a lightweight authentication system: use a custom 'riders' table storing the user's Name and a hashed 4-digit PIN. Build the 'Record Route' feature to default to 'private' visibility, and enforce this privacy strictly using Supabase Row Level Security (RLS) policies."

### Step 3: Asynchronous Backend Agent Delegations
- **Database Agent**: Apply the Supabase migration script defining the `trails`, `hazard_reports`, and `riders` tables with PostGIS extensions and RLS policies.
- **Routing Agent**: Configure pgRouting / Valhalla routing profiles using the respective cost columns based on the user's active mode.
- **Track Ingestion Agent**: Build a Supabase Edge Function to process recorded GPX/GeoJSON user tracks using `ST_SimplifyPreserveTopology`.

---

## 5. Scraper Target URLs & Pilot Data Seeding

### Scraper Pilot County URLs:
- **Washburn County**: [https://co.washburn.wi.us/atv-trail-status/](https://co.washburn.wi.us/atv-trail-status/)
- **Burnett County**: [https://www.burnettcountywi.gov/364/Trail-Updates](https://www.burnettcountywi.gov/364/Trail-Updates)

> **Important Scraper Rule**: The scraper must specifically look for keywords related to fire danger, as Washburn County trails automatically close when the DNR fire danger reaches "very high" status or higher.

### Seed Geographic Data (`/seed-data/pilot-trails.geojson`):
- Contains initial features for the Wild Rivers State Trail (Minong to Trego segment) and Burnett County connectors.
- After building the `trails` table, run the ingestion seed script to import these geometries with default `cost_utv = 0.5`.

