import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { createLogger } from '../core/logger';
import { EXPORT_CONFIG } from '../config/constants';
import { getSpeakerLabel, formatTime } from '@shared/utils/formatters';
import type { Meeting } from '@shared/types';

const logger = createLogger('ExportService');

export class ExportService {
  exportMeeting(meeting: Meeting, format: 'markdown' | 'pdf'): string {
    const userDataPath = app.getPath('userData');
    const exportDir = join(userDataPath, EXPORT_CONFIG.EXPORT_DIR);

    if (!existsSync(exportDir)) {
      mkdirSync(exportDir, { recursive: true });
    }

    if (format === 'pdf') {
      logger.warn('PDF export not implemented, exporting as markdown');
    }

    const safeTitle = meeting.title.replace(/[^a-z0-9]/gi, '_');
    const filePath = join(exportDir, `${safeTitle}_${meeting.id.slice(0, 8)}.md`);
    writeFileSync(filePath, this.toMarkdown(meeting));
    logger.info('Exported meeting to markdown', { path: filePath });
    return filePath;
  }

  private toMarkdown(meeting: Meeting): string {
    let md = `# ${meeting.title}\n\n`;
    md += `**Date**: ${new Date(meeting.createdAt).toLocaleString()}\n`;
    md += `**Duration**: ${Math.floor(meeting.duration / 60)}m ${meeting.duration % 60}s\n\n`;

    if (meeting.summary) {
      md += `## Summary\n\n${meeting.summary}\n\n`;
    }

    if (meeting.actionItems.length > 0) {
      md += `## Action Items\n\n`;
      for (const item of meeting.actionItems) {
        md += `- [ ] ${item}\n`;
      }
      md += '\n';
    }

    md += `## Transcript\n\n`;
    for (const seg of meeting.transcript) {
      const speaker = getSpeakerLabel(seg.source);
      const time = formatTime(seg.timestamp);
      md += `**[${time}] ${speaker}**: ${seg.text}\n\n`;
    }

    return md;
  }
}
