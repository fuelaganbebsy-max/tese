/**
 * 成员注册表 — 统一管理各构件类型对应的组件和元数据。
 *
 * 添加新构件（QW、LB、AT、DJ）时只需在此注册：
 *   1. 写 scene / paramContent / dataContent 组件
 *   2. 在下方 registry 对象里添加一条记录
 * 所有 UI 外壳（App、ParamPanel、DataPanel、ViewportHud）自动适配。
 */
import type { ComponentType } from 'react';
import { BeamScene } from './scene/BeamScene';
import { ColumnScene } from './scene/ColumnScene';
import {
  BeamParamContent,
  ColumnParamContent,
} from './ui/ParamPanel';
import {
  BeamDataContent,
  ColumnDataContent,
} from './ui/DataPanel';

export interface MemberEntry {
  /** 侧边栏和标题显示的名称 */
  label: string;
  /** 侧边栏排序序号（从小到大） */
  order: number;
  /** 3D 场景组件 */
  sceneComponent: ComponentType<{}>;
  /** 参数面板内容组件 */
  paramContentComponent: ComponentType;
  /** 数据面板内容组件 */
  dataContentComponent: ComponentType;
}

const registry: Record<string, MemberEntry> = {
  KL: {
    label: '框架梁',
    order: 0,
    sceneComponent: BeamScene,
    paramContentComponent: BeamParamContent,
    dataContentComponent: BeamDataContent,
  },
  L: {
    label: '次梁',
    order: 0,
    sceneComponent: BeamScene,
    paramContentComponent: BeamParamContent,
    dataContentComponent: BeamDataContent,
  },
  WKL: {
    label: '屋面框架梁',
    order: 0,
    sceneComponent: BeamScene,
    paramContentComponent: BeamParamContent,
    dataContentComponent: BeamDataContent,
  },
  XL: {
    label: '悬挑梁',
    order: 0,
    sceneComponent: BeamScene,
    paramContentComponent: BeamParamContent,
    dataContentComponent: BeamDataContent,
  },
  KZ: {
    label: '柱',
    order: 1,
    sceneComponent: ColumnScene,
    paramContentComponent: ColumnParamContent,
    dataContentComponent: ColumnDataContent,
  },
};

/** 获取某构件的注册条目 */
export function getMemberEntry(type: string): MemberEntry | undefined {
  return registry[type];
}

/** 已注册的所有构件类型列表 */
export const MEMBER_TYPES: string[] = Object.keys(registry);

/** 按 order 排序的完整条目列表（含 type） */
export const MEMBER_ENTRIES: { type: string; label: string; sceneComponent: ComponentType<{}> }[] =
  Object.entries(registry)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([type, entry]) => ({ type, label: entry.label, sceneComponent: entry.sceneComponent }));
