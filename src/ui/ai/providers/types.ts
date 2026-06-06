export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIProviderConfig {
  id: string;
  displayName: string;
  models: AIModelConfig[];
  defaultModel: string;
  apiEndpoint: string;
  docsUrl: string;
  apiKeyUrl: string;
  cors: 'supported' | 'unknown' | 'unsupported';
}

export interface AIModelConfig {
  id: string;
  label: string;
  capability: 'fast' | 'reasoning' | 'balanced';
  status: 'recommended' | 'available' | 'deprecated';
  deprecationDate?: string;
  note?: string;
}

export interface AIProvider {
  config: AIProviderConfig;
  chat(
    history: AIMessage[],
    systemPrompt: string,
    apiKey: string,
    options?: { model?: string; signal?: AbortSignal }
  ): Promise<string>;
  chatStream(
    history: AIMessage[],
    systemPrompt: string,
    apiKey: string,
    onChunk: (text: string) => void,
    options?: { model?: string; signal?: AbortSignal }
  ): Promise<string>;
}
