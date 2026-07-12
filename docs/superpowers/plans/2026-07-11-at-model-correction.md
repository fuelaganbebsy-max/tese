# AT Model Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the AT stair concrete and reinforcement model against 22G101-2 pages 1-8 and 2-8, with one tested domain result feeding every visual and data consumer.

**Architecture:** Pure AT domain helpers own the page 1-8 concrete profile, page 2-8 bar paths, anchor checks, and quantities. Three.js, SVG, HUD, persistence, and AI context consume those results without re-deriving rules. The stair store migrates from version 1 to 2 for transverse stair-beam lengths.

**Tech Stack:** TypeScript, Vitest, React 18, Zustand persist, Three.js, @react-three/fiber, Vite.

**Session rule:** Do not commit, push, or rewrite the user's existing `main` history. Use tests and `git diff` as checkpoints.

---

## File Structure

- Modify `src/domain/at/types.ts`: AT input types and stair-beam transverse length.
- Modify `src/domain/codes/22G101-stair.ts`: exact non-seismic `lab` table.
- Modify `src/domain/at/derive.ts`: page 1-8 layout, concrete profile, counts, checks, and defaults.
- Create `src/domain/at/rebarLayout.ts`: page 2-8 plain-coordinate bar paths and layer stations.
- Create `src/domain/at/quantities.ts`: deterministic grouped quantity rows.
- Modify `src/domain/__tests__/stair.test.ts`: domain, path, geometry, and quantity regression tests.
- Modify `src/store/stairStore.ts`: version-2 migration and deep normalization.
- Create `src/store/__tests__/stairStore.test.ts`: old-payload migration tests.
- Modify `src/main.tsx`: include corrupted stair-store cleanup.
- Modify `src/geometry/buildStair.ts`: consume the vertical-clipped concrete profile and beam lengths.
- Modify `src/geometry/buildStairRebar.ts`: convert domain paths into Three.js tubes only.
- Modify `src/scene/StairScene.tsx`: bounds and rendering for transverse beam overhang.
- Modify `src/ui/param/StairParamContent.tsx`: transverse beam lengths and validation results.
- Modify `src/ui/data/StairDataContent.tsx`: shared longitudinal paths, 1-1 view, and exact quantity rows.
- Modify `src/ui/ViewportHud.tsx`: consume `totalBarCount`.
- Modify `src/ui/ai/agentTools.ts`: supported AT context and tool results.
- Modify `src/ui/ai/AssistantPanel.tsx`: pass current stair params.
- Modify `src/ui/ai/__tests__/agentTools.test.ts`: AT context regression.
- Modify `docs/ai-agent-evals.md`: add AT scenario E-08.

### Task 1: Page 1-8 Domain Geometry and Exact `lab`

**Files:**
- Modify: `src/domain/at/types.ts`
- Modify: `src/domain/codes/22G101-stair.ts`
- Modify: `src/domain/at/derive.ts`
- Test: `src/domain/__tests__/stair.test.ts`

- [ ] **Step 1: Replace assumption-based tests with page 1-8 and table regressions**

Add focused assertions before changing production code:

```ts
import { lab } from '../codes/22G101-stair';

it('uses the 22G101-2 non-seismic basic anchor table', () => {
  expect(lab('HPB300', 10, 'C30')).toBe(300);
  expect(lab('HRB400', 10, 'C30')).toBe(350);
  expect(lab('HRB500', 10, 'C30')).toBe(430);
});

it('clips the page 1-8 soffit vertically at both beam faces', () => {
  const p = defaultStair();
  const d = deriveStair(p);
  const verticalDepth = p.h / Math.cos(d.layout.angle);
  expect(d.layout.soffitLow).toEqual({ x: 0, y: expect.closeTo(-verticalDepth, 6) });
  expect(d.layout.soffitHigh).toEqual({ x: p.ln, y: expect.closeTo(p.Hs - verticalDepth, 6) });
});

it('models m treads and m plus one risers', () => {
  const p = { ...defaultStair(), stepCount: 12, ln: 3080, Hs: 1800 };
  const d = deriveStair(p);
  expect(d.layout.treadCount).toBe(11);
  expect(d.layout.run).toBe(280);
  expect(d.layout.rise).toBe(150);
  expect(d.layout.concreteProfile.filter((point) => point.kind === 'tread')).toHaveLength(11);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts`

