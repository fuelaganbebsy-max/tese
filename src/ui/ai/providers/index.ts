import { deepseekProvider } from './deepseek';
import type { AIProvider } from './types';

export const PROVIDERS: AIProvider[] = [deepseekProvider];

export function getProvider(id: string): AIProvider | undefined {
  return PROVIDERS.find((p) => p.config.id === id);
}

export type { AIProvider, AIMessage, AIProviderConfig } from './types';
