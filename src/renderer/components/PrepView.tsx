import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { Search, Users, Calendar, Clock, FileText, TrendingUp, Mail, Building2, ChevronRight } from 'lucide-react';
import type { Person, Meeting } from '@shared/types';
import { formatDuration } from '../lib/formatters';

export default function PrepView() {
  const { meetings } = useAppStore();
  const [people, setPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = useState(true);

  useEffect(() => {
    loadPeople();
    loadUpcomingMeetings();
  }, []);

  const loadPeople = async () => {
    setIsLoadingPeople(true);
    try {
      const peopleList = await window.kakarot.people.list();
      setPeople(peopleList);
    } finally {
      setIsLoadingPeople(false);
    }
  };

  const loadUpcomingMeetings = async () => {
    try {
      const upcoming = await window.kakarot.calendar.getUpcoming();
      setUpcomingMeetings(upcoming || []);
    } catch (error) {
      console.error('Failed to load upcoming meetings:', error);
    }
  };

  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return people;
    const query = searchQuery.toLowerCase();
    return people.filter(
      (p) =>
        (p.name?.toLowerCase().includes(query)) ||
        p.email.toLowerCase().includes(query) ||
        (p.organization?.toLowerCase().includes(query))
    );
  }, [people, searchQuery]);

  const handleSelectPerson = (person: Person) => {
    if (selectedPeople.find(p => p.email === person.email)) {
      setSelectedPeople(selectedPeople.filter(p => p.email !== person.email));
    } else {
      setSelectedPeople([...selectedPeople, person]);
    }
  };

  const getPersonMeetings = (person: Person): Meeting[] => {
    return meetings.filter(m =>
      m.attendeeEmails?.includes(person.email)
    ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  const getRecentTopics = (person: Person): string[] => {
    const personMeetings = getPersonMeetings(person);
    const topics = new Set<string>();
    
    personMeetings.slice(0, 3).forEach(meeting => {
      if (meeting.notesPlain) {
        // Extract key topics from notes (simple heuristic)
        const lines = meeting.notesPlain.split('\n');
        lines.forEach(line => {
          if (line.includes('##') || line.includes('**')) {
            const topic = line.replace(/[#*]/g, '').trim();
            if (topic.length > 10 && topic.length < 80) {
              topics.add(topic);
            }
          }
        });
      }
    });
    
    return Array.from(topics).slice(0, 3);
  };

  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
    ];
    const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getInitials = (person: Person) => {
    if (person.name) {
      return person.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return person.email[0].toUpperCase();
  };

  const formatLastMeeting = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
          Meeting Prep
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Select attendees to review past context and prepare for your next meeting
        </p>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* People Selection Panel */}
        <div className="w-96 flex flex-col bg-gray-50 dark:bg-slate-800/30 rounded-xl border border-gray-200 dark:border-slate-700/50">
          {/* Search */}
          <div className="p-4 border-b border-gray-200 dark:border-slate-700/50">
            <div className="relative">
              <input
                type="text"
                placeholder="Search attendees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
            {selectedPeople.length > 0 && (
              <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
                {selectedPeople.length} selected
              </div>
            )}
          </div>

          {/* People List */}
          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingPeople ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : filteredPeople.length === 0 ? (
              <div className="p-6 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">No contacts found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery ? 'Try a different search' : 'Contacts appear after meetings'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredPeople.map((person) => {
                  const isSelected = selectedPeople.some(p => p.email === person.email);
                  return (
                    <button
                      key={person.email}
                      onClick={() => handleSelectPerson(person)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${getAvatarColor(person.email)} flex items-center justify-center text-white font-medium text-sm flex-shrink-0`}>
                          {getInitials(person)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {person.name || person.email}
                          </h3>
                          {person.name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{person.email}</p>
                          )}
                          {person.organization && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-0.5">{person.organization}</p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Context Panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedPeople.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Select attendees to prepare
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose people from the left to see your meeting history, past topics, and contextual information
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                <div className="flex items-start gap-4">
                  <div className="flex -space-x-2">
                    {selectedPeople.slice(0, 3).map((person) => (
                      <div
                        key={person.email}
                        className={`w-12 h-12 rounded-full ${getAvatarColor(person.email)} flex items-center justify-center text-white font-medium border-2 border-white dark:border-slate-800`}
                      >
                        {getInitials(person)}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      Meeting with {selectedPeople.map(p => p.name || p.email).join(', ')}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {selectedPeople.reduce((sum, p) => sum + p.meetingCount, 0)} past meetings
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(selectedPeople.reduce((sum, p) => sum + p.totalDuration, 0))} together
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Contexts */}
              {selectedPeople.map((person) => {
                const personMeetings = getPersonMeetings(person);
                const recentTopics = getRecentTopics(person);
                
                return (
                  <div key={person.email} className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-full ${getAvatarColor(person.email)} flex items-center justify-center text-white font-medium flex-shrink-0`}>
                        {getInitials(person)}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {person.name || person.email}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {person.organization && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" />
                              {person.organization}
                            </span>
                          )}
                          <span>Last met: {formatLastMeeting(person.lastMeetingAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Meetings</div>
                        <div className="text-xl font-semibold text-gray-900 dark:text-white">{person.meetingCount}</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Time</div>
                        <div className="text-xl font-semibold text-gray-900 dark:text-white">
                          {formatDuration(person.totalDuration)}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Duration</div>
                        <div className="text-xl font-semibold text-gray-900 dark:text-white">
                          {formatDuration(Math.round(person.totalDuration / person.meetingCount))}
                        </div>
                      </div>
                    </div>

                    {/* Recent Topics */}
                    {recentTopics.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Recent Topics</h4>
                        </div>
                        <div className="space-y-1">
                          {recentTopics.map((topic, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <ChevronRight className="w-3 h-3 text-gray-400" />
                              <span>{topic}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {person.notes && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Your Notes</h4>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {person.notes}
                        </div>
                      </div>
                    )}

                    {/* Recent Meetings */}
                    {personMeetings.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            Recent Meetings ({personMeetings.length})
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {personMeetings.slice(0, 3).map((meeting) => (
                            <div key={meeting.id} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {meeting.title}
                                  </h5>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    <span>{new Date(meeting.createdAt).toLocaleDateString()}</span>
                                    <span>{formatDuration(meeting.duration)}</span>
                                  </div>
                                </div>
                              </div>
                              {meeting.overview && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                                  {meeting.overview}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
