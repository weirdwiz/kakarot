import { Person } from '@shared/types';
import { getDatabase, saveDatabase } from '../database';
import { createLogger } from '../../core/logger';

const logger = createLogger('PeopleRepository');

export class PeopleRepository {
  listAll(): Person[] {
    const db = getDatabase();
    const rows = db.exec(
      'SELECT * FROM people ORDER BY last_meeting_at DESC'
    )[0]?.values || [];

    return rows.map(this.rowToPerson);
  }

  search(query: string): Person[] {
    const db = getDatabase();
    const searchPattern = `%${query.toLowerCase()}%`;
    const rows = db.exec(
      `SELECT * FROM people 
       WHERE LOWER(email) LIKE ? OR LOWER(name) LIKE ?
       ORDER BY meeting_count DESC, last_meeting_at DESC`,
      [searchPattern, searchPattern]
    )[0]?.values || [];

    return rows.map(this.rowToPerson);
  }

  getByEmail(email: string): Person | null {
    const db = getDatabase();
    const rows = db.exec(
      'SELECT * FROM people WHERE email = ?',
      [email]
    )[0]?.values || [];

    if (rows.length === 0) return null;
    return this.rowToPerson(rows[0]);
  }

  updateNotes(email: string, notes: string): void {
    const db = getDatabase();
    db.run(
      'UPDATE people SET notes = ? WHERE email = ?',
      [notes, email]
    );
    saveDatabase();
    logger.info('Updated person notes', { email });
  }

  updateName(email: string, name: string): void {
    const db = getDatabase();
    db.run(
      'UPDATE people SET name = ? WHERE email = ?',
      [name, email]
    );
    saveDatabase();
    logger.info('Updated person name', { email, name });
  }

  updateOrganization(email: string, organization: string): void {
    const db = getDatabase();
    db.run(
      'UPDATE people SET organization = ? WHERE email = ?',
      [organization, email]
    );
    saveDatabase();
    logger.info('Updated person organization', { email, organization });
  }

  getByMeetingId(meetingId: string): Person[] {
    const db = getDatabase();
    const meetingRows = db.exec(
      'SELECT attendee_emails FROM meetings WHERE id = ?',
      [meetingId]
    )[0]?.values || [];

    if (meetingRows.length === 0) return [];

    const attendeeEmails: string[] = JSON.parse(meetingRows[0][0] as string);
    if (attendeeEmails.length === 0) return [];

    const placeholders = attendeeEmails.map(() => '?').join(',');
    const rows = db.exec(
      `SELECT * FROM people WHERE email IN (${placeholders})`,
      attendeeEmails
    )[0]?.values || [];

    return rows.map(this.rowToPerson);
  }

  getStats(): {
    totalPeople: number;
    totalMeetings: number;
    avgMeetingsPerPerson: number;
  } {
    const db = getDatabase();
    const statsRows = db.exec(
      `SELECT 
        COUNT(*) as total_people,
        SUM(meeting_count) as total_meetings,
        AVG(meeting_count) as avg_meetings
       FROM people`
    )[0]?.values || [];

    if (statsRows.length === 0) {
      return { totalPeople: 0, totalMeetings: 0, avgMeetingsPerPerson: 0 };
    }

    const [totalPeople, totalMeetings, avgMeetings] = statsRows[0];
    return {
      totalPeople: totalPeople as number,
      totalMeetings: totalMeetings as number,
      avgMeetingsPerPerson: avgMeetings as number,
    };
  }

  // Resolves name from: calendarDisplayName -> People API -> email extraction
  async upsertFromCalendarAttendee(
    email: string,
    calendarDisplayName?: string,
    organization?: string,
    peopleApiFetcher?: (email: string) => Promise<string | null>
  ): Promise<void> {
    if (!email) return;

    const db = getDatabase();
    const now = Date.now();

    let name = calendarDisplayName;

    if (!name && peopleApiFetcher) {
      try {
        name = await peopleApiFetcher(email) || undefined;
      } catch (error) {
        logger.debug('People API lookup failed', { email, error: (error as Error).message });
      }
    }

    if (!name) {
      const localPart = email.split('@')[0];
      const nameParts = localPart.split(/[._-]/).filter(part => part.length > 0);
      name = nameParts
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
      logger.debug('Using email-extracted name', { email, name });
    }

    const existing = db.exec('SELECT * FROM people WHERE email = ?', [email]);

    if (existing[0]?.values.length > 0) {
      db.run(
        'UPDATE people SET name = COALESCE(name, ?), organization = COALESCE(organization, ?), updated_at = ? WHERE email = ?',
        [name, organization || null, now, email]
      );
      logger.info('Updated person from calendar', { email, name, source: calendarDisplayName ? 'calendar' : 'fallback' });
    } else {
      db.run(
        `INSERT INTO people (email, name, last_meeting_at, meeting_count, total_duration, organization, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [email, name, now, 0, 0, organization || null, now, now]
      );
      logger.info('Created person from calendar', { email, name, source: calendarDisplayName ? 'calendar' : 'fallback' });
    }

    saveDatabase();
  }

  private rowToPerson(row: unknown[]): Person {
    return {
      email: row[0] as string,
      name: (row[1] as string | null) ?? undefined,
      lastMeetingAt: row[2] ? new Date(row[2] as number) : new Date(0),
      meetingCount: row[3] as number,
      totalDuration: row[4] as number,
      notes: (row[5] as string | null) ?? undefined,
      organization: (row[6] as string | null) ?? undefined,
    };
  }
}
