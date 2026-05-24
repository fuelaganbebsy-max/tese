import { useRef, useEffect, useState } from 'react';
import { useAiStore } from './aiStore';
import { ChatBubble } from './ChatBubble';
import { InputBox } from './InputBox';
import { ModelPicker } from './ModelPicker';
import { SuggestedQuestions } from './SuggestedQuestions';
import { getProvider } from './providers';

const SYSTEM_PROMPT = `你是一名资深建筑结构工程师，拥有以下领域的深厚知识：

**核心专长：**
- 平法图集：22G101-1（梁、柱、墙、板）、22G101-2（楼梯）、22G101-3（基础）及历版 16G101、11G101
- 结构设计规范：GB 50010（混凝土结构设计规范）、GB 50011（抗震设计规范）、GB 50017（钢结构设计标准）、GB 50009（荷载规范）等国家标准
- 施工验收规范：GB 50204（混凝土结构工程施工质量验收规范）等
- 钢筋工程：锚固、搭接、弯钩、加密区、保护层等构造要求
- 结构体系：框架结构、剪力墙结构、框剪结构、筒体结构等
- 基础工程：独基、条基、筏板、桩基础等
- 结构计算：内力分析、配筋计算、承载力验算等

**回答原则：**
1. 准确引用规范条文，标明出处（如「GB 50010-2010 第 8.3.1 条」或「22G101-1 第 2-34 页」）
2. 回答简洁清晰，根据问题复杂度适当展开，避免冗余
3. 涉及计算时，给出公式和推导步骤
4. 遇到模糊描述，先按常规理解作答，再说明可能的特殊情况
5. 对所有建筑结构工程相关问题均予以解答，不设话题限制

当前构件参数：（暂无，用户可在对话中主动提供）`;

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
    const truncated = text.length > 4000 ? text.slice(0, 4000) : text;

    const history = store.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    history.push({ role: 'user', content: truncated });

    store.addMessage({ role: 'user', content: truncated });
    store.addMessage({ role: 'assistant', content: '' });
    store.setStreaming(true);

    const ctrl = new AbortController();
    store.setAbortController(ctrl);

    const provider = getProvider(store.activeProviderId);
    if (!provider) {
      store.setLastMessageError('未找到对应的模型 Provider');
      store.setStreaming(false);
      store.setAbortController(null);
      return;
    }

    try {
      await provider.chatStream(
        history,
        SYSTEM_PROMPT,
        store.apiKeys[store.activeProviderId],
        (chunk) => useAiStore.getState().appendToLastMessage(chunk),
        { model: store.activeModel, signal: ctrl.signal }
      );
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
            <SuggestedQuestions onSelect={sendMessage} />
          ) : (
            messages.map((msg, idx) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                isStreaming={isStreaming && idx === messages.length - 1}
              />
            ))
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
