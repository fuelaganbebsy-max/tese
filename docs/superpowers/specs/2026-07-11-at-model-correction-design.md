# AT Model Correction Design

## Goal

Correct the Alpha-7 AT stair model using two explicit sources of truth from 22G101-2:

- Page 1-8 defines the AT concrete shape and support relationship.
- Page 2-8 defines the AT slab reinforcement layout.

The corrected domain result must drive 3D geometry, longitudinal/transverse sections, quantities, HUD summaries, and AI tool context.

## Scope

Included:

- AT tread flight, inclined waist slab, low-end stair beam, and high-end stair beam.
- Exact step relationships `Hs = hs * (m + 1)` and `ln = bs * m`.
- Beam-bent top longitudinal bars, continuous bottom longitudinal bars, and two-layer distribution bars.
- Non-seismic `lab` lookup for HPB300, HRB400, and HRB500 with C25-C50 concrete.
- Persistence migration for the new stair-beam transverse length.
- Longitudinal and 1-1 transverse section representations.
- AT quantity rows, HUD summary, and bounded AI tool context.
- Focused unit, migration, geometry, and AI-context tests plus browser visual verification.

Excluded:

- BT, CT, DT, ET, FT, GT, and sliding-support stair types.
- Reinforcement design inside stair beams, platforms, or stair columns; those belong to 22G101-1.
- The optional dashed top-bar route directly into a platform slab. The default AT scene has stair beams but no modeled platform slab, so it uses the solid beam-bent detail from page 2-8.
- A general multi-type stair engine.

## Page 1-8 Concrete Contract

### Tread Flight

`stepCount` represents `m + 1`, the number shown in the stair concentrated annotation. Therefore:

- `rise = Hs / stepCount`
- `treadCount = stepCount - 1 = m`
- `run = ln / treadCount`

The top profile contains exactly `m` horizontal treads and `m + 1` vertical risers. AT contains only this tread flight between its two stair beams; no low, middle, or high platform plate is added.

### Waist Slab

The step-root line joins `(0, 0)` to `(ln, Hs)`. The soffit is parallel to that line and is offset inward by the perpendicular slab thickness `h`.

The slab is clipped at the vertical inner faces of the stair beams:

- Low support face: `x = 0`
- High support face: `x = ln`

If `theta = atan2(Hs, ln)`, the soffit intersections are:

- Low: `(0, -h / cos(theta))`
- High: `(ln, Hs - h / cos(theta))`

This gives full-depth vertical joints with both beams. The current perpendicular end faces, which only touch the low beam near a point, are removed.

### Stair Beams

Each `StairBeamSpec` has three dimensions:

- `width`: along the stair run (`x`)
- `height`: vertical (`y`)
- `length`: transverse to the stair run (`z`)

Beam inner faces bound the clear flight. The low beam occupies `[-lowBeam.width, 0]`; the high beam occupies `[ln, ln + highBeam.width]`. Beam length must be at least the stair width `b`; defaults show an overhang on both sides as depicted in the page 1-8 plan and axonometric views.

Low beam top aligns with the first tread at elevation `0`. High beam top aligns with elevation `Hs` and the final riser meets its inner face.

## Page 2-8 Reinforcement Contract

All reinforcement paths are first derived as plain coordinates under `src/domain/at/**`. Three.js and SVG consumers convert those coordinates but do not recalculate engineering rules.

### Cover and Layer Order

The inward slab normal points from the step-root line toward the soffit. Bar centerlines include bar radii:

- Top longitudinal offset: `cover + topDiameter / 2`
- Bottom longitudinal offset: `h - cover - bottomDiameter / 2`
- Top distribution offset: below top longitudinal, separated by the two radii
- Bottom distribution offset: above bottom longitudinal, separated by the two radii

The 1-1 section must show longitudinal bar circles and transverse distribution bars as distinct, non-intersecting layers. Width-direction bar centers also use `cover + diameter / 2` rather than putting centers directly on the cover boundary.

### Bottom Longitudinal Bars

