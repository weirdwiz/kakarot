/**
 * Format milliseconds to mm:ss timestamp
 * Used in transcript displays
 */
export function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to human-readable duration (Xm Ys)
 * Used in meeting list displays
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

/**
 * Format time from milliseconds to ISO time string (HH:MM)
 * Used in markdown export
 */
export function formatTime(ms: number): string {
  return new Date(ms).toISOString().substring(14, 19);
}

/**
 * Format Date to localized string
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString();
}

/**
 * Get speaker label from audio source
 * Centralizes the 'mic' -> 'You', 'system' -> 'Other' mapping
 */
export function getSpeakerLabel(source: 'mic' | 'system'): string {
  return source === 'mic' ? 'You' : 'Other';
}
