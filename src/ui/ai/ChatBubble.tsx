import { useState } from 'react';
import { MarkdownText } from './MarkdownText';
import type { ChatMessage } from './aiStore';

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatBubble({ message, isStreaming }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isEmpty = !message.content && !message.error;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-blue-600/80 text-white rounded-xl rounded-tr-sm px-3 py-2 text-[13px] leading-relaxed shadow-md">
          {message.content}
          {message.warning && (
            <div className="mt-1.5 text-[11px] text-blue-50/80 border-t border-white/15 pt-1">
              {message.warning}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-primary-fixed-dim/10 border border-primary-fixed-dim/20 flex items-center justify-center shrink-0 mt-0.5">
          <span
            className="material-symbols-outlined text-primary-fixed-dim"
            style={{ fontSize: '13px', fontVariationSettings: "'FILL' 1" }}
          >
            smart_toy
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-surface-container-high/80 border border-white/5 rounded-xl rounded-tl-sm px-3 py-2.5 shadow-sm">
            {message.error ? (
              <div className="flex items-start gap-1.5 text-[12px] text-red-400">
                <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">error</span>
                <span>{message.error}</span>
              </div>
            ) : isEmpty && isStreaming ? (
              <TypingDots />
            ) : isEmpty ? (
              <span className="text-[12px] text-on-surface-variant italic">未获取到回答，请重新提问</span>
            ) : (
              <MarkdownText content={message.content} />
            )}
            {isStreaming && !isEmpty && (
              <span className="inline-block w-1 h-3.5 bg-primary-fixed-dim/70 animate-pulse ml-0.5 align-middle rounded-sm" />
            )}
          </div>
          {!isStreaming && message.content && !message.error && (
            <button
              onClick={handleCopy}
              title="复制回复"
              className="mt-1 flex items-center gap-1 text-[11px] text-on-surface-variant/50 hover:text-on-surface-variant transition-colors px-1 py-0.5 rounded"
            >
              <span className="material-symbols-outlined text-[12px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              {copied ? '已复制' : '复制'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="text-[11px] text-on-surface-variant mr-1">平法专家正在思考</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '900ms' }}
        />
      ))}
    </div>
  );
}
