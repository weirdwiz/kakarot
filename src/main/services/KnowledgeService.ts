import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { getContainer } from '../core/container';
import { createLogger } from '../core/logger';
import { KNOWLEDGE_CONFIG } from '../config/constants';
import { getSpeakerLabel } from '../../shared/utils/formatters';

const logger = createLogger('KnowledgeService');

export interface SearchResult {
  content: string;
  source: string;
  score: number;
}

interface DocumentChunk {
  content: string;
  embedding: number[];
  metadata: {
    source: string;
    filename?: string;
    meetingId?: string;
    title?: string;
  };
}

export class KnowledgeService {
  private documents: DocumentChunk[] = [];
  private indexedPaths: Set<string> = new Set();

  async indexPath(dirPath: string): Promise<void> {
    const { aiProvider } = getContainer();
    if (!aiProvider) {
      throw new Error('OpenAI API key not configured');
    }

    if (!existsSync(dirPath)) {
      throw new Error(`Path does not exist: ${dirPath}`);
    }

    const fileContents: { content: string; source: string; filename: string }[] = [];
    this.collectFiles(dirPath, fileContents);

    if (fileContents.length === 0) {
      logger.info('No documents found to index');
      return;
    }

    // Split and embed documents
    let totalChunks = 0;
    for (const file of fileContents) {
      const chunks = this.splitText(file.content);
      for (const chunk of chunks) {
        const embedding = await aiProvider.embed(chunk);
        this.documents.push({
          content: chunk,
          embedding,
          metadata: {
            source: file.source,
            filename: file.filename,
          },
        });
        totalChunks++;
      }
    }

    this.indexedPaths.add(dirPath);
    logger.info('Indexed documents', { chunks: totalChunks, files: fileContents.length });
  }

  private collectFiles(
    dirPath: string,
    files: { content: string; source: string; filename: string }[]
  ): void {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.startsWith('.') && entry !== 'node_modules') {
          this.collectFiles(fullPath, files);
        }
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase();
        if ((KNOWLEDGE_CONFIG.SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            files.push({
              content,
              source: fullPath,
              filename: entry,
            });
          } catch (error) {
            logger.warn('Failed to read file', { path: fullPath, error });
          }
        }
      }
    }
  }

  private splitText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + KNOWLEDGE_CONFIG.CHUNK_SIZE, text.length);
      chunks.push(text.slice(start, end));
      start += KNOWLEDGE_CONFIG.CHUNK_SIZE - KNOWLEDGE_CONFIG.CHUNK_OVERLAP;
    }

    return chunks;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async search(query: string, k: number = KNOWLEDGE_CONFIG.MAX_SEARCH_RESULTS): Promise<SearchResult[]> {
    const { aiProvider } = getContainer();
    if (this.documents.length === 0 || !aiProvider) {
      return [];
    }

    const queryEmbedding = await aiProvider.embed(query);

    // Calculate similarity scores
    const scored = this.documents.map((doc) => ({
      content: doc.content,
      source: doc.metadata.source,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    // Sort by score descending and return top k
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  async indexMeetingTranscripts(): Promise<void> {
    const { aiProvider, meetingRepo } = getContainer();
    if (!aiProvider) {
      throw new Error('OpenAI API key not configured');
    }

    const meetings = meetingRepo.findAll();
    let totalChunks = 0;

    for (const meeting of meetings) {
      const fullMeeting = meetingRepo.findById(meeting.id);
      if (!fullMeeting) continue;

      // Create text from transcript
      const transcriptText = fullMeeting.transcript
        .map((seg) => `${getSpeakerLabel(seg.source)}: ${seg.text}`)
        .join('\n');

      if (transcriptText.trim()) {
        const chunks = this.splitText(transcriptText);
        for (const chunk of chunks) {
          const embedding = await aiProvider.embed(chunk);
          this.documents.push({
            content: chunk,
            embedding,
            metadata: {
              source: `meeting:${meeting.id}`,
              meetingId: meeting.id,
              title: meeting.title,
            },
          });
          totalChunks++;
        }
      }

      // Also index summary if available
      if (fullMeeting.summary) {
        const embedding = await aiProvider.embed(fullMeeting.summary);
        this.documents.push({
          content: fullMeeting.summary,
          embedding,
          metadata: {
            source: `meeting-summary:${meeting.id}`,
            meetingId: meeting.id,
            title: `${meeting.title} (Summary)`,
          },
        });
        totalChunks++;
      }
    }

    logger.info('Indexed meeting transcripts', { chunks: totalChunks, meetings: meetings.length });
  }

  getIndexedPaths(): string[] {
    return Array.from(this.indexedPaths);
  }

  clearIndex(): void {
    this.documents = [];
    this.indexedPaths.clear();
  }
}
