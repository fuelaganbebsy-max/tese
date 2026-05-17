import type { RebarGrade } from '../../domain/kl/types';

const COMMON_DIA = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
const GRADES: RebarGrade[] = ['HPB300', 'HRB400', 'HRB500'];

export function BundleEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { grade: RebarGrade; diameter: number; count: number };
  onChange: (b: { grade: RebarGrade; diameter: number; count: number }) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="font-body-sm text-[11px] text-on-surface-variant">{label}</label>
        <span className="font-label-numeric text-[10px] text-primary-fixed-dim font-mono">
          {value.count}⌀{value.diameter} {value.grade}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <select
          className="bg-surface-container-lowest border border-white/10 rounded focus:border-primary-fixed-dim h-7 px-1.5 font-mono text-[10px] text-on-surface appearance-none"
          value={value.grade}
          onChange={(e) => onChange({ ...value, grade: e.target.value as RebarGrade })}
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          className="bg-surface-container-lowest border border-white/10 rounded focus:border-primary-fixed-dim h-7 px-1.5 font-mono text-[10px] text-on-surface appearance-none"
          value={value.diameter}
          onChange={(e) => onChange({ ...value, diameter: Number(e.target.value) })}
        >
          {COMMON_DIA.map((d) => (
            <option key={d} value={d}>⌀{d}</option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={20}
          className="bg-surface-container-lowest border border-white/10 rounded focus:border-primary-fixed-dim h-7 px-2 font-mono text-[10px] text-on-surface text-center"
          value={value.count}
          onChange={(e) => onChange({ ...value, count: Math.max(1, Number(e.target.value)) })}
        />
      </div>
    </div>
  );
}
