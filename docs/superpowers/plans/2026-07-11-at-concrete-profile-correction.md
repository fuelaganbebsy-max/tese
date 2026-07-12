# AT Concrete Profile Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the invalid AT stepped soffit with the exact 22G101-2 straight waist-slab profile while leaving reinforcement behavior unchanged.

**Architecture:** `deriveStair()` adds a dedicated `concretePitch` value and owns one simple closed slab profile. Three.js and the longitudinal SVG continue to consume the profile without recalculating it. Existing top-level pitch fields remain compatibility inputs for reinforcement until the separate reinforcement correction.

**Tech Stack:** TypeScript, Vitest, Three.js, React 18, @react-three/fiber, Vite.

**Session rule:** Work in the current checkout because the correction depends on the user's uncommitted AT implementation. Do not commit, stage, reset, or rewrite unrelated changes.

---

## File Structure

- Modify `src/domain/at/derive.ts`: add the concrete-only pitch contract, simple slab profile, and support-depth checks.
- Modify `src/domain/__tests__/stair.test.ts`: encode the atlas pitch, straight soffit, simple polygon, and support interfaces before implementation.
- Inspect `src/geometry/buildStair.ts`: keep it as a profile-to-Three.js adapter; no production edit is expected.
- Inspect `src/ui/data/StairDataContent.tsx`: confirm the longitudinal section consumes `layout.concreteProfile`; no production edit is expected.

### Task 1: Lock The Atlas Concrete Contract With Failing Tests

**Files:**
- Modify: `src/domain/__tests__/stair.test.ts`
- Test: `src/domain/__tests__/stair.test.ts`

- [x] **Step 1: Replace the incorrect vertical-depth assertion**

Add an assertion that distinguishes `hs/bs` from `Hs/ln`:

```ts
it('uses the hs over bs waist pitch from atlas page 2-8', () => {
  const p: StairParams = { ...defaultStair(), stepCount: 12, ln: 3080, Hs: 1800, h: 120 };
  const d = deriveStair(p);
  const hs = 150;
  const bs = 280;
  const theta = Math.atan2(hs, bs);
  const verticalDepth = p.h / Math.cos(theta);

  expect(d.layout.concretePitch.flightRise).toBe(1650);
  expect(d.layout.concretePitch.angle).toBeCloseTo(theta, 8);
  expect(d.layout.concretePitch.slantLength).toBeCloseTo(Math.hypot(p.ln, 1650), 8);
  expect(d.layout.concretePitch.verticalDepth).toBeCloseTo(verticalDepth, 8);
  expect(d.layout.soffitLow).toEqual({ x: 0, y: expect.closeTo(-verticalDepth, 8) });
  expect(d.layout.soffitHigh).toEqual({ x: p.ln, y: expect.closeTo(1650 - verticalDepth, 8) });
});
```

- [x] **Step 2: Add the exact top/profile ordering regression**

```ts
it('ends the slab at the last tread and uses one straight soffit segment', () => {
  const p: StairParams = { ...defaultStair(), stepCount: 12, ln: 3080, Hs: 1800 };
  const d = deriveStair(p);
  const profile = d.layout.concreteProfile;
  const soffit = profile.filter((point) => point.kind === 'soffit');

  expect(profile.filter((point) => point.kind === 'tread')).toHaveLength(11);
  expect(profile.filter((point) => point.kind === 'riser')).toHaveLength(11);
  expect(profile.some((point) => point.x === p.ln && point.y === p.Hs)).toBe(false);
  expect(soffit).toEqual([
    { ...d.layout.soffitHigh, kind: 'soffit' },
    { ...d.layout.soffitLow, kind: 'soffit' },
  ]);
  expect(profile[profile.length - 3]).toMatchObject({ x: p.ln, y: 1650, kind: 'tread' });
});
```

Add a local segment-intersection helper and assert that no non-adjacent profile segments intersect. Adjacent segments and the first/last closing pair are excluded from the pair scan.

- [x] **Step 3: Add support-depth checks**

