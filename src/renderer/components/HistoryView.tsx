import React, { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import type { Meeting } from '@shared/types';
import { Search, Trash2, Folder } from 'lucide-react';
import { formatDuration, formatTimestamp, getSpeakerLabel } from '../lib/formatters';

export default function HistoryView() {
  const { meetings, setMeetings, selectedMeeting, setSelectedMeeting } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadMeetings = useCallback(async () => {
    setIsLoading(true);
    try {
      const meetingsList = await window.kakarot.meetings.list();
      setMeetings(meetingsList);
    } finally {
      setIsLoading(false);
    }
  }, [setMeetings]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      const results = await window.kakarot.meetings.search(searchQuery);
      setMeetings(results);
    } else {
      loadMeetings();
    }
  };

  const handleSelectMeeting = async (meeting: Meeting) => {
    const fullMeeting = await window.kakarot.meetings.get(meeting.id);
    setSelectedMeeting(fullMeeting);
  };

  const handleDeleteMeeting = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this meeting?')) {
      await window.kakarot.meetings.delete(id);
      if (selectedMeeting?.id === id) {
        setSelectedMeeting(null);
      }
      loadMeetings();
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedMeeting) return;
    const summary = await window.kakarot.meetings.summarize(selectedMeeting.id);
    setSelectedMeeting({ ...selectedMeeting, summary });
  };

  const handleExport = async (format: 'markdown' | 'pdf') => {
    if (!selectedMeeting) return;
    const filePath = await window.kakarot.meetings.export(selectedMeeting.id, format);
    alert(`Exported to: ${filePath}`);
  };

  return (
    <div className="h-full flex bg-white">
      {/* Meeting list sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Meeting list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : meetings.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No meetings yet</div>
          ) : (
            meetings.map((meeting) => (
              <div
                key={meeting.id}
                onClick={() => handleSelectMeeting(meeting)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors ${
                  selectedMeeting?.id === meeting.id ? 'bg-gray-100' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {meeting.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDuration(meeting.duration)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteMeeting(meeting.id, e)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Meeting detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedMeeting ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {selectedMeeting.title}
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDuration(selectedMeeting.duration)} - {selectedMeeting.transcript.length} segments
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!selectedMeeting.summary && (
                    <button
                      onClick={handleGenerateSummary}
                      className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm transition-colors"
                    >
                      Generate Summary
                    </button>
                  )}
                  <button
                    onClick={() => handleExport('markdown')}
                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm transition-colors"
                  >
                    Export MD
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary */}
              {selectedMeeting.summary && (
                <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
                  <h2 className="text-sm font-medium text-gray-600 mb-2">Summary</h2>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedMeeting.summary}
                  </p>
                </div>
              )}

              {/* Transcript */}
              <div>
                <h2 className="text-sm font-medium text-gray-600 mb-3">Transcript</h2>
                <div className="space-y-3">
                  {selectedMeeting.transcript.map((segment) => (
                    <div
                      key={segment.id}
                      className={`flex ${
                        segment.source === 'mic' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          segment.source === 'mic'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-900 border border-gray-200'
                        }`}
                      >
                        <div className="text-xs opacity-70 mb-1">
                          {getSpeakerLabel(segment.source)} -{' '}
                          {formatTimestamp(segment.timestamp)}
                        </div>
                        <p className="text-sm">{segment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Folder className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Select a meeting to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
