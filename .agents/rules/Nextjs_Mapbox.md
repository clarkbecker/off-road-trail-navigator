# Next.js & Mapbox Guidelines for Agents

## 1. Next.js Routing
- Use the **Next.js App Router** (`src/app/` structure). Do NOT create `pages/` directory.
- Preserve server-component boundaries where appropriate, but all Mapbox GL / map rendering components MUST be annotated with `'use client';` at the top of the file since Next.js server components cannot render DOM canvas/WebGL elements.
- Use dynamic imports (`next/dynamic` with `{ ssr: false }`) when embedding Mapbox components to prevent SSR hydration mismatch and missing `window`/`navigator` browser globals.

## 2. Mapbox & Geographic Coordinates
- Strictly enforce TypeScript types for coordinate tuples: `[longitude: number, latitude: number]` (or `[longitude: number, latitude: number, altitude?: number]`). Note that GeoJSON and Mapbox order is **[lng, lat]**, whereas Leaflet / Geolocation API uses **[lat, lng]**. Never invert them.
- All map feature layers, sources, and line strings must strictly adhere to valid GeoJSON standards (`GeoJSON.Feature<GeoJSON.LineString>`).
- Implement offline tile fallback and service worker caching strategies so the app remains navigable without cellular coverage in remote backcountry areas.

## 3. High-Contrast Outdoor & Glove UI
- Target minimum tap size: `48x48px` for buttons, `60x60px` for Primary Floating Action Buttons (FAB).
- Responsive layouts: Support handheld portrait (mobile) and roll-cage mounted tablets (8-10 inch) using `md:` and `lg:` breakpoints.
- Dark, high-contrast palette with vibrant safety accents (`orange-500`, `amber-400`, `emerald-400`, `red-500`).

## 4. Auth & Security
- Glove-friendly PIN authentication: User profile authentication uses First Name, Last Name, and a 4-digit PIN stored as a bcrypt hash.
- Supabase Row Level Security (RLS) is strictly enforced for all user trails. Newly recorded trails must default to `'private'`.
