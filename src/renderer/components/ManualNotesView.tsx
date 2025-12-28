import React, { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Clock, User, FolderPlus, BookOpen } from 'lucide-react';
import { formatDateTime } from '../lib/formatters';

interface ManualNotesViewProps {
  meetingId?: string;
  onSelectTab?: (tab: 'notes' | 'prep' | 'interact') => void;
  onSaveNotes?: () => void;
}

export default function ManualNotesView({ meetingId, onSelectTab, onSaveNotes }: ManualNotesViewProps) {
  const { activeCalendarContext, calendarContext } = useAppStore();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const meeting = activeCalendarContext || calendarContext;
  const meetingTitle = meeting?.title || 'Untitled Meeting';
  const meetingTime = meeting ? new Date(meeting.start).toLocaleString([], { 
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

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

  return (
    <div className="h-full bg-studio text-slate-ink dark:bg-onyx dark:text-gray-100 flex flex-col">
      {/* Header Section */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        {/* Meeting Title */}
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">
          {meetingTitle}
        </h1>

        {/* Meeting Metadata */}
        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-700/80 transition">
            <Clock className="w-4 h-4" />
            <span>{meetingTime}</span>
          </button>
          
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-700/80 transition">
            <User className="w-4 h-4" />
            Me
          </button>

          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-700/80 transition">
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
