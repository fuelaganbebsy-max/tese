export const APP_NAME = 'Alpha-7 Rebar 3D Studio';
export const APP_VERSION = '0.2.0';
export const APP_DESCRIPTION = '结构工程师的 3D 配筋可视化平台';

// 构件类型 — 按 22G101 系列图集排列
// 22G101-1: 梁/柱/墙/板  22G101-2: 楼梯  22G101-3: 基础
export const MEMBER_TYPES = ['KL', 'L', 'WKL', 'XL', 'KZ', 'QW', 'LB', 'AT', 'DJ'] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];

// 父类型（侧边栏一级入口）
export const PARENT_TYPES = ['KL', 'KZ', 'QW', 'LB', 'AT', 'DJ'] as const;
export type ParentType = (typeof PARENT_TYPES)[number];

// 父类型在侧边栏中的中文名称
export const PARENT_LABELS: Record<ParentType, string> = {
  KL: '梁',
  KZ: '柱',
  QW: '墙',
  LB: '板',
  AT: '楼梯',
  DJ: '基础',
};

// 所有类型的中文名称
export const MEMBER_LABELS: Record<MemberType, string> = {
  KL: '框架梁',
  L: '次梁',
  WKL: '屋面框架梁',
  XL: '悬挑梁',
  KZ: '框架柱',
  QW: '剪力墙',
  LB: '楼板',
  AT: '楼梯',
  DJ: '基础',
};

export const MEMBER_ICONS: Record<MemberType, string> = {
  KL: 'horizontal_rule',
  L: 'horizontal_rule',
  WKL: 'horizontal_rule',
  XL: 'horizontal_rule',
  KZ: 'view_column',
  QW: 'rectangle',
  LB: 'layers',
  AT: 'stairs',
  DJ: 'foundation',
};

// 各构件子类型
export const MEMBER_SUBTYPES: Record<ParentType, MemberType[]> = {
  KL: ['KL', 'L', 'WKL', 'XL'],
  KZ: ['KZ'],
  QW: ['QW'],
  LB: ['LB'],
  AT: ['AT'],
  DJ: ['DJ'],
};

// 根据子类型找到父类型
export function getParentType(type: MemberType): ParentType {
  for (const [parent, children] of Object.entries(MEMBER_SUBTYPES)) {
    if ((children as readonly string[]).includes(type)) return parent as ParentType;
  }
  return type as ParentType;
}

// 开发路线 Phase → 构件映射
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
  L: 'dev',
  WKL: 'dev',
  XL: 'dev',
  KZ: 'dev',
  QW: 'planned',
  LB: 'planned',
  AT: 'planned',
  DJ: 'planned',
};
