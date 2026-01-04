# Enhanced Calendar Integration - Implementation Guide

## Quick Start

### What Was Built
A complete end-to-end calendar integration system that:
1. Syncs your Google/Microsoft calendar for the next 7 days
2. Shows clickable meetings in the dashboard
3. Displays meeting context (attendees, time, agenda) before recording
4. Links recordings to calendar events

### Core Components

#### 1. Calendar Sync Service (Main Process)
**File**: `src/main/services/CalendarService.ts`

```typescript
// Fetch upcoming meetings for next 7 days
const meetings = await calendarService.getUpcomingMeetings();

// Link a calendar event to meeting notes
await calendarService.linkEventToNotes(eventId, meetingId, 'google');

// Find calendar event for a meeting (reverse lookup)
const event = await calendarService.findCalendarEventForMeeting(meetingId);
```

#### 2. IPC Handlers (Main Process)
**File**: `src/main/handlers/calendarHandlers.ts`

New handlers registered:
- `calendar:getUpcoming` - Get 7-day meeting list
- `calendar:linkEvent` - Create event ↔ notes mapping
- `calendar:getEventForMeeting` - Reverse event lookup

#### 3. Frontend API (Renderer)
**File**: `src/preload/index.ts`

```typescript
// From renderer, call via:
const meetings = await window.kakarot.calendar.getUpcoming();
await window.kakarot.calendar.linkEvent(eventId, meetingId, 'google');
const event = await window.kakarot.calendar.getEventForMeeting(meetingId);
```

#### 4. State Management
**File**: `src/renderer/stores/appStore.ts`

```typescript
// Get calendar context from store
const { calendarContext, setCalendarContext } = useAppStore();

// Set context when selecting a meeting
setCalendarContext(calendarEvent);
```

#### 5. Meeting Context Preview
**File**: `src/renderer/components/MeetingContextPreview.tsx`

Shows before recording:
- Meeting title & duration
- Date & time
- Attendee list (first 3, +N more)
- Location
- Agenda preview
- Calendar provider badge

#### 6. Dashboard Navigation
**File**: `src/renderer/components/bento/BentoDashboard.tsx`

```typescript
// When user clicks a meeting:
const handleSelectUpcomingMeeting = (event: CalendarEvent) => {
  setCalendarContext(event);
  setView('recording');
  onSelectTab?.('prep');
};
```

## User Flow

### 1. **Onboarding** (Already Works)
User connects Google or Microsoft calendar during onboarding via OAuth.

### 2. **Dashboard** (Enhanced)
- Upcoming meetings appear in left sidebar
- Meetings are **clickable buttons**
- Hover state provides feedback

### 3. **Click Meeting**
```
User clicks meeting in dashboard
  ↓
handleSelectUpcomingMeeting() called
  ↓
Calendar context stored in AppStore
  ↓
View switches to 'recording'
  ↓
MeetingContextPreview modal appears
```

### 4. **Context Preview**
- Shows meeting details in modal
- User can dismiss with X button
- Or click "Start Recording" → recording begins with context

### 5. **Recording**
- Calendar context available in store: `useAppStore().calendarContext`
- After recording stops, linking is done automatically (optional)

### 6. **Post-Recording** (Future)
- Recording linked to calendar event via `linkEventToNotes()`
- Past meetings show "View Notes" in history

## Integration Points

### Adding Meeting Context to Recording

When recording starts, you can access calendar context:

```typescript
import { useAppStore } from '@renderer/stores/appStore';

export function MyRecordingComponent() {
  const { calendarContext } = useAppStore();
  
  if (calendarContext) {
    return (
      <div>
        <h2>{calendarContext.title}</h2>
        <p>Attendees: {calendarContext.attendees?.join(', ')}</p>
        <p>Notes: {calendarContext.description}</p>
      </div>
    );
  }
}
```

### Linking Notes After Recording

When a meeting finishes recording:

```typescript
// In your recording stop handler
const meeting = await window.kakarot.recording.stop();

if (calendarContext && meeting) {
  // Link the calendar event to the recording
  await window.kakarot.calendar.linkEvent(
    calendarContext.id,
    meeting.id,
    calendarContext.provider
  );
  
  // Clear context for next recording
  setCalendarContext(null);
}
```

