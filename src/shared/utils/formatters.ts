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

export function formatDateShort(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

export function formatTimeShort(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function isToday(date: Date): boolean {
  return new Date(date).toDateString() === new Date().toDateString();
}

export function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return new Date(date).toDateString() === tomorrow.toDateString();
}

export function formatDateTimeContext(date: Date): string {
  const d = new Date(date);
  if (isToday(d)) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