Expected: FAIL because `lab` still delegates to seismic `laE`, soffit endpoints do not exist, and the profile contract is absent.

- [ ] **Step 3: Add the exact table and page 1-8 layout contract**

Implement an explicit factor table:

```ts
const LAB_FACTORS: Record<RebarGrade, Record<ConcreteGrade, number>> = {
  HPB300: { C25: 34, C30: 30, C35: 28, C40: 25, C45: 24, C50: 23 },
  HRB400: { C25: 40, C30: 35, C35: 32, C40: 29, C45: 28, C50: 27 },
  HRB500: { C25: 48, C30: 43, C35: 39, C40: 36, C45: 34, C50: 32 },
};

export function lab(grade: RebarGrade, d: number, concrete: ConcreteGrade): number {
  return LAB_FACTORS[grade][concrete] * d;
}
```

Add `length` to `StairBeamSpec`, set both default lengths to `2100`, and derive a concrete profile whose soffit is vertically clipped at `x=0` and `x=ln`. Keep `stepCount` as `m+1`.

- [ ] **Step 4: Add deterministic validation data**

Use this public shape instead of throwing from rendering code:

```ts
export interface StairCheck {
  code: 'beam-length' | 'top-anchor' | 'bottom-overrun' | 'layer-fit' | 'geometry';
  severity: 'error' | 'warning';
  message: string;
  end?: 'low' | 'high';
  required?: number;
  provided?: number;
  ok: boolean;
}
```

Return checks from `deriveStair` and add `totalBarCount` to its result.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts`

Expected: PASS for page 1-8 geometry and exact `lab` assertions.

### Task 2: Page 2-8 Pure Rebar Paths

**Files:**
- Create: `src/domain/at/rebarLayout.ts`
- Modify: `src/domain/at/derive.ts`
- Modify: `src/domain/__tests__/stair.test.ts`

- [ ] **Step 1: Write path tests before the helper exists**

```ts
import { deriveStairRebarLayout } from '../at/rebarLayout';

it('places all layer centerlines inside the slab without collisions', () => {
  const p = defaultStair();
  const r = deriveStairRebarLayout(p);
  expect(r.offsets.topLongitudinal).toBe(p.cover + p.topBar.diameter / 2);
  expect(r.offsets.topDistribution).toBeGreaterThan(r.offsets.topLongitudinal);
  expect(r.offsets.bottomDistribution).toBeLessThan(r.offsets.bottomLongitudinal);
  expect(r.offsets.bottomLongitudinal).toBe(p.h - p.cover - p.bottomBar.diameter / 2);
});

it('uses ln over four as a horizontal top-bar projection', () => {
  const p = defaultStair();
  const r = deriveStairRebarLayout(p);
  expect(r.lowTop.spanEnd.x).toBeCloseTo(p.ln / 4, 6);
  expect(r.highTop.spanEnd.x).toBeCloseTo(p.ln * 3 / 4, 6);
});

it('extends bottom bars five diameters past support centers and hooks down 15d', () => {
  const p = defaultStair();
  const r = deriveStairRebarLayout(p);
  const lowHookTop = r.bottom.points[1];
  const lowHookBottom = r.bottom.points[0];
  expect(lowHookTop.x).toBeCloseTo(-p.lowBeam.width / 2 - 5 * p.bottomBar.diameter * r.layout.dir.x, 6);
  expect(lowHookTop.y - lowHookBottom.y).toBe(15 * p.bottomBar.diameter);
});