### Showing Notes for Past Meetings

```typescript
// In history/past meetings view
const event = await window.kakarot.calendar.getEventForMeeting(meetingId);

if (event) {
  return (
    <button onClick={() => viewMeetingNotes(meetingId)}>
      View Notes for {event.title}
    </button>
  );
}
```

## Type System

### CalendarEvent (Shared)
```typescript
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  provider: 'google' | 'outlook' | 'icloud' | 'unknown';
  location?: string;
  attendees?: string[];  // Emails
  description?: string;  // Agenda
}
```

### CalendarEventMapping (New)
```typescript
interface CalendarEventMapping {
  calendarEventId: string;
  meetingId?: string;           // Links to recording
  notesId?: string;             // Links to notes document
  linkedAt: number;             // Epoch ms
  provider: 'google' | 'outlook' | 'icloud';
}
```

### AppSettings (Updated)
```typescript
interface AppSettings {
  // ... existing fields ...
  calendarConnections: CalendarConnections;
  calendarEventMappings?: Record<string, CalendarEventMapping>;
}
```

## Data Flow

```
Calendar Service (Main Process)
├─ Fetch from Google/Microsoft APIs
├─ Cache in AppSettings (settings.db)
└─ Expose via IPC handlers

IPC Bridge
├─ calendar:getUpcoming
├─ calendar:linkEvent
└─ calendar:getEventForMeeting

App Store (Renderer)
├─ calendarContext: CalendarEvent | null
└─ setCalendarContext: (event) => void

Components
├─ BentoDashboard
│  └─ UpcomingMeetingsList (clickable)
├─ RecordingView
│  └─ MeetingContextPreview (modal)
└─ Future: NotesView (show linked events)
```

## Error Handling

All methods include try-catch with graceful fallback:

```typescript
// In BentoDashboard
const loadUpcomingMeetings = useCallback(async () => {
  try {
    const events = await window.kakarot.calendar.getUpcoming();
    setCalendarEvents(events);
  } catch (err) {
    console.error('Failed to load calendar events:', err);
    // UI still renders empty state
  }
}, []);
```

## Testing Checklist

- [ ] Start app, calendar is connected from onboarding
- [ ] Navigate to Recording view
- [ ] See upcoming meetings in left sidebar
- [ ] Click a meeting
- [ ] MeetingContextPreview modal appears
- [ ] Modal shows all meeting details
- [ ] Click X to dismiss modal
- [ ] Start recording (meeting context in store)
- [ ] Stop recording
- [ ] Open history view
- [ ] Past recording shows linked meeting info

## Future Enhancements

### Phase 2: Background Sync
```typescript
// In CalendarService constructor
this.startBackgroundSync(10 * 60 * 1000); // 10 minutes

private startBackgroundSync(intervalMs: number) {
  setInterval(async () => {
    await this.getUpcomingMeetings();
  }, intervalMs);
}
```

### Phase 3: Calendar API Sync
```typescript
// Write notes back to calendar (optional, requires new scope)
async attachNotesToEvent(
  eventId: string,
  provider: 'google' | 'outlook',
  notesUrl: string
) {
  // Append notes link to event description
}
```

### Phase 4: Smart Attendee Extraction
```typescript
// Extract attendee names/emails from description
// Auto-suggest focus points from agenda
// Parse action items from meeting description
```

## Performance Notes

- **Lazy Loading**: Events only fetched when dashboard loads
- **Caching**: Results cached in AppSettings (SQLite)
- **No Polling**: Background sync ready but not active (Phase 2)
- **Minimal IPC**: Single sync call per dashboard view
- **Type Safety**: Full TypeScript throughout

## Security Notes

- No new OAuth scopes required (calendar read-only)
- Tokens stored in existing encrypted settings
- Local-only linking (no cloud sync)
- No data sent to external servers beyond calendar APIs
- User controls disclosure via optional event linking

## Backwards Compatibility

- All changes are additive
- Existing calendar.listToday() still works
- Existing onboarding unchanged
- New fields in AppSettings are optional
- Old settings load without migration

