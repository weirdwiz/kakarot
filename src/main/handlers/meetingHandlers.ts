import { ipcMain, desktopCapturer } from 'electron';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import { getContainer } from '../core/container';
import { CalloutService } from '../services/CalloutService';
import { ExportService } from '../services/ExportService';
import { createLogger } from '../core/logger';

const logger = createLogger('MeetingHandlers');

export function registerMeetingHandlers(): void {
  const { meetingRepo } = getContainer();
  const calloutService = new CalloutService();
  const exportService = new ExportService();

  ipcMain.handle(IPC_CHANNELS.MEETINGS_LIST, () => {
    return meetingRepo.findAll();
  });

  ipcMain.handle(IPC_CHANNELS.MEETINGS_GET, (_, id: string) => {
    return meetingRepo.findById(id);
  });

  ipcMain.handle(IPC_CHANNELS.MEETINGS_DELETE, (_, id: string) => {
    return meetingRepo.delete(id);
  });

  ipcMain.handle(IPC_CHANNELS.MEETINGS_SEARCH, (_, query: string) => {
    return meetingRepo.search(query);
  });

  ipcMain.handle(
    IPC_CHANNELS.MEETINGS_CREATE_DISMISSED,
    (_, title: string, attendeeEmails?: string[]) => {
      logger.info('Creating dismissed meeting', { title, attendeeEmails });
      try {
        const meetingId = meetingRepo.startNewMeeting(title, attendeeEmails);
        logger.info('Started new meeting', { meetingId });
        // Immediately end it to mark as completed
        const meeting = meetingRepo.endCurrentMeeting();
        logger.info('Ended meeting immediately', { meetingId, meeting });
        return meetingId;
      } catch (error) {
        logger.error('Failed to create dismissed meeting', { error, title, attendeeEmails });
        throw error;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.MEETING_UPDATE_TITLE, (_, id: string, title: string) => {
    meetingRepo.updateTitle(id, title);
    return meetingRepo.findById(id);
  });

  ipcMain.handle(IPC_CHANNELS.MEETING_SUMMARIZE, async (_, id: string) => {
    const meeting = meetingRepo.findById(id);
    if (!meeting) throw new Error('Meeting not found');

    const summary = await calloutService.generateSummary(meeting);
    meetingRepo.updateSummary(id, summary);
    return summary;
  });

  ipcMain.handle(
    IPC_CHANNELS.MEETING_EXPORT,
    async (_, id: string, format: 'markdown' | 'pdf') => {
      const meeting = meetingRepo.findById(id);
      if (!meeting) throw new Error('Meeting not found');

      return exportService.exportMeeting(meeting, format);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MEETING_ASK_NOTES,
    async (_, meetingId: string, query: string) => {
      const { aiProvider } = getContainer();
      if (!aiProvider) {
        throw new Error('AI provider not configured');
      }

      const meeting = meetingRepo.findById(meetingId);
      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Build context for the AI
      const transcript = meeting.transcript.map((s) => `${s.source === 'mic' ? 'You' : 'Other'}: ${s.text}`).join('\n');
      const notes = meeting.notesMarkdown || meeting.overview || '';

      const prompt = `You are a helpful meeting assistant. The user is asking about their meeting notes.

Meeting Title: ${meeting.title}
Date: ${new Date(meeting.createdAt).toLocaleString()}

Generated Notes:
${notes}

Full Transcript:
${transcript}

User Question: ${query}

Provide a concise, helpful answer based on the meeting notes and transcript.`;

      const response = await aiProvider.complete(prompt, 'gpt-4o');
      return response;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MEETING_NOTES_SAVE_MANUAL,
    (_, meetingId: string, content: string) => {
      const meeting = meetingRepo.findById(meetingId);
      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Append manual note entry to existing notes
      const noteEntries = meeting.noteEntries || [];
      const newEntry = {
        id: `${meetingId}-manual-${Date.now()}`,
        content,
        type: 'manual' as const,
        createdAt: new Date(),
        source: 'upcoming' as const,
      };

      noteEntries.push(newEntry);

      // Update meeting with new note entries
      meetingRepo.updateNoteEntries(meetingId, noteEntries);
      
      logger.info('Saved manual notes for meeting', { meetingId, entryId: newEntry.id, contentLength: content.length });
    }
  );

  // Desktop sources for audio capture
  ipcMain.handle(IPC_CHANNELS.AUDIO_GET_SOURCES, async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 0, height: 0 },
    });
    return sources.map((s) => ({ id: s.id, name: s.name }));
  });
}
