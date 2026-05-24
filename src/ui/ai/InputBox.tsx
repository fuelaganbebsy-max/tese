import { useRef, useEffect, useState } from 'react';

interface Props {
  onSend: (text: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
}

export function InputBox({ onSend, onAbort, isStreaming }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    let text = trimmed;
    if (text.length > 4000) {
      text = text.slice(0, 4000);
    }
    onSend(text);
    setValue('');
  };

  const canSend = !!value.trim() && !isStreaming;
  const tooltip = isStreaming ? '正在生成回复…' : '';

  return (
    <div className="border-t border-white/5 px-3 py-2.5 bg-[#0d0d0d]">
      <div className="flex items-end gap-2 bg-surface-container-lowest border border-white/10 rounded-xl px-3 py-2 focus-within:border-primary-fixed-dim/50 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder="问我任何问题… (Enter 发送，Shift+Enter 换行)"
          rows={1}
          className="flex-1 bg-transparent text-[13px] text-on-surface placeholder:text-on-surface-variant/40 resize-none outline-none leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: '22px' }}
        />
        {isStreaming ? (
          <button
            onClick={onAbort}
            title="停止生成"
            className="shrink-0 p-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">stop_circle</span>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            title={tooltip || '发送 (Enter)'}
            className="shrink-0 p-1 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: canSend ? 'rgba(0, 218, 243, 0.15)' : 'transparent',
              color: canSend ? '#00daf3' : '#bac9cc',
            }}
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        )}
      </div>
      <p className="text-[10px] text-on-surface-variant/30 mt-1.5 text-center">
        AI 回复仅供参考，请结合 22G101 图集核实
      </p>
    </div>
  );
}
