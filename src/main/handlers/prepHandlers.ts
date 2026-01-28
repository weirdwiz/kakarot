import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import { getContainer } from '../core/container';
import { createLogger } from '../core/logger';
import type { GenerateMeetingPrepInput, MeetingPrepOutput } from '../services/PrepService';

const logger = createLogger('PrepHandlers');

export function registerPrepHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PREP_GENERATE_BRIEFING,
    async (_event, input: GenerateMeetingPrepInput): Promise<MeetingPrepOutput> => {
      try {
        const { prepService, aiProvider } = getContainer();

        if (!prepService) {
          throw new Error('Prep service not available');
        }

        if (!aiProvider) {
          throw new Error('AI provider not configured');
        }

        logger.info('Generating meeting prep briefing', {
          meetingType: input.meeting.meeting_type,
          participantCount: input.participants.length,
        });

        const result = await prepService.generateMeetingPrep(input);

        logger.debug('Meeting prep generated successfully', {
          participantCount: result.participants.length,
          topicCount: result.agenda.key_topics.length,
        });

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to generate meeting prep', { error: errorMessage });
        throw error;
      }
    }
  );

  logger.info('Prep handlers registered');
}
