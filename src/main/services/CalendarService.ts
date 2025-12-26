import { createLogger } from '../core/logger';
import type { CalendarEvent } from '../../shared/types';

const logger = createLogger('CalendarService');

export class CalendarService {
  async listToday(): Promise<CalendarEvent[]> {
    // TODO: Integrate with Google/Apple/Outlook. For now, return mock data.
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const sample: CalendarEvent[] = [
      {
        id: 'evt-1',
        title: 'Weekly Sprint Planning',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 45),
        provider: 'unknown',
        location: 'Zoom',
        attendees: ['Team'],
      },
      {
        id: 'evt-2',
        title: 'Enter Weekly Forecast',
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 21, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 22, 0),
        provider: 'unknown',
      },
    ];

    logger.info('Returning mock calendar events', { count: sample.length });
    // Filter to events that start on the current day
    return sample.filter((e) => e.start >= startOfDay && e.start.getDate() === now.getDate());
  }
}
