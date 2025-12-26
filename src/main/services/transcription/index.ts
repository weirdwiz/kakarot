export type { ITranscriptionProvider, TranscriptCallback } from './TranscriptionProvider';
export { AssemblyAIProvider } from './AssemblyAIProvider';
export { DeepgramProvider } from './DeepgramProvider';

import type { TranscriptionProvider } from '../../../shared/types';
import type { ITranscriptionProvider } from './TranscriptionProvider';
import { AssemblyAIProvider } from './AssemblyAIProvider';
import { DeepgramProvider } from './DeepgramProvider';

export function createTranscriptionProvider(
  provider: TranscriptionProvider,
  assemblyAiKey: string,
  deepgramKey: string
): ITranscriptionProvider {
  switch (provider) {
    case 'deepgram':
      if (!deepgramKey) {
        throw new Error('Deepgram API key not configured');
      }
      return new DeepgramProvider(deepgramKey);

    case 'assemblyai':
    default:
      if (!assemblyAiKey) {
        throw new Error('AssemblyAI API key not configured');
      }
      return new AssemblyAIProvider(assemblyAiKey);
  }
}
