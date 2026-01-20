import OpenAI from 'openai';
import { AI_MODELS } from '../config/constants';
import { createLogger } from '../core/logger';

const logger = createLogger('OpenAIProvider');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

// Common interface for AI providers
export interface AIProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}

export interface OpenAIProviderConfig {
  apiKey?: string;
  tokenProvider?: () => Promise<string | null>;
  baseURL?: string;
  defaultModel?: string;
}

export class OpenAIProvider {
  private client: OpenAI;
  private defaultModel: string;
  private tokenProvider?: () => Promise<string | null>;
  private baseURL?: string;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey || '',
      baseURL: config.baseURL,
    });
    this.defaultModel = config.defaultModel || AI_MODELS.GPT4O;
    this.tokenProvider = config.tokenProvider;
    this.baseURL = config.baseURL;
    logger.info('OpenAI provider initialized', { baseURL: config.baseURL || 'default', hosted: !!config.tokenProvider });
  }

  private async getClient(): Promise<OpenAI> {
    if (!this.tokenProvider) {
      return this.client;
    }

    const token = await this.tokenProvider();
    if (!token) {
      throw new Error('OpenAI token unavailable');
    }

    return new OpenAI({ apiKey: token, baseURL: this.baseURL });
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const client = await this.getClient();
    const response = await client.chat.completions.create({
      model: options.model || this.defaultModel,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1000,
      response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });

    const content = response.choices[0]?.message?.content || '';
    logger.debug('Chat completion', {
      model: options.model || this.defaultModel,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    });

    return content;
  }

  async complete(prompt: string, model?: string): Promise<string> {
    return this.chat([{ role: 'user', content: prompt }], { model: model || this.defaultModel });
  }

  async embed(text: string): Promise<number[]> {
    const client = await this.getClient();
    const response = await client.embeddings.create({
      model: AI_MODELS.EMBEDDING_SMALL,
      input: text,
    });
    return response.data[0].embedding;
  }
}