```ts
it('reports stair beams that do not fill the slab end interfaces', () => {
  const base = defaultStair();
  const p: StairParams = {
    ...base,
    lowBeam: { ...base.lowBeam, height: 100 },
    highBeam: { ...base.highBeam, height: 200 },
  };
  const checks = deriveStair(p).checks.filter((check) => check.code === 'support-depth');

  expect(checks).toHaveLength(2);
  expect(checks.map((check) => check.ok)).toEqual([false, false]);
  expect(checks[0].required).toBeGreaterThan(100);
  expect(checks[1].required).toBeGreaterThan(200);
});
```

- [x] **Step 4: Run the focused test and verify RED**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts`

Expected: FAIL because `concretePitch` and `support-depth` do not exist, the current soffit is offset vertically by `h`, and the current profile contains a stepped/self-overlapping lower contour.

### Task 2: Implement The Minimal Correct Concrete Profile

**Files:**
- Modify: `src/domain/at/derive.ts`
- Test: `src/domain/__tests__/stair.test.ts`

- [x] **Step 1: Add the concrete pitch contract without changing reinforcement fields**

```ts
export interface StairConcretePitch {
  flightRise: number;
  angle: number;
  slantLength: number;
  dir: { x: number; y: number };
  normal: { x: number; y: number };
  verticalDepth: number;
}
```

Add `concretePitch: StairConcretePitch` to `StairLayout`. Retain the existing top-level `angle`, `slantLength`, `dir`, and `normal` calculations unchanged as reinforcement compatibility fields.

- [x] **Step 2: Derive the atlas pitch and simple profile**

```ts
const flightRise = treadCount * rise;
const concreteSlantLength = Math.hypot(params.ln, flightRise);
const concreteDir = { x: params.ln / concreteSlantLength, y: flightRise / concreteSlantLength };
const concreteNormal = { x: concreteDir.y, y: -concreteDir.x };
const concreteAngle = Math.atan2(flightRise, params.ln);
const verticalDepth = params.h / Math.cos(concreteAngle);
const concretePitch = {
  flightRise,
  angle: concreteAngle,
  slantLength: concreteSlantLength,
  dir: concreteDir,
  normal: concreteNormal,
  verticalDepth,
};
const soffitLow = { x: 0, y: -verticalDepth };
const soffitHigh = { x: params.ln, y: flightRise - verticalDepth };
```

Build the top contour as `(0,0) -> (0,rise)`, then `m` treads with only `m-1` interior risers. Append `{ ...soffitHigh, kind: 'soffit' }` and `{ ...soffitLow, kind: 'soffit' }`, then close the shape in Three.js.

- [x] **Step 3: Add deterministic support-depth validation**

Extend `StairCheck['code']` with `support-depth`. Required low depth is `verticalDepth`; required high depth is `rise + verticalDepth`. Return one check per end with `required`, `provided`, and `ok`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts`

Expected: PASS, including pitch, profile simplicity, support depth, Three.js bounding boxes, and existing reinforcement regressions.

- [x] **Step 5: Run all stair-focused tests**

Run: `npm.cmd test -- src/domain/__tests__/stair.test.ts src/domain/__tests__/stairQuantities.test.ts src/store/__tests__/stairStore.test.ts`

Expected: PASS with no reinforcement test expectation changes.

### Task 3: Full Gate And Concrete-Only Visual Acceptance

**Files:**
- Inspect: `src/domain/at/derive.ts`
- Inspect: `src/geometry/buildStair.ts`
- Inspect: `src/ui/data/StairDataContent.tsx`
- Inspect: `src/scene/StairScene.tsx`

- [x] **Step 1: Run full automated verification**

Run: `npm.cmd test`

Expected: all test files and tests pass.

Run: `npm.cmd run build`

Expected: TypeScript and Vite build exit 0.

- [x] **Step 2: Reload the existing local AT session**

Use the existing `http://127.0.0.1:5173` development server. Select AT, hide reinforcement and annotations, and reset the camera.

- [x] **Step 3: Capture the side/underside acceptance view**

Verify that:

- the soffit is one straight inclined plane;
- the first tread starts above the low-beam top;
- the last tread is at `Hs-hs`;
- the high-beam face supplies the final rise to `Hs`;
- both beams fill the slab end interfaces;
- no platform plate is present;
- both end beams remain fully in frame.

- [ ] **Step 4: Review the final diff**

Confirm no reinforcement implementation file changed. Dispatch a specification reviewer and then a code-quality reviewer. Fix every Critical or Important issue and rerun affected tests plus the full gate.
