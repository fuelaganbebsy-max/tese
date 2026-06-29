import type { BeamParams, ConcreteGrade, RebarGrade, SeismicLevel } from '../../domain/kl/types';
import { densifiedZoneLength, laE } from '../../domain/kl/codes/22G101';
import { maxTopBarsPerRow, maxBarsPerRow } from '../../domain/codes/maxBarsPerRow';

export type CopilotCommandResult = {
  nextParams: BeamParams;
  reply: string;
};

export function summarizeBeam(params: BeamParams): string {
  const firstSpan = params.spans[0];
  return `当前 KL：${params.b}x${params.h}mm，${params.concrete}，抗震 ${params.seismic} 级，保护层 ${params.cover}mm；上部通筋 ${params.topThrough.count}Φ${params.topThrough.diameter} ${params.topThrough.grade}；首跨下部筋 ${firstSpan.bottom.count}Φ${firstSpan.bottom.diameter}，箍筋 Φ${firstSpan.stirrup.diameter}@${firstSpan.stirrup.spacingDense}/${firstSpan.stirrup.spacingSparse}。`;
}

export function getOptimizationAdvice(params: BeamParams): string {
  const firstSpan = params.spans[0];
  const denseLen = densifiedZoneLength(params.h, params.seismic);
  const topCapacity = maxTopBarsPerRow(params.b, params.topThrough.diameter, params.cover);
  const bottomCapacity = maxBarsPerRow(
    params.b,
    params.cover,
    firstSpan.stirrup.diameter,
    firstSpan.bottom.diameter,
    firstSpan.stirrup.legs
  );
  const topLae = laE(params.topThrough.grade, params.topThrough.diameter, params.concrete, params.seismic);
  const bottomLae = laE(firstSpan.bottom.grade, firstSpan.bottom.diameter, params.concrete, params.seismic);
  const issues: string[] = [];

  if (params.topThrough.count > topCapacity) {
    issues.push(`上部通筋 ${params.topThrough.count}Φ${params.topThrough.diameter} 超过当前梁宽 ${params.b}mm、保护层 ${params.cover}mm 下单排建议容量 ${topCapacity} 根。建议拆成两排，或减小直径、加宽梁截面，并同步复核净距。`);
  } else {
    issues.push(`上部通筋 ${params.topThrough.count}Φ${params.topThrough.diameter} 未超过单排建议容量 ${topCapacity} 根，但仍需结合支座负筋叠加区复核净距。`);
  }

  if (firstSpan.bottom.count > bottomCapacity) {
    issues.push(`首跨下部筋 ${firstSpan.bottom.count}Φ${firstSpan.bottom.diameter} 超过按当前箍筋肢数估算的单排容量 ${bottomCapacity} 根。建议设置第二排底筋，或调整梁宽/钢筋直径。`);
  } else {
    issues.push(`首跨下部筋 ${firstSpan.bottom.count}Φ${firstSpan.bottom.diameter} 单排排布容量初判可行，建议继续检查跨中弯矩所需 As。`);
  }

  if (firstSpan.stirrup.spacingDense > 100 && params.seismic <= 2) {
    issues.push(`当前抗震 ${params.seismic} 级，箍筋加密区间距 ${firstSpan.stirrup.spacingDense}mm 偏宽。建议优先采用 @100 或按设计计算进一步收紧，并按 22G101 梁端加密区构造复核。`);
  }

  if (firstSpan.stirrup.spacingSparse > Math.min(200, params.h / 2)) {
    issues.push(`非加密区箍筋间距 ${firstSpan.stirrup.spacingSparse}mm 可能偏大；按常用构造宜同时受 200mm 和 h/2 控制，当前 h/2=${Math.round(params.h / 2)}mm。建议改为 @200 或更小。`);
  }

  if (firstSpan.stirrup.legs === 2 && params.b >= 350) {
    issues.push(`梁宽 ${params.b}mm 时仍采用 2 肢箍，宽梁横向约束可能不足。建议评估改为 4 肢箍或复合箍。`);
  }

  if (params.cover < 25) {
    issues.push(`保护层 ${params.cover}mm 偏小。建议普通梁不低于常用 25mm，并按环境类别、耐久性和设计说明取值。`);
  }

  const firstRow = Math.round(firstSpan.ln / 3);
  const secondRow = Math.round(firstSpan.ln / 4);
  return `优化建议已开启，我按现行 22G101 构造规则和 GB 50010 常用控制项，对当前模型做离线初审：\n\n当前模型：${summarizeBeam(params)}\n\n主要问题与建议：\n${issues.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n关键构造取值：\n1. 梁端箍筋加密区长度：抗震 ${params.seismic} 级，取 ${denseLen}mm。\n2. 上部通筋抗震锚固长度 laE：${topLae}mm；下部筋 laE：${bottomLae}mm。\n3. 支座负筋伸出：第一排 ln/3=${firstRow}mm，第二排 ln/4=${secondRow}mm。\n\n可直接执行的修改建议示例：\n- “箍筋加密间距改为100”\n- “箍筋改为4肢”\n- “梁宽改为350”\n- “混凝土改为C35”\n\n以上为构造和模型一致性初审，最终仍需结合内力计算书、设计总说明、22G101 节点和 GB 50010 条文复核。`;
}

