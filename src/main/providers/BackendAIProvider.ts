import { createLogger } from '../core/logger';
import { getBackendAPI } from './BackendAPIProvider';
import type { AIProvider, ChatMessage, ChatOptions } from './OpenAIProvider';

const logger = createLogger('BackendAIProvider');

/**
 * AI provider that routes all requests through the Treeto backend.
 * The backend handles authentication and routing to the appropriate
 * AI service (Gemini, OpenAI, etc.).
 */
export class BackendAIProvider implements AIProvider {
  private model: string;

  constructor(model: string = 'gemini-2.0-flash') {
    this.model = model;
    logger.info('Backend AI provider initialized', { model: this.model });
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const backendAPI = getBackendAPI();
    const model = options.model || this.model;

    // Convert messages to Gemini-compatible format
    const contents = this.convertMessages(messages);

    const request = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.maxTokens ?? 1000,
        ...(options.responseFormat === 'json' && {
          responseMimeType: 'application/json',
        }),
      },
    };

    logger.debug('Sending chat request via backend', { model, messageCount: messages.length });

    const response = await backendAPI.chat(request);
    const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    logger.debug('Chat completion via backend', {
      model,
      promptTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    });

    return content;
  }

  private convertMessages(messages: ChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    // Gemini uses 'user' and 'model' roles, and system prompts go in the first user message
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    let systemPrompt = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += msg.content + '\n\n';
      } else if (msg.role === 'user') {
        const text = systemPrompt ? systemPrompt + msg.content : msg.content;
        contents.push({ role: 'user', parts: [{ text }] });
        systemPrompt = '';
      } else if (msg.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }

    return contents;
  }

  async complete(prompt: string, model?: string): Promise<string> {
    return this.chat([{ role: 'user', content: prompt }], { model });
  }
}
