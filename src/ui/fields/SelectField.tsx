export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  fmt,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  fmt?: (v: T) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-body-sm text-[11px] text-on-surface-variant">{label}</label>
      <select
        className="bg-surface-container-lowest border border-white/10 rounded px-2 py-1.5 font-label-numeric text-label-numeric text-on-surface focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none appearance-none font-mono"
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const next = (typeof value === 'number' ? Number(raw) : raw) as T;
          onChange(next);
        }}
      >
        {options.map((o) => (
          <option key={String(o)} value={String(o)}>
            {fmt ? fmt(o) : String(o)}
          </option>
        ))}
      </select>
    </div>
  );
}