it('hooks top bars at beam edges instead of the span cutoff', () => {
  const p = defaultStair();
  const r = deriveStairRebarLayout(p);
  expect(r.lowTop.supportTop.x).toBe(-p.lowBeam.width);
  expect(r.lowTop.supportTop.y - r.lowTop.supportBottom.y).toBe(15 * p.topBar.diameter);
  expect(r.lowTop.spanEnd.x).toBe(p.ln / 4);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts`

Expected: FAIL because `deriveStairRebarLayout` does not exist.

- [ ] **Step 3: Implement plain-coordinate paths**

Create `StairPoint2`, `StairPolyline2`, named top/bottom paths, layer offsets, width stations, and validation values. Use a helper that evaluates an inward-offset line at a requested horizontal `x`:

```ts
function pointAtX(layout: StairLayout, x: number, inwardOffset: number): StairPoint2 {
  return { x, y: Math.tan(layout.angle) * x - inwardOffset / Math.cos(layout.angle) };
}
```

Top support hooks are at the beam outer edges, top span ends are straight at horizontal `ln/4`, and bottom support endpoints are exactly `5d` beyond each support center along the inclined direction.

- [ ] **Step 4: Verify RED-GREEN and all stair-domain tests**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts`

Expected: PASS with no horizontal support-anchor expectations remaining.

### Task 3: Persisted Parameters and Migration

**Files:**
- Modify: `src/store/stairStore.ts`
- Create: `src/store/__tests__/stairStore.test.ts`
- Modify: `src/main.tsx`
- Modify: `src/ui/param/StairParamContent.tsx`

- [ ] **Step 1: Write migration tests for version-1 payloads**

```ts
import { migrateStairPersistedState } from '../stairStore';

it('adds transverse beam lengths to a version-1 stair payload', () => {
  const old = { params: { ...defaultStair(), lowBeam: { width: 250, height: 350 }, highBeam: { width: 300, height: 400 } } };
  const migrated = migrateStairPersistedState(old, 1);
  expect(migrated.params.lowBeam.length).toBe(migrated.params.b + 600);
  expect(migrated.params.highBeam.length).toBe(migrated.params.b + 600);
});

it('deep-fills nested rebar and beam defaults', () => {
  const migrated = migrateStairPersistedState({ params: { ln: 3200, lowBeam: { width: 280 } } }, 1);
  expect(migrated.params.lowBeam.height).toBe(defaultStair().lowBeam.height);
  expect(migrated.params.bottomBar.spacing).toBe(defaultStair().bottomBar.spacing);
});
```

- [ ] **Step 2: Run migration tests and verify RED**

Run: `npm.cmd test -- src/store/__tests__/stairStore.test.ts`

Expected: FAIL because the pure migration and length fields do not exist.

- [ ] **Step 3: Implement version-2 migration and deep normalization**

Export `migrateStairPersistedState`, bump the persist version to 2, deep-merge both beam objects and all rebar specs, and derive missing beam lengths as `normalized.b + 600`. Preserve valid explicit lengths.

Add `rebar-3d-stair` to the corrupted-JSON cleanup list in `src/main.tsx`.

- [ ] **Step 4: Add beam-length controls and issue summaries**

Add low/high `length` numeric fields labelled `梯梁横向长度`. Show derived error/warning messages under the support section; do not silently label an invalid detail compliant.

- [ ] **Step 5: Verify migration tests GREEN**

Run: `npm.cmd test -- src/store/__tests__/stairStore.test.ts src/domain/__tests__/stair.test.ts`

Expected: PASS.

### Task 4: Three.js Geometry and Shared Sections

**Files:**
- Modify: `src/geometry/buildStair.ts`
- Modify: `src/geometry/buildStairRebar.ts`
- Modify: `src/scene/StairScene.tsx`
- Modify: `src/ui/data/StairDataContent.tsx`
- Modify: `src/ui/ViewportHud.tsx`
- Modify: `src/domain/__tests__/stair.test.ts`

- [ ] **Step 1: Rewrite builder regressions to demand domain paths**

Replace the current test that expects horizontal beam segments with assertions that the first/last Three.js points match `deriveStairRebarLayout`. Add a concrete bounding-box test proving each beam's `z` size equals its own transverse length and exceeds the flight width by default.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts`

Expected: FAIL against the existing horizontal-anchor builder and equal-width beams.

- [ ] **Step 3: Make geometry builders adapters only**

`buildStairConcrete` extrudes `layout.concreteProfile` and uses `beam.length` for `BoxGeometry` depth. `buildStairRebar` maps domain 2D paths and width stations to `THREE.Vector3`, computes polyline lengths, and preserves named groups (`bottom`, `top-low`, `top-high`, `distribution-top`, `distribution-bottom`).

Update scene bounds so `z` includes the longer of the low/high beam lengths.

- [ ] **Step 4: Make the data panel share the same geometry**

The longitudinal SVG consumes the domain concrete profile and one representative named path from each bar group. Add a segmented view for `纵向配筋` and `1-1 横截面`; the transverse view uses the four domain layer offsets and actual bar diameters.

Use `derived.totalBarCount` in `ViewportHud`.

- [ ] **Step 5: Verify focused tests and TypeScript build**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts`

Run: `npm.cmd run build`

Expected: both commands exit 0.

### Task 5: Exact Quantities and AT AI Context

**Files:**
- Create: `src/domain/at/quantities.ts`
- Modify: `src/ui/data/StairDataContent.tsx`
- Modify: `src/ui/ai/agentTools.ts`
- Modify: `src/ui/ai/AssistantPanel.tsx`
- Modify: `src/ui/ai/__tests__/agentTools.test.ts`
- Modify: `docs/ai-agent-evals.md`
- Test: `src/domain/__tests__/stair.test.ts`

- [ ] **Step 1: Write failing quantity and AI-context tests**

```ts
it('keeps unequal low and high top-bar lengths as separate rows', () => {
  const p = { ...defaultStair(), lowBeam: { ...defaultStair().lowBeam, width: 250 }, highBeam: { ...defaultStair().highBeam, width: 400 } };
  const rows = deriveStairQuantityRows(p);
  expect(rows.find((row) => row.mark === 'T-L')?.length).not.toBe(rows.find((row) => row.mark === 'T-H')?.length);
});

it('summarizes AT page 1-8 geometry and page 2-8 anchors', () => {
  const context = buildAgentContext({
    memberType: 'AT', memberLabel: 'AT 型楼梯',
    beamParams: defaultBeam(), columnParams: defaultColumn(), stairParams: defaultStair(),
  });
  expect(context.atlas).toBe('22G101-2');
  expect(context.toolResults.map((tool) => tool.tool)).toContain('calculate_stair_anchor_checks');
  expect(serializeAgentContext(context)).toContain('2-8');
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts src/ui/ai/__tests__/agentTools.test.ts`

Expected: FAIL because grouped quantities and supported AT context are absent.

- [ ] **Step 3: Implement quantities and AT context**

Derive rows from named domain paths, never from averaged Three.js bars. Extend the `AgentContext` union with AT params/derived values, add geometry and anchorage tool results, and pass `stairParams` from `AssistantPanel`.

Add E-08 to `docs/ai-agent-evals.md`: current AT geometry/anchor question must use local values and identify page 1-8 versus page 2-8 without inventing other pages.

- [ ] **Step 4: Verify AI and quantity tests GREEN**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts src/ui/ai/__tests__/agentTools.test.ts`

Run: `npm.cmd test -- src/ui/ai/__tests__`

Expected: PASS.

### Task 6: Full Verification and Visual Acceptance

**Files:**
- Inspect all changed files
- No new production behavior unless a verified failure requires a focused fix

- [ ] **Step 1: Run the full automated gate**

Run: `npm.cmd test`

Expected: 0 failed files and 0 failed tests.

Run: `npm.cmd run build`

Expected: exit 0 with Vite output generated successfully.

- [ ] **Step 2: Start the development server and inspect desktop**

Run: `npm.cmd run dev -- --host 127.0.0.1 --port 5173`

Inspect AT at a desktop viewport. Confirm the canvas has non-background pixels, orbit/reset work, beams overhang both stair sides, the slab has vertical support joints, and hiding rebar leaves a page 1-8-consistent concrete shape.

- [ ] **Step 3: Inspect rebar and sections**

Show rebar and confirm top/bottom layers remain inside concrete, hooks occur at support ends, `ln/4` is a horizontal projection, bottom bars pass support centers, and the 1-1 view has four non-intersecting layers matching page 2-8.

- [ ] **Step 4: Inspect mobile/narrow layout**

Use a narrow viewport and confirm the scene remains nonblank; labels, toggles, warnings, longitudinal section, and 1-1 section do not overlap or resize controls unexpectedly.

- [ ] **Step 5: Run final review**

Inspect `git status --short --branch` and `git diff`. Dispatch a spec-compliance reviewer followed by a code-quality reviewer. Fix every Critical or Important finding and rerun the affected tests plus the full gate.

