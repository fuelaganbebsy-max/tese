export function NumField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const isInvalid = value < min || (max !== undefined && value > max);
  return (
    <div className="flex flex-col gap-1">
      <label className="font-body-sm text-[11px] text-on-surface-variant">{label}</label>
      <div className="relative">
        <input
          type="number"
          className={`w-full bg-surface-container-lowest border rounded px-3 py-1.5 font-label-numeric text-label-numeric text-on-surface focus:ring-1 outline-none text-right pr-10 font-mono transition-colors ${
            isInvalid
              ? 'border-error/60 focus:border-error focus:ring-error/40 text-error'
              : 'border-white/10 focus:border-primary-fixed-dim focus:ring-primary-fixed-dim'
          }`}
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(v);
          }}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-label-numeric text-[11px] text-on-surface-variant pointer-events-none font-mono">
            {unit}
          </span>
        )}
      </div>
      {isInvalid && (
        <span className="text-[10px] text-error/80">
          {value < min ? `最小值 ${min}` : `最大值 ${max}`}
        </span>
      )}
    </div>
  );
}
