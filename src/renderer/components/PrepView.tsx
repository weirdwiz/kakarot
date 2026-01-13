import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { Users, Building2, Sparkles, AlertCircle, CheckCircle, X } from 'lucide-react';
import type { Person } from '@shared/types';
import { formatDuration } from '../lib/formatters';

interface MeetingPrepResult {
  meeting: {
    type: string;
    duration_minutes: number;
  };
  generated_at: string;
  participants: Array<{
    name: string;
    email: string | null;
    history_strength: 'strong' | 'weak' | 'org-only' | 'none';
    context: {
      last_meeting_date: string | null;
      meeting_count: number;
      recent_topics: string[];
      key_points: string[];
    };
    talking_points: string[];
    questions_to_ask: string[];
    background: string;
  }>;
  agenda: {
    opening: string;
    key_topics: string[];
    closing: string;
  };
  success_metrics: string[];
  risk_mitigation: string[];
}

export default function PrepView() {
  const { settings } = useAppStore();
  const [people, setPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isLoadingPeople, setIsLoadingPeople] = useState(true);
  const [meetingType, setMeetingType] = useState('');
  const [customMeetingType, setCustomMeetingType] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingError, setGeneratingError] = useState<string | null>(null);
  const [briefingResult, setBriefingResult] = useState<MeetingPrepResult | null>(null);

  // Get meeting types from settings
  const meetingTypes = useMemo(() => {
    const customTypes = settings?.customMeetingTypes || [];
    return customTypes.length > 0 ? [...customTypes, 'Custom...'] : [
      'Tech Sync', 'Kick-Off Meeting', 'Cadence Call', 'Product Demo', 'Sales Call',
      'Check-in', 'Strategy Session', 'Sprint Planning', 'Retrospective', '1:1 Meeting', 'Custom...'
    ];
  }, [settings?.customMeetingTypes]);

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = async () => {
    setIsLoadingPeople(true);
    try {
      const peopleList = await window.kakarot.people.list();
      console.log('[PrepView] Loaded people:', peopleList);
      setPeople(peopleList);
    } finally {
      setIsLoadingPeople(false);
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
    setSelectedPerson(person);
    setSearchQuery('');
  };

  const isCustomMeetingType = meetingType === 'Custom...';
  const finalMeetingType = isCustomMeetingType ? customMeetingType : meetingType;

  const getDisplayName = (person: Person): string => {
    if (person.name && person.name.trim()) {
      return person.name;
    }
    // Extract name from email (e.g., "john.doe@company.com" -> "John Doe")
    const localPart = person.email.split('@')[0];
    const nameParts = localPart.split(/[._-]/).filter(part => part.length > 0);
    return nameParts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
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
    const displayName = getDisplayName(person);
    const nameParts = displayName.split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
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

  const handleGenerateBriefing = async () => {
    if (!finalMeetingType.trim() || !selectedPerson) {
      setGeneratingError('Please select a person and meeting type');
      return;
    }

    setIsGenerating(true);
    setGeneratingError(null);
    setBriefingResult(null);

    try {
      const payload = {
        meeting: {
          meeting_type: finalMeetingType,
          objective: finalMeetingType,
        },
        participants: [{
          name: selectedPerson.name || selectedPerson.email,
          email: selectedPerson.email,
          company: selectedPerson.organization || null,
          domain: selectedPerson.email?.split('@')[1] || null,
        }],
      };

      const result = await window.kakarot.prep.generateBriefing(payload);
      setBriefingResult(result);
    } catch (error) {
      setGeneratingError(
        error instanceof Error ? error.message : 'Failed to generate briefing'
      );
      console.error('Failed to generate briefing:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col overflow-hidden">
      {briefingResult ? (
        // Briefing Result View
        <div className="flex flex-col overflow-hidden">
          {/* Header with back button */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-slate-700">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">
                Meeting Briefing
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Generated on {new Date(briefingResult.generated_at).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => {
                setBriefingResult(null);
                setMeetingType('');
                setCustomMeetingType('');
                setSelectedPerson(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Generate Another
            </button>
          </div>

          {/* Briefing Content */}
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Meeting Overview */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {briefingResult.meeting.type}
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">Duration</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{briefingResult.meeting.duration_minutes} minutes</p>
                </div>
              </div>
            </div>

            {/* Agenda */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agenda</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Opening</p>
                  <p className="text-gray-700 dark:text-gray-300">{briefingResult.agenda.opening}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-2">Key Topics</p>
                  <ul className="space-y-2">
                    {briefingResult.agenda.key_topics.map((topic, idx) => (
                      <li key={idx} className="flex gap-3">
                        <span className="text-purple-500 flex-shrink-0 mt-1">•</span>
                        <span className="text-gray-700 dark:text-gray-300">{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Closing</p>
                  <p className="text-gray-700 dark:text-gray-300">{briefingResult.agenda.closing}</p>
                </div>
              </div>
            </div>

            {/* Success Metrics */}
            {briefingResult.success_metrics.length > 0 && (
              <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Success Metrics</h3>
                <ul className="space-y-2">
                  {briefingResult.success_metrics.map((metric, idx) => (
                    <li key={idx} className="flex gap-3">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                      <span className="text-gray-700 dark:text-gray-300">{metric}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risk Mitigation */}
            {briefingResult.risk_mitigation.length > 0 && (
              <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk Mitigation</h3>
                <ul className="space-y-2">
                  {briefingResult.risk_mitigation.map((risk, idx) => (
                    <li key={idx} className="flex gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" />
                      <span className="text-gray-700 dark:text-gray-300">{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Participant Sections */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Participant Insights</h3>
              {briefingResult.participants.map((participant, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{participant.name}</h4>
                      {participant.email && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{participant.email}</p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      participant.history_strength === 'strong'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : participant.history_strength === 'weak'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        : participant.history_strength === 'org-only'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300'
                    }`}>
                      {participant.history_strength === 'strong' && 'Strong History'}
                      {participant.history_strength === 'weak' && 'Weak History'}
                      {participant.history_strength === 'org-only' && 'Same Org'}
                      {participant.history_strength === 'none' && 'No History'}
                    </span>
                  </div>

                  {/* Context Info */}
                  <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Meetings</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{participant.context.meeting_count}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Recent Topics</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{participant.context.recent_topics.length}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Last Meeting</p>
                      <p className="font-semibold text-gray-900 dark:text-white text-xs">
                        {participant.context.last_meeting_date ? new Date(participant.context.last_meeting_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Background */}
                  {participant.background && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">Background</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{participant.background}</p>
                    </div>
                  )}

                  {/* Talking Points */}
                  {participant.talking_points.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Talking Points</p>
                      <ul className="space-y-1">
                        {participant.talking_points.map((point, pidx) => (
                          <li key={pidx} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="text-purple-500 flex-shrink-0">→</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Questions to Ask */}
                  {participant.questions_to_ask.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Questions to Ask</p>
                      <ul className="space-y-1">
                        {participant.questions_to_ask.map((question, qidx) => (
                          <li key={qidx} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="text-blue-500 flex-shrink-0">?</span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Form View
        <>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
              Meeting Prep
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Get ready for your next meeting in less than 5 minutes
            </p>
          </div>

          {/* Natural language form */}
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3 text-lg text-slate-700 dark:text-slate-300">
              <span>I have a meeting with</span>
              
              {/* Person Selection */}
              {selectedPerson ? (
                <button
                  onClick={() => setSelectedPerson(null)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors group"
                >
                  <div className={`w-6 h-6 rounded-full ${getAvatarColor(selectedPerson.email)} flex items-center justify-center text-white text-xs font-medium`}>
                    {getInitials(selectedPerson)}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {getDisplayName(selectedPerson)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{selectedPerson.email}</span>
                  </div>
                  <X className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                </button>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search person..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  {searchQuery && filteredPeople.length > 0 && (
                    <div className="absolute z-10 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                      {filteredPeople.slice(0, 5).map((person) => (
                        <button
                          key={person.email}
                          onClick={() => handleSelectPerson(person)}
                          className="w-full p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 text-left border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                        >
                          <div className={`w-8 h-8 rounded-full ${getAvatarColor(person.email)} flex items-center justify-center text-white text-sm font-medium flex-shrink-0`}>
                            {getInitials(person)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {getDisplayName(person)}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {person.email}
                              {person.organization && ' • '}
                              {person.organization || ''}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <span>about</span>
              
              {/* Meeting Type Dropdown */}
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium min-w-[180px]"
              >
                <option value="">Select type...</option>
                {meetingTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Custom inputs */}
            {isCustomMeetingType && (
              <div className="mt-4 ml-0">
                <input
                  type="text"
                  placeholder="Enter custom meeting type..."
                  value={customMeetingType}
                  onChange={(e) => setCustomMeetingType(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>
            )}

            {/* Error Message */}
            {generatingError && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-700 dark:text-red-300">{generatingError}</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerateBriefing}
              disabled={isGenerating || !selectedPerson || !finalMeetingType.trim()}
              className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  Analyzing your meeting history...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Prepare My Meeting
                </>
              )}
            </button>
          </div>

          {/* Context Preview for Selected Person */}
          {selectedPerson && !briefingResult && (
            <div className="mt-8 max-w-4xl bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full ${getAvatarColor(selectedPerson.email)} flex items-center justify-center text-white font-medium flex-shrink-0`}>
                  {getInitials(selectedPerson)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {getDisplayName(selectedPerson)}
                  </h3>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="text-sm text-slate-600 dark:text-slate-400">{selectedPerson.email}</div>
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                      {selectedPerson.organization && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {selectedPerson.organization}
                        </span>
                      )}
                      {selectedPerson.lastMeetingAt && (
                        <span>Last met: {formatLastMeeting(selectedPerson.lastMeetingAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Meetings</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-white">{selectedPerson.meetingCount || 0}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Time</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-white">
                    {formatDuration(selectedPerson.totalDuration || 0)}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Status</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {(selectedPerson.meetingCount || 0) === 0 ? 'First time' : 'Returning'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No contacts state */}
          {!selectedPerson && !isLoadingPeople && people.length === 0 && (
            <div className="mt-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                No contacts yet
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Contacts will appear here after you record your first meeting
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
