export type { ITranscriptionProvider, TranscriptCallback } from './TranscriptionProvider';
export { AssemblyAIProvider } from './AssemblyAIProvider';
export { DeepgramProvider } from './DeepgramProvider';

import type { TranscriptionProvider } from '@shared/types';
import type { ITranscriptionProvider } from './TranscriptionProvider';
import { AssemblyAIProvider } from './AssemblyAIProvider';
import { DeepgramProvider } from './DeepgramProvider';

export function createTranscriptionProvider(
  provider: TranscriptionProvider,
  assemblyAiKey: string,
  deepgramKey: string,
  hostedTokenManager?: { getAssemblyAIToken: () => Promise<string | null> },
  useHostedTokens?: boolean
): ITranscriptionProvider {
  switch (provider) {
    case 'deepgram':
      if (!deepgramKey) {
        throw new Error('Deepgram API key not configured');
      }
      return new DeepgramProvider(deepgramKey);

    case 'assemblyai':
    default:
      if (useHostedTokens && hostedTokenManager) {
        return new AssemblyAIProviderWithHostedTokens(hostedTokenManager);
      }

      if (!assemblyAiKey) {
        throw new Error('AssemblyAI API key not configured');
      }
      return new AssemblyAIProvider(assemblyAiKey);
  }
}

class AssemblyAIProviderWithHostedTokens extends AssemblyAIProvider {
  private hostedTokenManager: { getAssemblyAIToken: () => Promise<string | null> };

  constructor(hostedTokenManager: { getAssemblyAIToken: () => Promise<string | null> }) {
    super('');
    this.hostedTokenManager = hostedTokenManager;
  }

  async connect(): Promise<void> {
    const token = await this.hostedTokenManager.getAssemblyAIToken();
    if (!token) {
      throw new Error('Hosted AssemblyAI token unavailable');
    }
    // Reinitialize client with fresh token before connecting
    (this as any).client = new (require('assemblyai').AssemblyAI)({ apiKey: token });
    return super.connect();
  }
}
