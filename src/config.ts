export const APP_NAME = 'Alpha-7 Rebar 3D Studio';
export const APP_VERSION = '0.2.0';
export const APP_DESCRIPTION = '结构工程师的 3D 配筋可视化平台';

// 构件类型 — 按 22G101 系列图集排列
// 22G101-1: 梁/柱/墙/板  22G101-2: 楼梯  22G101-3: 基础
export const MEMBER_TYPES = ['KL', 'KZ', 'QW', 'LB', 'AT', 'DJ'] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];

export const MEMBER_LABELS: Record<MemberType, string> = {
  KL: '梁',
  KZ: '柱',
  QW: '墙',
  LB: '板',
  AT: '楼梯',
  DJ: '基础',
};

export const MEMBER_ICONS: Record<MemberType, string> = {
  KL: 'horizontal_rule',
  KZ: 'view_column',
  QW: 'rectangle',
  LB: 'layers',
  AT: 'stairs',
  DJ: 'foundation',
};

// 各构件子类型
export const MEMBER_SUBTYPES: Record<MemberType, string[]> = {
  KL: ['KL', 'L', 'WKL', 'XL'],
  KZ: ['KZ', 'LZ', 'XZ'],
  QW: ['QW', 'DW', 'GBZ', 'AZ', 'LL'],
  LB: ['LB', 'B', 'WB'],
  AT: ['AT', 'BT', 'CT', 'DT', 'ET', 'FT', 'GT'],
  DJ: ['DJ', 'TJ', 'FBJ', 'ZJ'],
};

// 开发路线 Phase → 构件映射（按SKILL确认的顺序）
export const DEV_PHASES: { phase: number; type: MemberType; atlas: string }[] = [
  { phase: 1, type: 'KZ', atlas: '22G101-1' },
  { phase: 2, type: 'QW', atlas: '22G101-1' },
  { phase: 3, type: 'KL', atlas: '22G101-1' },
  { phase: 4, type: 'LB', atlas: '22G101-1' },
  { phase: 5, type: 'AT', atlas: '22G101-2' },
  { phase: 6, type: 'DJ', atlas: '22G101-3' },
];

// 构件实现状态
export const MEMBER_STATUS: Record<MemberType, 'ready' | 'dev' | 'planned'> = {
  KL: 'ready',
  KZ: 'dev',
  QW: 'planned',
  LB: 'planned',
  AT: 'planned',
  DJ: 'planned',
};
