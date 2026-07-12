# AT Concrete Profile Correction Design

## Goal

Correct only the AT stair concrete form against 22G101-2. Reinforcement paths, quantities, anchorage checks, persisted parameters, and reinforcement UI remain unchanged in this pass.

## Sources Of Truth

- PDF page 6, atlas page 1-8: AT consists only of a tread flight supported by a low-end and a high-end stair beam. It has no low or high platform plate.
- PDF page 13, atlas page 2-7: `Hs` is the tread-segment total height and `m+1` is the riser count.
- PDF page 14, atlas page 2-8: `hs * (m+1) = Hs`, `bs * m = ln`, and `ln` runs between the two stair-beam inner faces.

Rendered atlas drawings are authoritative where OCR text is incomplete.

## Geometry Contract

Let `n = stepCount = m+1`:

```text
m = n - 1
hs = Hs / n
bs = ln / m
flightRise = m * hs = Hs - hs
theta = atan2(hs, bs) = atan2(flightRise, ln)
slantLength = hypot(ln, flightRise)
verticalDepth = h / cos(theta)
```

The stair-root line runs from `(0, 0)` at the low-beam inner face to `(ln, flightRise)` at the high-beam inner face. It does not run to `(ln, Hs)`.

The slab top contour starts at `(0,0)`, rises to the first tread at `(0,hs)`, then contains `m` horizontal treads and `m-1` interior risers. It ends at `(ln,flightRise)`. The high stair-beam inner face supplies the final visible rise from `flightRise` to `Hs`.

The soffit is one straight line parallel to the stair-root line. Because `h` is the thickness normal to the inclined waist slab, its vertical intersections with the beam inner faces are:

```text
soffitLow = (0, -verticalDepth)
soffitHigh = (ln, flightRise - verticalDepth)
```

The closed slab profile continues from the last tread to `soffitHigh`, then to `soffitLow`, then back to `(0,0)`. It must be a simple polygon with no repeated or overlapping boundary segments.

## Beam Contract

Beam extents remain:

```text
low:  x=[-lowBeam.width, 0], y=[-lowBeam.height, 0]
high: x=[ln, ln+highBeam.width], y=[Hs-highBeam.height, Hs]
```

Each beam remains centered across its own transverse `length`. The beams fill the slab's vertical end interfaces; the slab does not expose standalone end caps.

The low beam must reach below `soffitLow`. The high beam must reach below `soffitHigh`. Insufficient support depth is reported as deterministic geometry validation rather than silently presented as compliant.

## Ownership And Consumers

`deriveStair(params)` owns the exact plain-coordinate concrete profile and a named `concretePitch` object containing `flightRise`, `angle`, `slantLength`, `dir`, `normal`, and `verticalDepth`. `buildStairConcrete` remains an adapter that extrudes the profile and builds the two beam boxes. The longitudinal SVG consumes the same profile, and concrete annotations consume `concretePitch`.

The existing top-level `angle`, `slantLength`, `dir`, and `normal` values are retained as the current reinforcement coordinate basis in this pass because the reinforcement layout and bar counts consume them. They are documented as compatibility fields and are not used for corrected concrete. Migrating reinforcement to `concretePitch` is explicitly deferred at the user's request.

## Testing

Focused tests must prove:

- `theta` uses `hs/bs`, not `Hs/ln`.
- `slantLength` uses `flightRise`.
- The top contour ends at `(ln,Hs-hs)` and does not duplicate the high-end beam riser.
- The soffit has exactly two endpoints and is a straight line.
- The perpendicular distance from both soffit endpoints to the stair-root line is `h`.
- The slab profile has no overlapping consecutive or non-consecutive segments.
- Three.js extrusion bounds match the corrected profile and beam boxes retain their existing extents.
- A concrete-only browser side view shows a straight inclined soffit and both beam interfaces fully framed.

## Non-Goals

- No reinforcement path, layer, anchorage, quantity, color, or AI-context change.
- No persisted schema or parameter change.
- No platform slab, stair-column, or stair-beam reinforcement modeling.
- No BT/CT/DT/ET/FT/GT behavior.
