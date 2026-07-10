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
import { BeamParamContent } from './ui/param/BeamParamContent';
import { ColumnParamContent } from './ui/param/ColumnParamContent';
import { BeamDataContent } from './ui/data/BeamDataContent';
import { ColumnDataContent } from './ui/data/ColumnDataContent';
import { StairScene } from './scene/StairScene';
import { StairParamContent } from './ui/param/StairParamContent';
import { StairDataContent } from './ui/data/StairDataContent';

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
  AT: {
    label: 'AT 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  BT: {
    label: 'BT 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  CT: {
    label: 'CT 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  DT: {
    label: 'DT 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  ET: {
    label: 'ET 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  FT: {
    label: 'FT 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  GT: {
    label: 'GT 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  ATa: {
    label: 'ATa 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  ATb: {
    label: 'ATb 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  ATc: {
    label: 'ATc 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  BTb: {
    label: 'BTb 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  CTa: {
    label: 'CTa 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  CTb: {
    label: 'CTb 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
  },
  DTb: {
    label: 'DTb 型楼梯',
    order: 5,
    sceneComponent: StairScene,
    paramContentComponent: StairParamContent,
    dataContentComponent: StairDataContent,
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
