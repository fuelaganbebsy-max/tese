import type { AIMessage, AIProvider, AIProviderConfig } from './types';
import { readOpenAiSseStream } from './sse';

const config: AIProviderConfig = {
  id: 'deepseek',
  displayName: 'DeepSeek',
  models: [
    {
      id: 'deepseek-v4-flash',
      label: 'DeepSeek V4 Flash',
      capability: 'fast',
      status: 'recommended',
      note: '默认快速模型，适合平法问答和参数解释。',
    },
    {
      id: 'deepseek-v4-pro',
      label: 'DeepSeek V4 Pro',
      capability: 'reasoning',
      status: 'available',
      note: '更强推理模型，适合复杂计算解释。',
    },
    {
      id: 'deepseek-chat',
      label: 'DeepSeek Chat',
      capability: 'balanced',
      status: 'deprecated',
      deprecationDate: '2026-07-24T15:59:00Z',
      note: '旧模型，按 DeepSeek 公告将停用。',
    },
    {
      id: 'deepseek-reasoner',
      label: 'DeepSeek Reasoner',
      capability: 'reasoning',
      status: 'deprecated',
      deprecationDate: '2026-07-24T15:59:00Z',
      note: '旧模型，按 DeepSeek 公告将停用。',
    },
  ],
  defaultModel: 'deepseek-v4-flash',
  apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
  docsUrl: 'https://platform.deepseek.com/docs',
  apiKeyUrl: 'https://platform.deepseek.com/api_keys',
  cors: 'supported',
};

const REQUEST_TIMEOUT_MS = 45000;

function buildBody(
  history: AIMessage[],
  systemPrompt: string,
  model: string,
  stream: boolean
) {
  return JSON.stringify({
    model,
    stream,
    messages: [{ role: 'system', content: systemPrompt }, ...history],
  });
}

async function checkResponse(res: Response): Promise<void> {
  if (res.ok) return;
  let msg = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (body?.error?.message) msg = body.error.message;
  } catch { /* ignore */ }
  throw new Error(msg);
}

function createTimeoutSignal(signal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const ctrl = new AbortController();
  const timeout = window.setTimeout(() => {
    ctrl.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, REQUEST_TIMEOUT_MS);

  const abort = () => ctrl.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }

  return {
    signal: ctrl.signal,
    cleanup: () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    },
  };
}

class DeepSeekProvider implements AIProvider {
  config = config;

  async chat(
    history: AIMessage[],
    systemPrompt: string,
    apiKey: string,
    options?: { model?: string; signal?: AbortSignal }
  ): Promise<string> {
    const model = options?.model ?? config.defaultModel;
    const timeout = createTimeoutSignal(options?.signal);
    try {
      const res = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: buildBody(history, systemPrompt, model, false),
        signal: timeout.signal,
      });
      await checkResponse(res);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    } finally {
      timeout.cleanup();
    }
  }

  async chatStream(
    history: AIMessage[],
    systemPrompt: string,
    apiKey: string,
    onChunk: (text: string) => void,
    options?: { model?: string; signal?: AbortSignal }
  ): Promise<string> {
    const model = options?.model ?? config.defaultModel;
    const timeout = createTimeoutSignal(options?.signal);
    try {
      const res = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: buildBody(history, systemPrompt, model, true),
        signal: timeout.signal,
      });
      await checkResponse(res);

      if (!res.body) throw new Error('No response body');

      return readOpenAiSseStream(res.body, onChunk);
    } finally {
      timeout.cleanup();
    }
  }
}

export const deepseekProvider: AIProvider = new DeepSeekProvider();
