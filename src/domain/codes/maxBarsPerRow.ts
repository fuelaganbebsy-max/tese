/** 梁纵向钢筋单排最大根数 (22G101 配套图集表)
 *  分子=梁上部纵筋单排最大根数, 分母=梁下部钢筋单排最大根数
 *  按净保护层 25mm / 30mm 分两张表; 取最近的(向下取保守值)
 */

const DIAMETERS = [14, 16, 18, 20, 22, 25, 28, 32, 36, 40] as const;
const WIDTHS = [150, 200, 250, 300, 350, 400, 450, 500, 550, 600] as const;

// 上部钢筋单排最大根数 (分子)
// 行: 梁宽 150..600  列: 直径 14..40
const TOP_TABLE_25: Record<number, number[]> = {
  150: [2, 2, 2, 2, 2, 2, 1, 1, 1, 1],
  200: [4, 3, 3, 3, 3, 3, 2, 2, 2, 1],
  250: [5, 5, 4, 4, 4, 3, 3, 2, 2, 2],
  300: [6, 6, 5, 5, 5, 4, 4, 3, 3, 2],
  350: [7, 7, 6, 6, 6, 5, 4, 4, 3, 3],
  400: [8, 8, 7, 7, 6, 6, 5, 4, 4, 3],
  450: [9, 9, 8, 8, 7, 7, 6, 5, 4, 4],
  500: [10, 10, 10, 9, 8, 7, 6, 6, 5, 4],
  550: [12, 11, 11, 11, 9, 8, 7, 6, 5, 5],
  600: [13, 12, 12, 11, 10, 9, 8, 7, 6, 5],
};

const TOP_TABLE_30: Record<number, number[]> = {
  150: [2, 2, 2, 2, 2, 1, 1, 1, 1, 1],
  200: [3, 3, 3, 3, 3, 2, 2, 2, 2, 1],
  250: [5, 4, 4, 4, 4, 3, 3, 2, 2, 2],
  300: [6, 5, 5, 5, 4, 4, 4, 3, 3, 2],
  350: [7, 6, 6, 6, 5, 5, 4, 4, 3, 3],
  400: [8, 8, 7, 7, 6, 6, 5, 4, 4, 3],
  450: [9, 9, 8, 8, 7, 6, 6, 5, 4, 4],
  500: [10, 10, 9, 9, 8, 7, 6, 6, 5, 4],
  550: [11, 11, 10, 10, 9, 8, 7, 6, 5, 5],
  600: [12, 12, 11, 11, 10, 9, 8, 7, 6, 5],
};

function nearest<T extends readonly number[]>(arr: T, v: number): { idx: number; value: number } {
  // 向下取近: 选择 ≤ v 的最大值; 若 v 小于最小值, 取最小值
  let bestIdx = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] <= v) bestIdx = i;
  }
  return { idx: bestIdx, value: arr[bestIdx] };
}

/** 查表得到梁上部纵筋单排最大根数
 *  @param width 梁宽 mm
 *  @param dia   主筋直径 mm
 *  @param cover 净保护层 mm (其它值取最接近的 25 或 30)
 */
export function maxTopBarsPerRow(width: number, dia: number, cover: number): number {
  const table = cover >= 28 ? TOP_TABLE_30 : TOP_TABLE_25;
  const w = nearest(WIDTHS, width).value;
  const d = nearest(DIAMETERS, dia);
  return table[w][d.idx];
}

/** 梁纵向钢筋单排最大根数（按梁宽、保护层、箍筋直径、纵筋直径、箍筋肢数公式估算） */
export function maxBarsPerRow(b: number, cover: number, stirrupDia: number, barDia: number, legs: number): number {
  // 可用净宽 = 梁宽 - 两侧(保护层+箍筋直径) - 内部箍筋竖肢占位
  const innerLegs = Math.max(0, legs / 2 - 1);
  const available = b - 2 * (cover + stirrupDia) - innerLegs * stirrupDia;
  // 最小净距: max(25, barDia)
  const minSpacing = Math.max(25, barDia);
  // n根筋需要: n*barDia + (n-1)*minSpacing ≤ available
  const n = Math.floor((available + minSpacing) / (barDia + minSpacing));
  return Math.max(1, n);
}
