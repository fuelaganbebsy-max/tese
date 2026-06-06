import { describe, expect, it } from 'vitest';
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
    });

    expect(context.memberType).toBe('KL');
    expect(context.toolResults.map((tool) => tool.tool)).toContain('calculate_anchor_lengths');
    expect(serializeAgentContext(context)).toContain('当前梁参数摘要');
  });

  it('summarizes column dense zones', () => {
    const context = buildAgentContext({
      memberType: 'KZ',
      memberLabel: '柱',
      beamParams: defaultBeam(),
      columnParams: defaultColumn(),
    });

    expect(context.memberType).toBe('KZ');
    expect(context.toolResults.map((tool) => tool.tool)).toContain('calculate_column_dense_zones');
  });
});