export function getOfflineAnswer(text: string, params: BeamParams, optimMode: boolean): string {
  const compact = text.replace(/\s+/g, '').toLowerCase();
  const firstSpan = params.spans[0];
  const denseLen = Math.max(500, params.h * 1.5);
  const current = summarizeBeam(params);
  const ln = firstSpan.ln;

  if (/负筋|負筋|支座筋|支座钢筋|支座鋼筋/.test(compact) && /第一排|一排|第二排|二排|伸出|伸入|长度|長度|多少/.test(compact)) {
    const firstRow = Math.round(ln / 3);
    const secondRow = Math.round(ln / 4);
    return `按常用 22G101 梁支座负筋构造，支座负筋从支座边向跨内伸出：第一排取 ln/3，第二排取 ln/4。\n\n当前净跨 ln = ${ln}mm，所以：\n第一排负筋伸出长度 = ${firstRow}mm；\n第二排负筋伸出长度 = ${secondRow}mm。\n\n如果是中间支座，两侧相邻跨不等时，通常分别按相邻跨净跨取值，并以设计说明和图集节点为准。`;
  }

  if (/加密区|加密區|箍筋.*范围|箍筋.*範圍|箍筋.*长度|箍筋.*長度/.test(compact)) {
    return `${current}\n\n框架梁箍筋加密区通常从支座边起算，按抗震构造取值时常用控制项是梁高倍数和 500mm 的较大值。按当前梁高 ${params.h}mm 估算，加密区长度可先按 max(1.5h, 500) = ${denseLen}mm 控制，当前加密间距为 ${firstSpan.stirrup.spacingDense}mm，非加密区间距为 ${firstSpan.stirrup.spacingSparse}mm。\n\n实际出图前还需要结合抗震等级、梁端塑性铰区、设计说明和 22G101/GB 50010 的具体条文复核。`;
  }

  if (/锚固|錨固|lae|la|弯锚|彎錨/.test(compact)) {
    return `${current}\n\n锚固长度需要由钢筋等级、直径、混凝土强度、抗震等级共同确定。当前上部通筋为 ${params.topThrough.grade} Φ${params.topThrough.diameter}，混凝土 ${params.concrete}，抗震 ${params.seismic} 级；软件当前展示的 laE 可作为本模型的计算参考值。\n\n构造判断时重点看三件事：支座宽度是否满足直锚，直锚不足时是否采用弯锚，弯折段和水平段是否满足图集构造。`;
  }

  if (/通长筋|通長筋|通常钢筋|通常鋼筋|贯通筋|貫通筋|架立筋|上部.*架立筋|区别|差别|差異/.test(compact)) {
    return `通长筋/贯通筋是沿梁长连续布置、参与梁端和跨中受力及构造连续性的钢筋；架立筋主要用于固定箍筋、形成钢筋骨架，通常不作为主要受力钢筋控制。\n\n在当前模型里，“上部通筋”会贯穿整根梁并影响 3D 显示和 BOM；支座负筋、下部筋则按各跨或支座区域分别统计。`;
  }

  if (/保护层|保護層|cover/.test(compact)) {
    return `${current}\n\n保护层厚度影响钢筋净距、可排布根数、耐久性和防火性能。当前保护层为 ${params.cover}mm。一般不能只为了排筋方便随意减小保护层，出图时应按环境类别、构件类型和设计说明取值。`;
  }

  if (/工程量|重量|bom|清单|统计|統計/.test(compact)) {
    return `BOM 会按当前模型参数重新统计各类钢筋的规格、长度、数量和重量。你可以用自然语言直接改参数，例如“上部通筋改为2根，直径不变”或“箍筋加密间距改为100”，工程量会随模型同步刷新。`;
  }

  if (/优化|優化|建议|建議|合理|检查|檢查|诊断|診斷|不合理|问题|問題/.test(compact) || optimMode) {
    return getOptimizationAdvice(params);
  }

  return `${current}\n\n我现在处于离线问答状态，不需要配置模型 API Key。可以回答当前构件相关的常见开放问题，也可以直接执行参数修改。\n\n你可以继续问：箍筋加密区怎么取、锚固长度怎么看、通长筋和架立筋区别、当前配筋是否合理；也可以说“梁高改为650”“混凝土改为C35”“下部钢筋改为4根直径22”。`;
}

