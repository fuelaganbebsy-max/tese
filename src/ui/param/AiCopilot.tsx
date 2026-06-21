import { useState, useRef, useEffect } from 'react';
import { useBeamStore } from '../../store/beamStore';
import { useAiStore } from '../ai/aiStore';
import { getProvider } from '../ai/providers';
import { getOfflineAnswer, getOptimizationAdvice, parseCopilotCommand } from '../ai/beamCommand';

type LocalMsg = { role: 'user' | 'assistant'; content: string; error?: string };
type AssistantMode = 'model' | 'knowledge' | 'optimize';

export function AiCopilot() {
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('model');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<LocalMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const params = useBeamStore((s) => s.params);
  const setParams = useBeamStore((s) => s.setParams);
  const apiKeys = useAiStore((s) => s.apiKeys);
  const activeProviderId = useAiStore((s) => s.activeProviderId);
  const activeModel = useAiStore((s) => s.activeModel);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const handleModeChange = (mode: AssistantMode) => {
    setAssistantMode(mode);
    if (mode === 'optimize') {
      setMsgs([{ role: 'assistant', content: getOptimizationAdvice(params) }]);
      return;
    }
    setMsgs([]);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    const lastUserQuestion = [...msgs].reverse().find((m) => m.role === 'user')?.content;
    const answerText =
      /直接回答|回答我的问题|回答我的問題|不是这个|不是這個|没回答|沒有回答/.test(text) && lastUserQuestion
        ? lastUserQuestion
        : text;

    const localCommand = assistantMode === 'model' ? parseCopilotCommand(answerText, params) : null;
    if (localCommand) {
      setParams(() => localCommand.nextParams);
      setMsgs((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: localCommand.reply }]);
      return;
    }

    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: text });
    setMsgs((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    const systemPrompt = assistantMode === 'optimize'
      ? `你是资深建筑结构工程师，任务是对当前3D框架梁 KL 模型做规范与图集初审。当前参数如下：\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\`\n\n回答要求：\n1. 必须基于现行 22G101 图集构造规则和 GB 50010 常用控制项指出模型中可能不合理的地方。\n2. 每条建议都要包含：问题、判断依据或计算值、修改意见。\n3. 重点检查：纵筋单排净距与排布容量、支座负筋伸出长度、锚固 laE、箍筋加密区长度、箍筋加密/非加密间距、箍筋肢数、保护层、材料等级与抗震等级匹配。\n4. 可以给出可直接执行的自然语言修改命令，例如“箍筋加密间距改为100”“梁宽改为350”。\n5. 不要只泛泛提醒复核；如果参数足够，必须给出当前模型的具体数值判断。`
      : assistantMode === 'knowledge'
      ? '你是资深建筑结构工程师，精通22G101平法图集、GB50010和常见施工构造。请做专业知识拓展，解释概念、构造依据、适用场景和注意事项，不要修改模型参数。'
      : '你是模型交互助手。优先把用户自然语言转换为当前钢筋模型参数修改；无法修改时，再简要说明可执行的命令格式。';

    const provider = getProvider(activeProviderId);
    if (!provider || !apiKeys[activeProviderId]) {
      setMsgs((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: assistantMode === 'optimize'
            ? getOptimizationAdvice(params)
            : getOfflineAnswer(answerText, params, false),
        };
        return next;
      });
      setIsStreaming(false);
      return;
    }

    try {
      let full = '';
      await provider.chatStream(
        history,
        systemPrompt,
        apiKeys[activeProviderId],
        (chunk) => {
          full += chunk;
          setMsgs((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: full };
            return next;
          });
        },
        { model: activeModel }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '请求失败';
      setMsgs((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], error: errMsg };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between sticky top-0 bg-surface-container-high/90 backdrop-blur-md z-10">
        <div className="flex w-full items-center gap-1 rounded-full border border-white/10 bg-surface-container-lowest/70 p-0.5">
          {([
            ['model', '模型交互'],
            ['knowledge', '专业知识拓展'],
            ['optimize', '优化建议'],
          ] as const).map(([mode, label]) => {
            const active = assistantMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                className={`flex-1 rounded-full px-2.5 py-1 text-[11px] transition-all ${
                  active
                    ? 'bg-primary-fixed-dim text-on-primary shadow-[0_0_12px_rgba(0,218,243,0.25)]'
                    : 'text-on-surface-variant/60 hover:text-on-surface hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3">
        {msgs.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-[18px] text-on-surface-variant/40 text-center leading-relaxed px-4">
              {assistantMode === 'model' && '输入自然语言修改模型参数'}
              {assistantMode === 'knowledge' && '提问平法、规范和构造知识'}
              {assistantMode === 'optimize' && '切换到优化建议后会生成当前模型诊断'}
            </p>
          </div>
        )}
        {msgs.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0 border border-primary-container/30 mt-0.5">
                <span className="material-symbols-outlined text-primary-container" style={{ fontSize: '20px' }}>auto_awesome</span>
              </div>
            )}
            <div className={`max-w-[92%] rounded-lg px-3 py-2.5 text-[24px] leading-relaxed whitespace-pre-wrap break-words ${
              msg.role === 'user'
                ? 'bg-blue-600/80 text-white rounded-tr-sm'
                : 'bg-surface-container-highest/50 border border-white/5 text-on-surface-variant rounded-tl-sm'
            }`}>
              {msg.error
                ? <span className="text-red-400">{msg.error}</span>
                : !msg.content && isStreaming && i === msgs.length - 1
                ? <span className="text-on-surface-variant/40">思考中…</span>
                : msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/5 bg-surface-container-highest/20 shrink-0">
        <div className="px-3 pt-2 flex items-center gap-1.5 text-[20px] text-on-surface-variant/60">
          <span className="material-symbols-outlined text-[22px] text-primary-fixed-dim">bolt</span>
          <span>
            {assistantMode === 'model' && '模型交互模式'}
            {assistantMode === 'knowledge' && '专业知识拓展模式'}
            {assistantMode === 'optimize' && '优化建议模式'}
            {!apiKeys[activeProviderId] && '，离线可用'}
          </span>
        </div>
        <div className="p-3 relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={isStreaming}
            className="w-full bg-surface-container-lowest border border-white/10 rounded-full py-3 pl-4 pr-12 text-[24px] text-on-surface focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors placeholder:text-on-surface-variant/40 disabled:opacity-50"
            placeholder={
              assistantMode === 'model'
                ? '例如：梁高改为650...'
                : assistantMode === 'knowledge'
                ? '例如：箍筋加密区怎么取...'
                : '针对当前构件提问...'
            }
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="absolute right-5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container hover:bg-primary-container/20 transition-colors disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[24px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
