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

export class OpenAIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
    logger.info('OpenAI provider initialized');
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: options.model || AI_MODELS.GPT4_TURBO,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1000,
      response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });

    const content = response.choices[0]?.message?.content || '';
    logger.debug('Chat completion', {
      model: options.model || AI_MODELS.GPT4_TURBO,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    });

    return content;
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: AI_MODELS.EMBEDDING_SMALL,
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: AI_MODELS.EMBEDDING_SMALL,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }
}
