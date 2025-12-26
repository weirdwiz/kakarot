export function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function formatTime(ms: number): string {
  return new Date(ms).toISOString().substring(14, 19);
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString();
}

export function getSpeakerLabel(source: 'mic' | 'system'): string {
  return source === 'mic' ? 'You' : 'Other';
}
