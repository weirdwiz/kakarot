import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase, resultToObject, resultToObjectByIndex } from '../database';
import type { Meeting, TranscriptSegment } from '@shared/types';
import { createLogger } from '../../core/logger';

const logger = createLogger('MeetingRepository');

// Track current meeting state
let currentMeetingId: string | null = null;
let meetingStartTime: number | null = null;

export class MeetingRepository {
  async startNewMeeting(title?: string): Promise<string> {
    const db = getDatabase();
    const id = uuidv4();
    const now = Date.now();
    const meetingTitle = title || new Date(now).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    db.run('INSERT INTO meetings (id, title, created_at) VALUES (?, ?, ?)', [id, meetingTitle, now]);
    currentMeetingId = id;
    meetingStartTime = now;
    saveDatabase();

    logger.info('Started new meeting', { id, title: meetingTitle });
    return id;
  }

  getCurrentMeetingId(): string | null {
    return currentMeetingId;
  }

  async endCurrentMeeting(): Promise<Meeting | null> {
    const db = getDatabase();
    if (!currentMeetingId) return null;

    const now = Date.now();
    const duration = meetingStartTime ? Math.floor((now - meetingStartTime) / 1000) : 0;

    db.run('UPDATE meetings SET ended_at = ?, duration = ? WHERE id = ?', [
      now,
      duration,
      currentMeetingId,
    ]);

    const meeting = this.findById(currentMeetingId);
    const endedId = currentMeetingId;
    currentMeetingId = null;
    meetingStartTime = null;
    saveDatabase();

    logger.info('Ended meeting', { id: endedId, duration });
    return meeting;
  }

  addTranscriptSegment(segment: TranscriptSegment): void {
    const db = getDatabase();
    if (!currentMeetingId) return;

    db.run(
      `INSERT OR REPLACE INTO transcript_segments
       (id, meeting_id, text, timestamp, source, confidence, is_final, speaker_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        segment.id,
        currentMeetingId,
        segment.text,
        segment.timestamp,
        segment.source,
        segment.confidence,
        segment.isFinal ? 1 : 0,
        segment.speakerId || null,
      ]
    );
    saveDatabase();
  }

  findById(id: string): Meeting | null {
    const db = getDatabase();
    const meetingResult = db.exec('SELECT * FROM meetings WHERE id = ?', [id]);
    if (meetingResult.length === 0 || meetingResult[0].values.length === 0) return null;

    const row = resultToObject(meetingResult[0]);
    const segmentsResult = db.exec(
      'SELECT * FROM transcript_segments WHERE meeting_id = ? ORDER BY timestamp',
      [id]
    );
    const segments =
      segmentsResult.length > 0
        ? segmentsResult[0].values.map((_, i) => resultToObjectByIndex(segmentsResult[0], i))
        : [];

    return this.rowToMeeting(row, segments);
  }

  findAll(): Meeting[] {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM meetings ORDER BY created_at DESC');
    if (result.length === 0) return [];

    return result[0].values.map((_, i) => {
      const row = resultToObjectByIndex(result[0], i);
      const segmentsResult = db.exec(
        'SELECT * FROM transcript_segments WHERE meeting_id = ? ORDER BY timestamp',
        [row.id as string]
      );
      const segments =
        segmentsResult.length > 0
          ? segmentsResult[0].values.map((__, j) => resultToObjectByIndex(segmentsResult[0], j))
          : [];
      return this.rowToMeeting(row, segments);
    });
  }

  search(query: string): Meeting[] {
    const db = getDatabase();
    const searchPattern = `%${query}%`;
    const result = db.exec(
      `SELECT DISTINCT m.* FROM meetings m
       LEFT JOIN transcript_segments s ON m.id = s.meeting_id
       WHERE m.title LIKE ? OR s.text LIKE ?
       ORDER BY m.created_at DESC`,
      [searchPattern, searchPattern]
    );

    if (result.length === 0) return [];

    return result[0].values.map((_, i) => {
      const row = resultToObjectByIndex(result[0], i);
      const segmentsResult = db.exec(
        'SELECT * FROM transcript_segments WHERE meeting_id = ? ORDER BY timestamp',
        [row.id as string]
      );
      const segments =
        segmentsResult.length > 0
          ? segmentsResult[0].values.map((__, j) => resultToObjectByIndex(segmentsResult[0], j))
          : [];
      return this.rowToMeeting(row, segments);
    });
  }

  delete(id: string): void {
    const db = getDatabase();
    db.run('DELETE FROM transcript_segments WHERE meeting_id = ?', [id]);
    db.run('DELETE FROM meetings WHERE id = ?', [id]);
    saveDatabase();
    logger.info('Deleted meeting', { id });
  }

  updateSummary(id: string, summary: string): void {
    const db = getDatabase();
    db.run('UPDATE meetings SET summary = ? WHERE id = ?', [summary, id]);
    saveDatabase();
  }

  updateNotes(id: string, notes: unknown, notesPlain: string, notesMarkdown: string): void {
    const db = getDatabase();
    db.run(
      'UPDATE meetings SET notes = ?, notes_plain = ?, notes_markdown = ? WHERE id = ?',
      [JSON.stringify(notes), notesPlain, notesMarkdown, id]
    );
    saveDatabase();
  }

  updateOverview(id: string, overview: string): void {
    const db = getDatabase();
    db.run('UPDATE meetings SET overview = ? WHERE id = ?', [overview, id]);
    saveDatabase();
  }

  updateChapters(id: string, chapters: Meeting['chapters']): void {
    const db = getDatabase();
    db.run('UPDATE meetings SET chapters = ? WHERE id = ?', [JSON.stringify(chapters), id]);
    saveDatabase();
  }

  updatePeople(id: string, people: Meeting['people']): void {
    const db = getDatabase();
    db.run('UPDATE meetings SET people = ? WHERE id = ?', [JSON.stringify(people), id]);
    saveDatabase();
  }

  updateNoteEntries(id: string, noteEntries: any[]): void {
    const db = getDatabase();
    db.run('UPDATE meetings SET note_entries = ? WHERE id = ?', [JSON.stringify(noteEntries), id]);
    saveDatabase();
  }

  private rowToMeeting(row: Record<string, unknown>, segments: Record<string, unknown>[]): Meeting {
    return {
      id: row.id as string,
      title: row.title as string,
      createdAt: new Date(row.created_at as number),
      endedAt: row.ended_at ? new Date(row.ended_at as number) : null,
      duration: (row.duration as number) || 0,
      transcript: segments.map((s) => ({
        id: s.id as string,
        text: s.text as string,
        timestamp: s.timestamp as number,
        source: s.source as 'mic' | 'system',
        confidence: s.confidence as number,
        isFinal: (s.is_final as number) === 1,
        words: [],
        speakerId: s.speaker_id as string | undefined,
      })),
      noteEntries: row.note_entries ? JSON.parse(row.note_entries as string) : [],
      notes: row.notes ? JSON.parse(row.notes as string) : null,
      notesPlain: (row.notes_plain as string) || null,
      notesMarkdown: (row.notes_markdown as string) || null,
      overview: (row.overview as string) || null,
      summary: (row.summary as string) || null,
      chapters: JSON.parse((row.chapters as string) || '[]'),
      people: JSON.parse((row.people as string) || '[]'),
      actionItems: JSON.parse((row.action_items as string) || '[]'),
      participants: JSON.parse((row.participants as string) || '[]'),
    };
  }
}
