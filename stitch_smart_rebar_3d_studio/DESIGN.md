---
name: Aero-Precision Engineering
colors:
  surface: '#101415'
  surface-dim: '#101415'
  surface-bright: '#363a3b'
  surface-container-lowest: '#0b0f10'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#272a2c'
  surface-container-highest: '#323537'
  on-surface: '#e0e3e5'
  on-surface-variant: '#bac9cc'
  inverse-surface: '#e0e3e5'
  inverse-on-surface: '#2d3133'
  outline: '#849396'
  outline-variant: '#3b494c'
  surface-tint: '#00daf3'
  primary: '#c3f5ff'
  on-primary: '#00363d'
  primary-container: '#00e5ff'
  on-primary-container: '#00626e'
  inverse-primary: '#006875'
  secondary: '#bec6e0'
  on-secondary: '#283044'
  secondary-container: '#3f465c'
  on-secondary-container: '#adb4ce'
  tertiary: '#e4edff'
  on-tertiary: '#233144'
  tertiary-container: '#c3d1ea'
  on-tertiary-container: '#4c5a6f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cf0ff'
  primary-fixed-dim: '#00daf3'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d5e3fd'
  tertiary-fixed-dim: '#b9c7e0'
  on-tertiary-fixed: '#0d1c2f'
  on-tertiary-fixed-variant: '#3a485c'
  background: '#101415'
  on-background: '#e0e3e5'
  surface-variant: '#323537'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  label-numeric:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.02em
  headline-md-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-page: 24px
  panel-width-side: 280px
  panel-width-inspector: 320px
  radius-inner: 4px
  radius-outer: 8px
---

## Brand & Style

The visual identity of the design system is anchored in **Professionalism**, **Precision**, and **Atmospheric Depth**. It is designed for engineers and architects who require a high-performance environment that minimizes eye fatigue while maximizing data density and spatial clarity.

The aesthetic direction is **Sophisticated Dark Mode with Glassmorphic Precision**. It utilizes translucent layers to maintain spatial context in 3D environments, paired with razor-sharp borders that evoke the feeling of high-end hardware interfaces. The atmosphere is quiet, focused, and powerful—moving away from generic "SaaS flat" into a more tactile, tool-oriented industrial workspace.

## Colors

This design system utilizes a deep-space palette to create a high-contrast environment for technical 3D modeling.

- **Primary (Electric Cyan):** Used exclusively for active states, selection highlights, and crucial data points. It represents the "energy" or "active focus" of the user.
- **Secondary (Deep Slate):** The foundational layer for sidebars and secondary navigation. 
- **Neutral:** A range of high-legibility greys and off-whites. Pure white is reserved for critical alerts or headers to maintain the dark-mode atmosphere.
- **Surface Strategy:** Backgrounds utilize a near-black slate. Overlays and panels use a glassmorphic blur to allow the 3D viewport to bleed through subtly, maintaining a sense of scale and presence.

## Typography

The typography system balances modern aesthetic appeal with rigorous technical utility.

- **Headlines (Hanken Grotesk):** Provides a sharp, contemporary "tech" feel for module titles and section headers.
- **Body (Inter):** The workhorse for all instructional text and interface labels, chosen for its exceptional legibility in dark mode and small sizes.
- **Data & Metrics (JetBrains Mono):** All coordinate values, measurements, and code-based inputs use a monospaced font. This ensures that columns of numbers align perfectly and remain legible during rapid scanning.

## Layout & Spacing

The design system employs a **Fixed-Fluid Hybrid** model. Navigation and Inspector panels are fixed-width to ensure tool predictability, while the central 3D viewport is fluid, expanding to fill all available workspace.

- **The 4px Grid:** All components and spacing increments are multiples of 4px. This "dense" grid supports the complex information architecture of engineering software.
- **Z-Axis Hierarchy:** Floating toolbars and HUD elements occupy the highest layer, using 16px margins from the screen edge. 
- **Breakpoints:** 
  - *Desktop (1440px+):* Full dual-panel layout (Sidebar + Inspector).
  - *Laptop (1024px):* Collapsible sidebar, persistent Inspector.
  - *Tablet (768px):* Single-panel focus mode with bottom-sheet inputs.

## Elevation & Depth

Hierarchy is established through **Backdrop Saturation and Border Luminance** rather than traditional drop shadows.

- **Level 0 (Canvas):** The underlying 3D environment or base background.
- **Level 1 (Panels):** Semi-transparent surfaces (80% opacity) with a `20px` backdrop blur. These are defined by a `1px` solid border in `rgba(255, 255, 255, 0.1)`.
- **Level 2 (Modals/Popovers):** Higher opacity (95%) with a secondary inner "glow" border in Primary Cyan at 10% opacity to indicate focus.
- **Active State:** When an element is selected, it emits a subtle outer cyan glow (blur: 8px, spread: 0) to mimic a powered-on light source.

## Shapes

The design system uses **Soft Geometry**. 

A `4px` (0.25rem) base radius is applied to all UI components. This small radius maintains a disciplined, professional look that feels modern without becoming too "consumer-friendly" or bubbly. Large container panels may use an `8px` radius for structural distinction. Input fields and chips retain the `4px` standard to maximize internal space for text.

## Components

- **Buttons:**
  - *Primary:* Solid Electric Cyan with black text for maximum contrast.
  - *Secondary:* Ghost style with a 1px slate border and cyan hover state.
  - *IconButton:* Transparent background, becomes Primary Cyan on hover.
- **Input Fields:**
  - Dark Slate background (`#0F172A`) with a subtle 1px border. 
  - Active state: Border changes to Primary Cyan with a JetBrains Mono typeface for numeric values.
- **Chips / Tags:**
  - Low-profile, dark backgrounds with colored text (e.g., status indicators). Used for object properties (e.g., "Steel Grade", "Reinforcement Type").
- **Cards & Panels:**
  - Use the glassmorphic style. Headers should have a subtle bottom divider to separate metadata from the main content.
- **Data Grids:**
  - Alternating row highlights (Zebra striping) using a very subtle `rgba(255, 255, 255, 0.02)`.
  - Column headers in JetBrains Mono, uppercase, with 0.05em letter spacing.
- **3D Gizmos:**
  - Floating UI elements in the viewport should use high-saturation Primary colors (Cyan for X, Magenta for Y, Yellow for Z) to ensure visibility against complex 3D meshes.