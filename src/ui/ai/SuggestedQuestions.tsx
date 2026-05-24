interface Props {
  onSelect: (question: string) => void;
}

const QUESTIONS = [
  { icon: 'anchor', text: 'C35 混凝土 HRB400 抗震三级，锚固长度多少？' },
  { icon: 'dashboard', text: '框架梁箍筋加密区范围怎么确定？' },
  { icon: 'calculate', text: '梁截面 300×600，As 怎么计算？' },
  { icon: 'compare_arrows', text: '通长筋和架立筋有什么区别？' },
  { icon: 'menu_book', text: 'GB 50011 对框架柱轴压比有什么限制？' },
];

export function SuggestedQuestions({ onSelect }: Props) {
  return (
    <div className="flex flex-col gap-3 py-2 animate-fade-in">
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="w-10 h-10 rounded-xl bg-primary-fixed-dim/10 border border-primary-fixed-dim/20 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-primary-fixed-dim text-[22px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            smart_toy
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] text-on-surface-variant/60 px-1 mb-0.5">推荐问题</p>
        {QUESTIONS.map((q) => (
          <button
            key={q.text}
            onClick={() => onSelect(q.text)}
            className="flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg border border-white/5 bg-surface-container-low/50 hover:bg-surface-container hover:border-primary-fixed-dim/20 transition-all duration-150 group active:scale-[0.98]"
          >
            <span
              className="material-symbols-outlined text-on-surface-variant/60 group-hover:text-primary-fixed-dim transition-colors shrink-0"
              style={{ fontSize: '15px' }}
            >
              {q.icon}
            </span>
            <span className="text-[12px] text-on-surface-variant group-hover:text-on-surface transition-colors leading-snug">
              {q.text}
            </span>
            <span className="material-symbols-outlined text-on-surface-variant/30 group-hover:text-primary-fixed-dim/50 transition-colors shrink-0 ml-auto" style={{ fontSize: '14px' }}>
              chevron_right
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
