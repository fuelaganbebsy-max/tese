import type { AIMessage, AIProvider, AIProviderConfig } from './types';

const config: AIProviderConfig = {
  id: 'deepseek',
  displayName: 'DeepSeek',
  models: ['deepseek-chat', 'deepseek-reasoner'],
  defaultModel: 'deepseek-chat',
  apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
  docsUrl: 'https://platform.deepseek.com/docs',
  apiKeyUrl: 'https://platform.deepseek.com/api_keys',
};

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

class DeepSeekProvider implements AIProvider {
  config = config;

  async chat(
    history: AIMessage[],
    systemPrompt: string,
    apiKey: string,
    options?: { model?: string; signal?: AbortSignal }
  ): Promise<string> {
    const model = options?.model ?? config.defaultModel;
    const res = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: buildBody(history, systemPrompt, model, false),
      signal: options?.signal,
    });
    await checkResponse(res);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  async chatStream(
    history: AIMessage[],
    systemPrompt: string,
    apiKey: string,
    onChunk: (text: string) => void,
    options?: { model?: string; signal?: AbortSignal }
  ): Promise<string> {
    const model = options?.model ?? config.defaultModel;
    const res = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: buildBody(history, systemPrompt, model, true),
      signal: options?.signal,
    });
    await checkResponse(res);

    if (!res.body) throw new Error('No response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const chunk: string = parsed.choices?.[0]?.delta?.content ?? '';
            if (chunk) {
              fullText += chunk;
              onChunk(chunk);
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }
}

export const deepseekProvider: AIProvider = new DeepSeekProvider();
