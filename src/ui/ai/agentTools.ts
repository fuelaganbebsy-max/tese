import { derive as deriveBeam } from '../../domain/kl/derive';
import type { BeamParams, RebarBundle, StirrupSpec } from '../../domain/kl/types';
import { deriveColumn } from '../../domain/kz/derive';
import type { ColumnParams } from '../../domain/kz/types';
import type { MemberType } from '../../config';

export type AgentContext =
  | {
      memberType: Extract<MemberType, 'KL' | 'L' | 'WKL' | 'XL'>;
      memberLabel: string;
      atlas: '22G101-1';
      params: BeamParams;
      derived: ReturnType<typeof deriveBeam>;
      toolResults: AgentToolResult[];
    }
  | {
      memberType: Extract<MemberType, 'KZ'>;
      memberLabel: string;
      atlas: '22G101-1';
      params: ColumnParams;
      derived: ReturnType<typeof deriveColumn>;
      toolResults: AgentToolResult[];
    }
  | {
      memberType: MemberType;
      memberLabel: string;
      atlas: '22G101-1' | '22G101-2' | '22G101-3' | 'unknown';
      params: null;
      derived: null;
      toolResults: AgentToolResult[];
    };

export interface AgentToolResult {
  tool: string;
  title: string;
  data: Record<string, unknown>;
  note?: string;
}

const BEAM_TYPES = new Set<MemberType>(['KL', 'L', 'WKL', 'XL']);

export function formatBundle(bundle?: RebarBundle): string {
  if (!bundle) return '未配置';
  return `${bundle.count}${bundle.grade.replace('HRB', 'C').replace('HPB', 'A')}${bundle.diameter}`;
}

function formatStirrup(stirrup: StirrupSpec): string {
  const grade = stirrup.grade.replace('HRB', 'C').replace('HPB', 'A');
  return `${grade}${stirrup.diameter}@${stirrup.spacingDense}/${stirrup.spacingSparse}(${stirrup.legs})`;
}

function enabledHaunches(params: BeamParams): string[] {
  const haunches: Array<[string, BeamParams['verticalHaunchLeft']]> = [
    ['左端竖向加腋', params.verticalHaunchLeft],
    ['右端竖向加腋', params.verticalHaunchRight],
    ['左端水平加腋', params.horizontalHaunchLeft],
    ['右端水平加腋', params.horizontalHaunchRight],
    ['前侧水平加腋', params.horizontalHaunchFront],
    ['后侧水平加腋', params.horizontalHaunchBack],
  ];

  return haunches
    .filter(([, spec]) => spec.enabled)
    .map(([label, spec]) => `${label}: ${spec.depth}x${spec.length}mm`);
}

function createBeamToolResults(params: BeamParams, derived: ReturnType<typeof deriveBeam>): AgentToolResult[] {
  const firstSpan = params.spans[0];
  const stirrupCounts = derived.spans.map((span, index) => ({
    span: index + 1,
    count: span.stirrupXs.length,
    denseZones: span.denseZones.map((z) => `${Math.round(z.start)}-${Math.round(z.end)}mm`),
  }));

  return [
    {
      tool: 'summarize_current_member',
      title: '当前梁参数摘要',
      data: {
        section: `${params.b}x${params.h}mm`,
        cover: `${params.cover}mm`,
        concrete: params.concrete,
        seismicLevel: params.seismic,
        spanCount: params.spans.length,
        totalLength: `${Math.round(derived.totalLength)}mm`,
        topThrough: formatBundle(params.topThrough),
        firstSpan: firstSpan
          ? {
              ln: `${firstSpan.ln}mm`,
              supports: `${firstSpan.hcLeft}/${firstSpan.hcRight}mm`,
              bottom: formatBundle(firstSpan.bottom),
              stirrup: formatStirrup(firstSpan.stirrup),
            }
          : null,
        haunches: enabledHaunches(params),
      },
    },
    {
      tool: 'calculate_anchor_lengths',
      title: '锚固长度计算结果',
      data: {
        topThrough: {
          laE: `${Math.round(derived.topAnchor.laE)}mm`,
          horizontal: `${Math.round(derived.topAnchor.horizontal)}mm`,
          verticalHook: `${Math.round(derived.topAnchor.vertical)}mm`,
        },
        bottomPerSpan: derived.bottomAnchorPerSpan.map((anchor, index) => ({
          span: index + 1,
          laE: `${Math.round(anchor.laE)}mm`,
          horizontal: `${Math.round(anchor.horizontal)}mm`,
          verticalHook: `${Math.round(anchor.vertical)}mm`,
        })),
      },
      note: '本工具使用项目内 22G101 简化规则，回答中应说明需以正式图集和项目条件复核。',
    },
    {
      tool: 'calculate_stirrup_dense_zones',
      title: '箍筋加密区计算结果',
      data: {
        denseZoneLength: `${Math.round(derived.densifiedZoneLen)}mm`,
        stirrupCounts,
      },
    },
    {
      tool: 'calculate_support_bar_extensions',
      title: '支座负筋延伸结果',
      data: {
        perSpan: derived.topSupportExtend.map((ext, index) => ({
          span: index + 1,
          left: `${Math.round(ext.left)}mm`,
          right: `${Math.round(ext.right)}mm`,
        })),
      },
    },
  ];
}

