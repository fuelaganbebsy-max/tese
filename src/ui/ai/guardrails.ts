import type { AIMessage } from './providers';

export const MAX_INPUT_CHARS = 4000;
export const MAX_CONTEXT_MESSAGES = 20;

export interface GuardrailResult {
  ok: boolean;
  text?: string;
  error?: string;
  warning?: string;
}

const DOMAIN_TERMS = [
  '22g101',
  '16g101',
  '11g101',
  'gb50010',
  'gb 50010',
  'gb50011',
  'gb 50011',
  '平法',
  '钢筋',
  '配筋',
  '锚固',
  '搭接',
  '弯钩',
  '箍筋',
  '加密',
  '梁',
  '柱',
  '框架',
  '构造',
  '混凝土',
  '抗震',
  '保护层',
  '支座',
  '负筋',
  '通长筋',
  '架立筋',
  '腰筋',
  '扭筋',
  'lae',
  'lab',
  'n4c',
  'c8@',
  'hrb',
  'hpb',
  'c25',
  'c30',
  'c35',
  'c40',
];

export function validateUserMessage(input: string, apiKey?: string): GuardrailResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: '请输入要咨询的平法或构件问题。' };
  }
  if (!apiKey?.trim()) {
    return { ok: false, error: '请先配置当前模型的 API Key，再发送问题。' };
  }

  const text = trimmed.length > MAX_INPUT_CHARS ? trimmed.slice(0, MAX_INPUT_CHARS) : trimmed;
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  const looksInDomain = DOMAIN_TERMS.some((term) => normalized.includes(term));

  return {
    ok: true,
    text,
    warning: looksInDomain
      ? undefined
      : '这个问题看起来可能超出平法范围。我会按 22G101/结构构造角度回答，若无关会说明边界。',
  };
}

export function selectHistoryForModel(messages: AIMessage[], maxMessages = MAX_CONTEXT_MESSAGES): AIMessage[] {
  return messages
    .filter((m) => m.content.trim())
    .slice(-maxMessages);
}

export function ensureAssistantText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '未获取到有效回答，请稍后重试或换一种问法。';
  }
  return trimmed;
}
