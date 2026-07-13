import { describe, expect, it } from 'vitest';
import { defaultStair } from '../../domain/at/derive';
import { migrateStairPersistedState } from '../stairStore';

describe('stairStore persisted-state migration', () => {
  it('deep-normalizes version 1 params without mutating the persisted payload', () => {
    const persisted = {
      params: {
        ln: 3200,
        b: 1600,
        lowBeam: { width: 280, height: 360 },
        highBeam: { width: 300, height: 380, length: 2600 },
      },
      view: { showConcrete: false },
    };
    const before = structuredClone(persisted);

    const migrated = migrateStairPersistedState(persisted, 1);

    expect(migrated.params.lowBeam).toEqual({ width: 280, height: 360, length: 2200 });
    expect(migrated.params.highBeam).toEqual({ width: 300, height: 380, length: 2600 });
    expect(migrated.params.bottomBar).toEqual(defaultStair().bottomBar);
    expect(migrated.view).toMatchObject({
      showConcrete: false,
      showRebar: true,
      showAnnotations: true,
      showSectionCut: false,
      sectionCutX: 0.5,
      sectionCutZ: 0.5,
    });
    expect(persisted).toEqual(before);
  });

  it.each([
    null,
    'corrupted',
    [],
    { params: 'invalid', view: 42 },
    {
      params: { ln: Number.NaN, lowBeam: { length: -1 } },
      view: { showSectionCut: 'yes', sectionCutX: Number.POSITIVE_INFINITY },
    },
  ])('returns usable defaults for malformed payload %#', (persisted) => {
    const migrated = migrateStairPersistedState(persisted, 1);
    const defaults = defaultStair();

    expect(migrated.params).toEqual(defaults);
    expect(migrated.view).toEqual({
      showConcrete: true,
      showRebar: true,
      showAnnotations: true,
      showSectionCut: false,
      sectionCutX: 0.5,
      sectionCutZ: 0.5,
    });
    expect(migrated.params.lowBeam.length).toBeGreaterThanOrEqual(migrated.params.b);
    expect(migrated.params.highBeam.length).toBeGreaterThanOrEqual(migrated.params.b);
  });
});
