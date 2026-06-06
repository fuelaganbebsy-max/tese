import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_PERSISTED_MESSAGES = 50;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  error?: string;
  warning?: string;
}

interface AiState {
  panelOpen: boolean;
  messages: ChatMessage[];
  isStreaming: boolean;
  activeProviderId: string;
  activeModel: string;
  apiKeys: Record<string, string>;
  abortController: AbortController | null;
  lastGuardrailError: string | null;
}

interface AiActions {
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  appendToLastMessage: (delta: string) => void;
  setLastMessageError: (error: string) => void;
  clearMessages: () => void;
  setStreaming: (v: boolean) => void;
  setActiveProvider: (id: string, model?: string) => void;
  setActiveModel: (model: string) => void;
  setApiKey: (providerId: string, key: string) => void;
  setAbortController: (ctrl: AbortController | null) => void;
  setGuardrailError: (error: string | null) => void;
  abort: () => void;
}

export type AiStore = AiState & AiActions;

export const useAiStore = create<AiStore>()(
  persist(
    (set, get) => ({
      panelOpen: false,
      messages: [],
      isStreaming: false,
      activeProviderId: 'deepseek',
      activeModel: 'deepseek-v4-flash',
      apiKeys: {},
      abortController: null,
      lastGuardrailError: null,

      setPanelOpen: (open) => set({ panelOpen: open }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

      addMessage: (msg) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        set((s) => ({
          messages: [...s.messages, { ...msg, id, timestamp: Date.now() }].slice(-MAX_PERSISTED_MESSAGES),
          lastGuardrailError: null,
        }));
      },

      appendToLastMessage: (delta) =>
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: last.content + delta };
          }
          return { messages: msgs };
        }),

      setLastMessageError: (error) =>
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, error };
          }
          return { messages: msgs };
        }),

      clearMessages: () => set({ messages: [] }),

      setStreaming: (v) => set({ isStreaming: v }),

      setActiveProvider: (id, model) =>
        set((s) => ({
          activeProviderId: id,
          activeModel: model ?? s.activeModel,
        })),

      setActiveModel: (model) => set({ activeModel: model }),

      setApiKey: (providerId, key) =>
        set((s) => ({ apiKeys: { ...s.apiKeys, [providerId]: key } })),

      setAbortController: (ctrl) => set({ abortController: ctrl }),

      setGuardrailError: (error) => set({ lastGuardrailError: error }),

      abort: () => {
        get().abortController?.abort();
        set({ abortController: null, isStreaming: false });
      },
    }),
    {
      name: 'ai-assistant-v1',
      version: 2,
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        activeProviderId: state.activeProviderId,
        activeModel: state.activeModel,
        messages: state.messages.slice(-MAX_PERSISTED_MESSAGES),
      }),
      migrate: (persisted: any) => {
        if (!persisted) return persisted;
        const state = persisted.state ?? persisted;
        if (state.activeModel === 'deepseek-chat' || state.activeModel === 'deepseek-reasoner') {
          state.activeModel = 'deepseek-v4-flash';
        }
        if (Array.isArray(state.messages)) {
          state.messages = state.messages
            .filter((m: ChatMessage) => m?.role && typeof m.content === 'string')
            .slice(-MAX_PERSISTED_MESSAGES);
        }
        return persisted;
      },
    }
  )
);
