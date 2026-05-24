export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIProviderConfig {
  id: string;
  displayName: string;
  models: string[];
  defaultModel: string;
  apiEndpoint: string;
  docsUrl: string;
  apiKeyUrl: string;
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
