import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { Clock, Users, FolderPlus, BookOpen, ChevronDown, X, Video, Calendar as CalendarIcon } from 'lucide-react';
import { formatDateTime } from '../lib/formatters';
import AttendeesList from './AttendeesList';

interface ManualNotesViewProps {
  meetingId?: string;
  onSelectTab?: (tab: 'notes' | 'prep' | 'interact') => void;
  onSaveNotes?: () => void;
}

export default function ManualNotesView({ meetingId, onSelectTab, onSaveNotes }: ManualNotesViewProps) {
  const { activeCalendarContext, calendarContext } = useAppStore();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTimePopover, setShowTimePopover] = useState(false);
  const timeButtonRef = useRef<HTMLButtonElement>(null);
  const timePopoverRef = useRef<HTMLDivElement>(null);

  const meeting = activeCalendarContext || calendarContext;
  
  // Debug meeting object
  useEffect(() => {
    if (meeting) {
      console.log('[ManualNotesView] Meeting object:', JSON.stringify(meeting, null, 2));
      console.log('[ManualNotesView] Meeting location:', meeting.location);
      console.log('[ManualNotesView] Meeting provider:', meeting.provider);
    }
  }, [meeting]);
  
  const meetingTitle = meeting?.title || 'Untitled Meeting';
  const meetingTime = meeting ? new Date(meeting.start).toLocaleString([], { 
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

  // Detect meeting platform from location/URL
  const getMeetingPlatform = () => {
    if (!meeting?.location) {
      console.log('[ManualNotesView] No location found, checking for meeting:', meeting);
      return null;
    }
    console.log('[ManualNotesView] Meeting location:', meeting.location);
    const location = meeting.location.toLowerCase();
    
    // Check for URLs with https:// prefix
    if (location.includes('zoom.us') || location.includes('zoom.com') || location.includes('zoom')) 
      return { name: 'Zoom', type: 'zoom', url: meeting.location };
    if (location.includes('meet.google') || location.includes('google.com/meet') || location.includes('meet')) 
      return { name: 'Google Meet', type: 'google-meet', url: meeting.location };
    if (location.includes('teams.microsoft') || location.includes('teams.live.com') || location.includes('teams')) 
      return { name: 'Microsoft Teams', type: 'teams', url: meeting.location };
    if (location.includes('webex') || location.includes('cisco')) 
      return { name: 'Cisco Webex', type: 'webex', url: meeting.location };
    if (location.includes('hangout')) 
      return { name: 'Google Hangouts', type: 'hangouts', url: meeting.location };
    
    console.log('[ManualNotesView] No meeting platform detected for location:', meeting.location);
    return null;
  };

  // Get calendar provider display info
  const getCalendarProviderInfo = () => {
    const provider = meeting?.provider;
    switch (provider) {
      case 'google':
        return { name: 'Google Calendar', type: 'google', color: '#4285F4' };
      case 'outlook':
        return { name: 'Outlook Calendar', type: 'outlook', color: '#0078D4' };
      case 'icloud':
        return { name: 'Apple Calendar', type: 'icloud', color: '#555555' };
      default:
        return { name: 'Calendar', type: 'default', color: '#808080' };
    }
  };

  const getCalendarEventUrl = () => {
    if (!meeting?.id) return null;
    const provider = meeting?.provider;
    switch (provider) {
      case 'google':
        // For Google Calendar, construct URL to search/view the event
        return `https://calendar.google.com/calendar/u/0/r/search?q=${encodeURIComponent(meeting.title)}`;
      case 'outlook':
        // For Outlook, direct to calendar
        return 'https://outlook.office.com/calendar';
      case 'icloud':
        // For iCloud, direct to calendar
        return 'https://www.icloud.com/calendar';
      default:
        return null;
    }
  };

  const meetingPlatform = getMeetingPlatform();
  const calendarProvider = getCalendarProviderInfo();
  const calendarEventUrl = getCalendarEventUrl();

  const handleJoinMeeting = () => {
    const url = meetingPlatform?.url || meeting?.location;
    if (url) {
      console.log('[ManualNotesView] Opening meeting URL:', url);
      window.open(url, '_blank');
    }
  };

  const handleOpenCalendar = () => {
    if (calendarEventUrl) {
      window.open(calendarEventUrl, '_blank');
    }
  };

  // Render logo for meeting platform
  const renderPlatformLogo = (type: string) => {
    switch (type) {
      case 'google-meet':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" fill="#00897B"/>
            <path d="M15 9L21 6V18L15 15V9Z" fill="#00796B"/>
            <path d="M15 9H5V15H15V9Z" fill="#4DB6AC"/>
          </svg>
        );
      case 'teams':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19.5 3H4.5C3.67157 3 3 3.67157 3 4.5V19.5C3 20.3284 3.67157 21 4.5 21H19.5C20.3284 21 21 20.3284 21 19.5V4.5C21 3.67157 20.3284 3 19.5 3Z" fill="#5059C9"/>
            <circle cx="12" cy="12" r="4" fill="white"/>
            <path d="M10 10H14V14H10V10Z" fill="#5059C9"/>
          </svg>
        );
      case 'zoom':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="14" rx="2" fill="#2D8CFF"/>
            <path d="M8 10L14 13L8 16V10Z" fill="white"/>
          </svg>
        );
      default:
        return <Video className="w-4 h-4" />;
    }
  };

  // Render logo for calendar provider
  const renderCalendarLogo = (type: string) => {
    switch (type) {
      case 'google':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="white"/>
            <rect x="2" y="2" width="20" height="6" rx="2" fill="#4285F4"/>
            <text x="12" y="16" textAnchor="middle" fill="#4285F4" fontSize="11" fontWeight="700" fontFamily="Arial, sans-serif">31</text>
            <rect x="2" y="19" width="20" height="3" fill="#34A853"/>
            <rect x="2" y="19" width="6.67" height="3" fill="#EA4335"/>
            <rect x="15.33" y="19" width="6.67" height="3" fill="#FBBC04"/>
          </svg>
        );
      case 'outlook':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="#0078D4"/>
            <path d="M12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8Z" fill="white"/>
          </svg>
        );
      case 'icloud':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="#E63946"/>
            <text x="12" y="10" textAnchor="middle" fill="white" fontSize="7" fontWeight="600">WED</text>
            <text x="12" y="17" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">28</text>
          </svg>
        );
      default:
        return <CalendarIcon className="w-4 h-4" />;
    }
  };

  const handleSaveNotes = async () => {
    if (!notes.trim()) {
      console.warn('Notes are empty, nothing to save');
      return;
    }

    setIsSaving(true);
    try {
      // For upcoming meetings, we create a meeting entry without audio recording
      // This will be saved as a manual note entry
      if (meetingId) {
        await window.kakarot.meetings.saveManualNotes(meetingId, notes);
        console.log('Manual notes saved for meeting:', meetingId);
      } else {
        console.warn('No meeting ID provided, cannot save notes');
      }
      
      // Notify parent that notes were saved
      onSaveNotes?.();
      setNotes('');
    } catch (error) {
      console.error('Failed to save manual notes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Close time popover when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        timePopoverRef.current && !timePopoverRef.current.contains(target) &&
        timeButtonRef.current && !timeButtonRef.current.contains(target)
      ) {
        setShowTimePopover(false);
      }
    };
    
    if (showTimePopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTimePopover]);

  const duration = meeting ? Math.round((meeting.end.getTime() - meeting.start.getTime()) / (1000 * 60)) : 0;
  const formattedDate = meeting ? new Date(meeting.start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  const formattedTime = meeting ? new Date(meeting.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const endTime = meeting ? new Date(meeting.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="h-full bg-studio text-slate-ink dark:bg-onyx dark:text-gray-100 flex flex-col">
      {/* Header Section */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        {/* Meeting Title */}
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">
          {meetingTitle}
        </h1>

        {/* Meeting Metadata */}
        <div className="flex items-center gap-3 text-sm flex-wrap relative">
          <div className="relative">
            <button 
              ref={timeButtonRef}
              onClick={() => setShowTimePopover(!showTimePopover)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-700/80 transition text-slate-600 dark:text-slate-400"
            >
              <Clock className="w-4 h-4" />
              <span>{meetingTime}</span>
              <ChevronDown className="w-4 h-4 opacity-50" />
            </button>

            {showTimePopover && (
              <div
                ref={timePopoverRef}
                className="absolute top-full left-0 mt-2 bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-800 dark:border-slate-700 shadow-2xl z-50 overflow-hidden min-w-max"
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">Meeting Time</h3>
                  <button
                    onClick={() => setShowTimePopover(false)}
                    className="p-1 text-slate-400 hover:text-slate-200 transition rounded hover:bg-slate-800/50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-medium mb-1">Date</p>
                    <p className="text-sm text-white font-medium">{formattedDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-medium mb-1">Time</p>
                    <p className="text-sm text-white font-medium">{formattedTime} – {endTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-medium mb-1">Duration</p>
                    <p className="text-sm text-white font-medium">{duration} minutes</p>
                  </div>

                  {/* Meeting Platform */}
                  {meetingPlatform && (
                    <div className="pt-2 border-t border-slate-800">
                      <button
                        onClick={handleJoinMeeting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition"
                      >
                        <div className="w-6 h-6 flex items-center justify-center">
                          {renderPlatformLogo(meetingPlatform.type)}
                        </div>
                        Join {meetingPlatform.name}
                      </button>
                    </div>
                  )}

                  {/* Calendar Provider */}
                  <div className="pt-2 border-t border-slate-800">
                    <button 
                      onClick={handleOpenCalendar}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition"
                      style={calendarProvider.type !== 'default' ? { backgroundColor: `${calendarProvider.color}20`, borderColor: calendarProvider.color } : undefined}
                    >
                      <div className="w-6 h-6 flex items-center justify-center">
                        {calendarProvider.type === 'default' ? (
                          <Calendar className="w-4 h-4" />
                        ) : (
                          renderCalendarLogo(calendarProvider.type)
                        )}
                      </div>
                      Open in {calendarProvider.name}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {meeting?.attendees && meeting.attendees.length > 0 ? (
            <div className="min-w-0 flex-1">
              <AttendeesList attendeeEmails={meeting.attendees} />
            </div>
          ) : (
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-700/80 transition text-slate-600 dark:text-slate-400">
              <Users className="w-4 h-4" />
              Add attendees
            </button>
          )}

          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-700/80 transition text-slate-600 dark:text-slate-400">
            <FolderPlus className="w-4 h-4" />
            Add to folder
          </button>
        </div>
      </div>

      {/* Notes Editor */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Write notes..."
          className="w-full h-full resize-none bg-transparent text-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* Bottom Bar */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {notes.length} characters
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab?.('prep')}
            className="px-4 py-2 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-300/60 dark:hover:bg-slate-600/60 text-slate-700 dark:text-slate-300 font-medium transition-colors flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Prep
          </button>
          <button
            onClick={handleSaveNotes}
            disabled={isSaving || !notes.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-mist hover:bg-emerald-mist/90 text-onyx font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