Bottom bars run continuously along the lower layer. At each support they continue on the same inclined line past the stair-beam centerline by at least `5d`, then bend vertically downward by `15d`.

The model uses exactly `5d` beyond the centerline for the standard path and reports whether the available half-beam width can contain it. It does not replace the inclined support segment with a horizontal `la` segment.

### Top Longitudinal Bars

Independent top bars are placed at the low and high supports.

- The span-side cutoff is located by a horizontal projection of `ln / 4` from the relevant beam inner face.
- The support-side path continues on the inclined top-layer line to the beam outer edge.
- At the beam outer edge it bends vertically downward by `15d`.
- The span-side cutoff has no invented `15d` hook.

Required support anchorage is selected by `topAnchorMode`:

- `hinge`: `0.35lab`
- `full`: `0.6lab`

The provided inclined length inside each beam is compared with the requirement and surfaced as a validation check.

### Distribution Bars

Distribution bars run across the stair width and are stationed along the inclined flight. Page 2-8 section 1-1 requires both top and bottom distribution layers. Counts use the available centerline range after cover and radius are applied.

## Domain API

`deriveStair(params)` remains the main pure entry point and returns:

- Step and support layout.
- Plain concrete profile points shared by 3D and section views.
- Exact bar counts and total-bar count.
- Non-seismic `lab`, top anchorage requirements, support-provided lengths, `5d`, and `15d` values.
- Validation checks for beam transverse length, top anchor capacity, bottom `5d` capacity, cover/layer fit, and finite geometry.

A pure AT rebar-layout helper returns named low-top, high-top, bottom, top-distribution, and bottom-distribution paths. `buildStairRebar` only turns these paths into tube geometries and metadata.

## Parameters and Persistence

`StairBeamSpec.length` is added. Defaults use `b + 600mm`, giving a 300mm transverse overhang on each side. Old persisted stair data is migrated by deep-merging nested beam and rebar objects with defaults and deriving a missing beam length as `stairWidth + 600mm`.

The stair store version increases from 1 to 2. Migration is implemented as an exported pure function so old payloads can be tested directly. Unknown or malformed payloads fall back without crashing.

`topExtend` remains the stored field but is explicitly a horizontal projection. Existing values retain their intended meaning; only the erroneous geometry interpretation changes.

## Consumers

### 3D and Sections

- Concrete geometry consumes the domain concrete profile and each beam's transverse length.
- Rebar geometry consumes domain paths and bar positions.
- The longitudinal section consumes the same profile and named rebar paths.
- A 1-1 transverse view shows the two longitudinal and two distribution layers.

### Quantities and HUD

Quantity rows preserve distinct low-support and high-support top bars when their lengths differ. Lengths come from the shared domain paths. HUD total counts come from derived totals rather than reconstructing the formula in React.

### AI Context

AT becomes a supported `22G101-2` agent context. Tool results expose current geometry, bar specs, `lab`, required/provided top anchorage, bottom `5d` checks, and source-page boundaries. The note must distinguish official page 1-8/page 2-8 facts from project rendering choices.

## Error Handling

Invalid geometry is never silently presented as compliant. Derived validation issues are deterministic data with a code, severity, message, required value, and provided value where applicable. The parameter/data UI shows these issues while keeping the scene renderable for diagnosis.

## Testing and Acceptance

TDD coverage includes:

- Page 1-8 step count and vertically clipped soffit endpoints.
- Beam placement and transverse overhang.
- Exact non-seismic `lab` factors.
- Top and bottom bar path endpoints, `ln/4`, `5d`, and `15d`.
- Bar centerlines inside the slab and non-intersecting 1-1 layers.
- Store version-1 migration to version 2.
- AT AI tool context.

Completion requires:

- Targeted tests pass after a verified red-green cycle.
- Full `npm.cmd test` passes.
- `npm.cmd run build` passes.
- Desktop and mobile browser checks show a nonblank canvas.
- With rebar hidden, concrete matches page 1-8 in longitudinal, plan, and axonometric relationships.
- With rebar visible, longitudinal paths and the 1-1 view match page 2-8.
