import { useRef, useEffect, useState } from 'react';
import { useAiStore } from './aiStore';
import { ChatBubble } from './ChatBubble';
import { InputBox } from './InputBox';
import { ModelPicker } from './ModelPicker';
import { SuggestedQuestions } from './SuggestedQuestions';
import { getProvider } from './providers';
import { useBeamStore } from '../../store/beamStore';
import { useColumnStore } from '../../store/columnStore';
import { useMemberStore } from '../../store/memberStore';
import { MEMBER_LABELS } from '../../config';
import { buildAgentContext } from './agentTools';
import { buildSystemPrompt } from './agentPrompt';
import { ensureAssistantText, selectHistoryForModel, validateUserMessage } from './guardrails';

function getErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Authentication'))
    return 'API Key 无效，请检查后重新配置';
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('Too Many'))
    return '请求过于频繁，请稍后重试';
  if (msg.includes('timeout') || err instanceof DOMException && err.name === 'TimeoutError')
    return '请求超时，请重试';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network'))
    return '网络连接失败，请检查网络后重试';
  if (msg.includes('AbortError') || err instanceof DOMException && err.name === 'AbortError')
    return '';
  return `请求失败：${msg}`;
}

export default function AssistantPanel() {
  const panelOpen = useAiStore((s) => s.panelOpen);
  const messages = useAiStore((s) => s.messages);
  const isStreaming = useAiStore((s) => s.isStreaming);
  const activeProviderId = useAiStore((s) => s.activeProviderId);
  const apiKeys = useAiStore((s) => s.apiKeys);
  const clearMessages = useAiStore((s) => s.clearMessages);
  const lastGuardrailError = useAiStore((s) => s.lastGuardrailError);
  const beamParams = useBeamStore((s) => s.params);
  const columnParams = useColumnStore((s) => s.params);
  const activeType = useMemberStore((s) => s.activeType);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const store = useAiStore.getState();
    const provider = getProvider(store.activeProviderId);
    const guardrail = validateUserMessage(text, store.apiKeys[store.activeProviderId]);
    if (!guardrail.ok || !guardrail.text) {
      store.setGuardrailError(guardrail.error ?? '消息未通过发送检查。');
      return;
    }

    const history = selectHistoryForModel(store.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })));
    history.push({ role: 'user', content: guardrail.text });

    store.addMessage({ role: 'user', content: guardrail.text, warning: guardrail.warning });
    store.addMessage({ role: 'assistant', content: '' });
    store.setStreaming(true);

    const ctrl = new AbortController();
    store.setAbortController(ctrl);

    if (!provider) {
      store.setLastMessageError('未找到对应的模型 Provider');
      store.setStreaming(false);
      store.setAbortController(null);
      return;
    }

    try {
      const context = buildAgentContext({
        memberType: activeType,
        memberLabel: MEMBER_LABELS[activeType],
        beamParams,
        columnParams,
      });
      const systemPrompt = buildSystemPrompt(context);
      let fullText = '';
      await provider.chatStream(
        history,
        systemPrompt,
        store.apiKeys[store.activeProviderId],
        (chunk) => {
          fullText += chunk;
          useAiStore.getState().appendToLastMessage(chunk);
        },
        { model: store.activeModel, signal: ctrl.signal }
      );
      if (!fullText.trim()) {
        useAiStore.getState().setLastMessageError(ensureAssistantText(fullText));
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      if (errorMsg) {
        useAiStore.getState().setLastMessageError(errorMsg);
      }
    } finally {
      useAiStore.getState().setStreaming(false);
      useAiStore.getState().setAbortController(null);
    }
  };

  const handleAbort = () => {
    useAiStore.getState().abort();
  };

  const handleClear = () => {
    clearMessages();
    setShowClearConfirm(false);
  };

  return (
    <div
      className="shrink-0 h-full border-l border-white/5 bg-[#0d0d0d] flex flex-col overflow-hidden transition-[width] duration-300"
      style={{ width: panelOpen ? 320 : 0 }}
    >
      <div className="w-80 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary-fixed-dim"
              style={{ fontSize: '17px', fontVariationSettings: "'FILL' 1" }}
            >
              smart_toy
            </span>
            <span className="text-[13px] font-medium text-on-surface">结构助手</span>
          </div>
          <div className="flex items-center gap-1">
            <ModelPicker />
            {messages.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                title="清空对话"
                className="p-1 rounded text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-white/5 transition-colors ml-0.5"
              >
                <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 ? (
            <>
              <SuggestedQuestions onSelect={sendMessage} />
              {lastGuardrailError && (
                <p className="text-[12px] text-red-300/80 border border-red-600/20 bg-red-950/20 rounded-lg px-3 py-2">
                  {lastGuardrailError}
                </p>
              )}
            </>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming && idx === messages.length - 1}
                />
              ))}
              {lastGuardrailError && (
                <p className="text-[12px] text-red-300/80 border border-red-600/20 bg-red-950/20 rounded-lg px-3 py-2">
                  {lastGuardrailError}
                </p>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <InputBox
          onSend={sendMessage}
          onAbort={handleAbort}
          isStreaming={isStreaming}
        />
      </div>

      {/* Clear Confirm Dialog */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
          onClick={(e) => e.target === e.currentTarget && setShowClearConfirm(false)}
        >
          <div className="bg-surface-container border border-white/10 rounded-xl p-5 w-72 shadow-2xl animate-slide-up">
            <p className="text-sm text-on-surface mb-1 font-medium">清空对话？</p>
            <p className="text-[12px] text-on-surface-variant mb-4">当前所有消息将被清除，无法撤销。</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-[12px] text-on-surface-variant hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-2 rounded-lg bg-red-600/80 text-white text-[12px] font-semibold hover:bg-red-600 transition-colors active:scale-95"
              >
                清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
