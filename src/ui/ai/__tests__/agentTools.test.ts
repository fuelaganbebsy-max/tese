import { describe, expect, it } from 'vitest';
import { defaultStair } from '../../../domain/at/derive';
import { defaultBeam } from '../../../domain/kl/derive';
import { defaultColumn } from '../../../domain/kz/derive';
import { buildAgentContext, serializeAgentContext } from '../agentTools';

describe('buildAgentContext', () => {
  it('summarizes beam params and derived tool results', () => {
    const context = buildAgentContext({
      memberType: 'KL',
      memberLabel: '框架梁',
      beamParams: defaultBeam(),
      columnParams: defaultColumn(),
      stairParams: defaultStair(),
    });

    expect(context.memberType).toBe('KL');
    expect(context.atlas).toBe('22G101-1');
    expect(context.toolResults.map((tool) => tool.tool)).toContain('calculate_anchor_lengths');
    expect(serializeAgentContext(context)).toContain('当前梁参数摘要');
  });

  it('summarizes column dense zones', () => {
    const context = buildAgentContext({
      memberType: 'KZ',
      memberLabel: '柱',
      beamParams: defaultBeam(),
      columnParams: defaultColumn(),
      stairParams: defaultStair(),
    });

    expect(context.memberType).toBe('KZ');
    expect(context.atlas).toBe('22G101-1');
    expect(context.toolResults.map((tool) => tool.tool)).toContain('calculate_column_dense_zones');
  });

  it('summarizes local AT page 1-8 geometry and page 2-8 anchorage checks', () => {
    const defaults = defaultStair();
    const stairParams = {
      ...defaults,
      ln: 3210,
      Hs: 1680,
      lowBeam: { ...defaults.lowBeam, width: 310 },
      highBeam: { ...defaults.highBeam, width: 430 },
      topAnchorMode: 'full' as const,
    };
    const context = buildAgentContext({
      memberType: 'AT',
      memberLabel: 'AT 型楼梯',
      beamParams: defaultBeam(),
      columnParams: defaultColumn(),
      stairParams,
    });

    expect(context.memberType).toBe('AT');
    expect(context.atlas).toBe('22G101-2');
    expect(context.params).toBe(stairParams);
    expect(context.toolResults.map((tool) => tool.tool)).toEqual([
      'summarize_current_stair_geometry',
      'calculate_stair_anchor_checks',
    ]);

    const serialized = serializeAgentContext(context);
    expect(serialized).toContain('1-8');
    expect(serialized).toContain('2-8');
    expect(serialized).toContain('3210mm');
    expect(serialized).toContain('lab');
    expect(serialized).toContain('required');
    expect(serialized).toContain('provided');
    expect(serialized).toContain('直锚到梁中线');
    expect(serialized).toContain('官方事实边界');
    expect(serialized).toContain('项目渲染选择');
  });
});
