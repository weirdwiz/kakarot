import { ipcMain, desktopCapturer } from 'electron';
import { IPC_CHANNELS } from '@shared/ipcChannels';
import { getContainer } from '../core/container';
import { ExportService } from '../services/ExportService';

export function registerMeetingHandlers(): void {
  const { meetingRepo, calloutService } = getContainer();
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

  // Desktop sources for audio capture
  ipcMain.handle(IPC_CHANNELS.AUDIO_GET_SOURCES, async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 0, height: 0 },
    });
    return sources.map((s) => ({ id: s.id, name: s.name }));
  });
}