function createColumnToolResults(params: ColumnParams, derived: ReturnType<typeof deriveColumn>): AgentToolResult[] {
  return [
    {
      tool: 'summarize_current_member',
      title: '当前柱参数摘要',
      data: {
        section:
          params.sectionType === 'circle'
            ? `D${params.D}mm`
            : `${params.b}x${params.h}mm`,
        clearHeight: `${params.Hn}mm`,
        beamHeight: `${params.beamHeight}mm`,
        floorHeight: `${params.floorHeight}mm`,
        cover: `${params.cover}mm`,
        concrete: params.concrete,
        seismicLevel: params.seismic,
        longitudinal: formatBundle(params.longitudinal),
        stirrup: `${params.stirrup.grade}${params.stirrup.diameter}@${params.stirrup.spacingDense}/${params.stirrup.spacingSparse}`,
      },
    },
    {
      tool: 'calculate_column_dense_zones',
      title: '柱箍筋加密区计算结果',
      data: {
        bottom: `${Math.round(derived.denseZoneBottom)}mm`,
        top: `${Math.round(derived.denseZoneTop)}mm`,
        sparseZone: `${Math.round(derived.sparseZone)}mm`,
        totalBars: derived.totalBars,
        stirrupLegs: `${derived.stirrupLegs.x}x${derived.stirrupLegs.y}`,
        stirrupCount: derived.stirrupYs.length,
      },
      note: '本工具使用项目内 22G101 简化规则，回答中应说明需以正式图集和项目条件复核。',
    },
  ];
}

export function buildAgentContext(input: {
  memberType: MemberType;
  memberLabel: string;
  beamParams: BeamParams;
  columnParams: ColumnParams;
}): AgentContext {
  const { memberType, memberLabel, beamParams, columnParams } = input;

  if (BEAM_TYPES.has(memberType)) {
    const derived = deriveBeam(beamParams);
    return {
      memberType: memberType as Extract<MemberType, 'KL' | 'L' | 'WKL' | 'XL'>,
      memberLabel,
      atlas: '22G101-1',
      params: beamParams,
      derived,
      toolResults: createBeamToolResults(beamParams, derived),
    };
  }

  if (memberType === 'KZ') {
    const derived = deriveColumn(columnParams);
    return {
      memberType,
      memberLabel,
      atlas: '22G101-1',
      params: columnParams,
      derived,
      toolResults: createColumnToolResults(columnParams, derived),
    };
  }

  return {
    memberType,
    memberLabel,
    atlas: memberType === 'AT' ? '22G101-2' : memberType === 'DJ' ? '22G101-3' : '22G101-1',
    params: null,
    derived: null,
    toolResults: [],
  };
}

export function serializeAgentContext(context: AgentContext): string {
  return JSON.stringify(
    {
      memberType: context.memberType,
      memberLabel: context.memberLabel,
      atlas: context.atlas,
      toolResults: context.toolResults,
    },
    null,
    2,
  );
}
