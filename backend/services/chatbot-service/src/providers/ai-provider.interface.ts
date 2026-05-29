export interface GenerateInput {
  prompt: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

export interface ProviderResponse {
  text: string;
  tokens?: number;
  raw?: any;
  confidence?: number;
}

export interface AIProvider {
  name: string;
  generate(
    input: GenerateInput,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<ProviderResponse>;
  stream?(
    input: GenerateInput,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ): AsyncGenerator<string, void, unknown>;
  healthCheck(): Promise<boolean>;
}