function cnNumberToDigit(text: string): number | undefined {
  const map: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  return map[text];
}

function firstNumber(text: string): number | undefined {
  const digit = text.match(/\d+(?:\.\d+)?/);
  if (digit) return Number(digit[0]);
  const cn = text.match(/[一二两三四五六七八九十]/);
  return cn ? cnNumberToDigit(cn[0]) : undefined;
}

function extractCount(text: string): number | undefined {
  const match = text.match(/(\d+|[一二两三四五六七八九十])\s*(?:根|支|肢)/);
  if (!match) return undefined;
  return /^\d/.test(match[1]) ? Number(match[1]) : cnNumberToDigit(match[1]);
}

function extractDiameter(text: string): number | undefined {
  if (/直径不变|直徑不變|直径保持|直徑保持/.test(text)) return undefined;
  const match =
    text.match(/(?:直径|直徑|dia|diameter|[dDΦφØø])\s*(?:为|改为|=|:|：)?\s*(\d+)/) ??
    text.match(/(\d+)\s*(?:mm)?\s*(?:钢筋|鋼筋|筋)/);
  return match ? Number(match[1]) : undefined;
}

function extractGrade(text: string): RebarGrade | undefined {
  const match = text.toUpperCase().match(/\b(HPB300|HRB400|HRB500)\b/);
  return match?.[1] as RebarGrade | undefined;
}

function extractConcrete(text: string): ConcreteGrade | undefined {
  const match = text.toUpperCase().match(/\bC(25|30|35|40|45|50)\b/);
  return match ? (`C${match[1]}` as ConcreteGrade) : undefined;
}

function extractSeismic(text: string): SeismicLevel | undefined {
  const match = text.match(/抗震\s*(?:等级|等級)?\s*(?:改为|调整为|设为|为|=|:|：)?\s*([一二三四1234])/);
  if (!match) return undefined;
  const raw = match[1];
  const value = /^\d$/.test(raw) ? Number(raw) : cnNumberToDigit(raw);
  return value && value >= 1 && value <= 4 ? (value as SeismicLevel) : undefined;
}

function extractMmValue(text: string, keywords: string[]): number | undefined {
  for (const keyword of keywords) {
    const idx = text.indexOf(keyword);
    if (idx >= 0) {
      return firstNumber(text.slice(idx));
    }
  }
  return undefined;
}

export function parseCopilotCommand(text: string, params: BeamParams): CopilotCommandResult | null {
  const compact = text.replace(/\s+/g, '');
  const isQuestion = /[?？]|怎么|如何|为何|为什么|為何|為什麼|解释|說明|说明|区别|差别|差異|是什么|是什麼|确定|確定|范围|範圍|多少|几个|幾個/.test(compact);
  if (isQuestion && !/改|修改|调整|調整|设为|設為|设置|設定|变为|變為|改为|改成|设成|換成|换成|采用|取为|取成|应用|套用|增加|减少|增大|减小|=/.test(compact)) {
    return null;
  }

  const hasCommandIntent = /改|修改|调整|調整|设为|設為|设置|設定|变为|變為|改为|改成|设成|換成|换成|采用|取为|取成|应用|套用|增加|减少|增大|减小|=/.test(compact);
  if (!hasCommandIntent) return null;

  const actions: string[] = [];
  let handled = false;
  let next: BeamParams = params;

  const update = (patch: Partial<BeamParams>) => {
    next = { ...next, ...patch };
    handled = true;
  };

  const count = extractCount(compact);
  const diameter = extractDiameter(compact);
  const grade = extractGrade(compact);

  if (
    /上部|顶部|通筋|贯通筋|貫通筋/.test(compact) &&
    !/支座|负筋|負筋|区别|差别|差異|怎么|如何|为什么|為什麼|解释|說明|说明/.test(compact) &&
    (count !== undefined || diameter !== undefined || grade !== undefined)
  ) {
    const current = next.topThrough;
    update({
      topThrough: {
        ...current,
        count: count ?? current.count,
        diameter: diameter ?? current.diameter,
        grade: grade ?? current.grade,
      },
    });
    actions.push(`上部通筋已调整为 ${count ?? current.count} 根 HRB/HPB 等级 ${grade ?? current.grade}，直径 ${diameter ?? current.diameter}mm`);
  }

  if (
    /下部|底部|底筋/.test(compact) &&
    !/区别|差别|差異|怎么|如何|为什么|為什麼|解释|說明|说明/.test(compact) &&
    (count !== undefined || diameter !== undefined || grade !== undefined)
  ) {
    next = {
      ...next,
      spans: next.spans.map((span) => ({
        ...span,
        bottom: {
          ...span.bottom,
          count: count ?? span.bottom.count,
          diameter: diameter ?? span.bottom.diameter,
          grade: grade ?? span.bottom.grade,
        },
      })),
    };
    handled = true;
    actions.push(`下部纵筋已应用到全部跨：${count ?? next.spans[0].bottom.count} 根，直径 ${diameter ?? next.spans[0].bottom.diameter}mm`);
  }

  if (/箍筋|箍/.test(compact) && !/怎么|如何|为什么|為什麼|解释|說明|说明|范围|範圍|确定|確定/.test(compact)) {
    const dense = extractMmValue(compact, ['加密间距', '加密区间距', '加密']);
    const sparse = extractMmValue(compact, ['非加密间距', '非加密区间距', '普通间距', '间距']);
    const legs = /四肢|4肢|4支/.test(compact) ? 4 : /两肢|二肢|2肢|2支/.test(compact) ? 2 : undefined;
    if (diameter === undefined && grade === undefined && dense === undefined && sparse === undefined && legs === undefined) {
      return null;
    }
    next = {
      ...next,
      spans: next.spans.map((span) => ({
        ...span,
        stirrup: {
          ...span.stirrup,
          diameter: diameter ?? span.stirrup.diameter,
          grade: grade ?? span.stirrup.grade,
          spacingDense: dense ?? span.stirrup.spacingDense,
          spacingSparse: sparse ?? span.stirrup.spacingSparse,
          legs: (legs ?? span.stirrup.legs) as 2 | 4,
        },
      })),
    };
    handled = true;
    actions.push('箍筋参数已应用到全部跨');
  }

  const width = extractMmValue(compact, ['梁宽', '宽度', 'b=']);
  if (width !== undefined) {
    update({ b: width });
    actions.push(`梁宽 b 已改为 ${width}mm`);
  }

  const height = extractMmValue(compact, ['梁高', '高度', 'h=']);
  if (height !== undefined) {
    update({ h: height });
    actions.push(`梁高 h 已改为 ${height}mm`);
  }

  const cover = extractMmValue(compact, ['保护层', '保護層']);
  if (cover !== undefined) {
    update({ cover });
    actions.push(`保护层厚度已改为 ${cover}mm`);
  }

  const concrete = extractConcrete(compact);
  if (concrete) {
    update({ concrete });
    actions.push(`混凝土强度等级已改为 ${concrete}`);
  }

  const seismic = extractSeismic(compact);
  if (seismic) {
    update({ seismic });
    actions.push(`抗震等级已改为 ${seismic} 级`);
  }

  if (!handled) return null;

  return {
    nextParams: next,
    reply: `已执行：${actions.join('；')}。模型与工程量已同步刷新。`,
  };
}
