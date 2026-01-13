import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import {
  Users,
  Building2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  X,
  Search,
  BarChart3,
  MessageCircle,
  Copy,
  Save,
  ChevronLeft,
  Moon,
  Sun,
} from 'lucide-react';
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
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Popover states
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const personDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // Get meeting types from settings
  const meetingTypes = useMemo(() => {
    const customTypes = settings?.customMeetingTypes || [];
    return customTypes.length > 0
      ? [...customTypes, 'Custom...']
      : [
          '1:1 Meeting',
          'Kick-Off',
          'Technical Sync',
          'Status Update',
          'Planning Session',
          'Retrospective',
          'Custom...',
        ];
  }, [settings?.customMeetingTypes]);

  useEffect(() => {
    loadPeople();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        personDropdownRef.current &&
        !personDropdownRef.current.contains(e.target as Node)
      ) {
        setShowPersonDropdown(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setShowTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    setShowPersonDropdown(false);
  };

  const isCustomMeetingType = meetingType === 'Custom...';
  const finalMeetingType = isCustomMeetingType ? customMeetingType : meetingType;

  const getDisplayName = (person: Person): string => {
    if (person.name && person.name.trim()) {
      return person.name;
    }
    const localPart = person.email.split('@')[0];
    const nameParts = localPart.split(/[._-]/).filter((part) => part.length > 0);
    return nameParts
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
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
        participants: [
          {
            name: selectedPerson.name || selectedPerson.email,
            email: selectedPerson.email,
            company: selectedPerson.organization || null,
            domain: selectedPerson.email?.split('@')[1] || null,
          },
        ],
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

  const copyToNotes = async () => {
    if (!briefingResult) return;
    const text = JSON.stringify(briefingResult, null, 2);
    await navigator.clipboard.writeText(text);
  };

  // Form view
  if (!briefingResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur border-b border-white/5">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>

            {/* Segmented Control */}
            <div className="flex gap-1 bg-slate-800/50 rounded-full p-1 border border-white/10">
              <button className="px-4 py-1.5 rounded-full text-sm text-slate-400 hover:text-white transition-colors">
                Home
              </button>
              <button className="px-4 py-1.5 rounded-full text-sm bg-purple-600 text-white transition-colors">
                Prep
              </button>
              <button className="px-4 py-1.5 rounded-full text-sm text-slate-400 hover:text-white transition-colors">
                Interact
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {isDarkMode ? (
                <Moon className="w-5 h-5 text-white" />
              ) : (
                <Sun className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Title */}
          <h1 className="text-4xl font-bold text-white text-center mb-12">
            Meeting Preparation
          </h1>

          {/* Sentence Builder */}
          <div className="space-y-8">
            {/* Input Sentence */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-xl text-white">
              <span>I have a meeting with</span>

              {/* Person Dropdown */}
              <div className="relative" ref={personDropdownRef}>
                <button
                  onClick={() => setShowPersonDropdown(!showPersonDropdown)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${
                    selectedPerson
                      ? 'bg-slate-700 hover:bg-slate-600'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {selectedPerson ? (
                    <>
                      <div
                        className={`w-5 h-5 rounded-full ${getAvatarColor(
                          selectedPerson.email
                        )} flex items-center justify-center text-white text-xs font-medium`}
                      >
                        {getInitials(selectedPerson)}
                      </div>
                      <span className="text-white">{getDisplayName(selectedPerson)}</span>
                      <X className="w-4 h-4 text-slate-400" />
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-300">Select person</span>
                    </>
                  )}
                </button>

                {/* Popover */}
                {showPersonDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {/* Search */}
                    <div className="p-3 border-b border-white/5">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search people..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* People List */}
                    <div className="max-h-64 overflow-y-auto">
                      {filteredPeople.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">
                          No people found
                        </div>
                      ) : (
                        filteredPeople.map((person) => (
                          <button
                            key={person.email}
                            onClick={() => handleSelectPerson(person)}
                            className="w-full p-3 hover:bg-slate-700/50 flex items-center gap-3 text-left border-b border-white/5 last:border-0 transition-colors"
                          >
                            <div
                              className={`w-8 h-8 rounded-full ${getAvatarColor(
                                person.email
                              )} flex items-center justify-center text-white text-xs font-medium flex-shrink-0`}
                            >
                              {getInitials(person)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {getDisplayName(person)}
                              </div>
                              <div className="text-xs text-slate-400 truncate">
                                {person.email}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <span>about</span>

              {/* Topic/Type Dropdown */}
              <div className="relative" ref={typeDropdownRef}>
                <button
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="px-4 py-2 rounded-lg font-medium bg-cyan-900/30 border border-cyan-500/50 hover:bg-cyan-900/50 transition-all text-cyan-300 inline-flex items-center gap-2"
                >
                  {meetingType || <span className="text-slate-400">Select topic</span>}
                </button>

                {/* Popover */}
                {showTypeDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-white/5">
                      <p className="text-sm text-slate-400 font-medium">Meeting Types</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {meetingTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            setMeetingType(type);
                            setShowTypeDropdown(false);
                          }}
                          className={`w-full p-3 text-left hover:bg-slate-700/50 transition-colors border-b border-white/5 last:border-0 ${
                            meetingType === type
                              ? 'bg-purple-600/20 border-l-2 border-l-purple-500'
                              : ''
                          }`}
                        >
                          <span className="text-white text-sm font-medium">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Type Input */}
            {isCustomMeetingType && (
              <div className="flex justify-center">
                <input
                  autoFocus
                  type="text"
                  placeholder="Enter custom meeting type..."
                  value={customMeetingType}
                  onChange={(e) => setCustomMeetingType(e.target.value)}
                  className="px-4 py-2 max-w-xs bg-slate-700/50 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            )}

            {/* Error Message */}
            {generatingError && (
              <div className="flex justify-center">
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300">{generatingError}</p>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleGenerateBriefing}
                disabled={isGenerating || !selectedPerson || !finalMeetingType.trim()}
                className="w-full max-w-md px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-5 h-5 animate-spin" />
                    Generating Insights...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Prep Insights
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Empty State */}
          {!isLoadingPeople && people.length === 0 && (
            <div className="mt-20 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">No contacts yet</h3>
              <p className="text-sm text-slate-500">
                Contacts will appear here after you record your first meeting
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Results view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => {
              setBriefingResult(null);
              setMeetingType('');
              setCustomMeetingType('');
              setSelectedPerson(null);
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          {/* Segmented Control */}
          <div className="flex gap-1 bg-slate-800/50 rounded-full p-1 border border-white/10">
            <button className="px-4 py-1.5 rounded-full text-sm text-slate-400 hover:text-white transition-colors">
              Home
            </button>
            <button className="px-4 py-1.5 rounded-full text-sm bg-purple-600 text-white transition-colors">
              Prep
            </button>
            <button className="px-4 py-1.5 rounded-full text-sm text-slate-400 hover:text-white transition-colors">
              Interact
            </button>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isDarkMode ? (
              <Moon className="w-5 h-5 text-white" />
            ) : (
              <Sun className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Results Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-12 animate-fadeIn">
          {/* Prep Insights Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 border border-white/10 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-8 py-8 border-b border-white/5">
              <h2 className="text-3xl font-bold text-white">Prep Insights</h2>
              <p className="text-slate-400 mt-2">
                Generated for {selectedPerson?.name || 'selected person'} • {briefingResult.meeting.type}
              </p>
            </div>

            {/* Content */}
            <div className="px-8 py-8 space-y-8">
              {/* Key Insights */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Key Insights from Past Discussions
                  </h3>
                </div>
                <ul className="space-y-3 ml-11">
                  {briefingResult.participants[0]?.context.key_points.map((point, idx) => (
                    <li key={idx} className="flex gap-3 text-slate-300">
                      <span className="text-purple-400 mt-1">•</span>
                      <span>{point || 'Previous action item pending'}</span>
                    </li>
                  )) || [
                    <li key="0" className="flex gap-3 text-slate-300">
                      <span className="text-purple-400 mt-1">•</span>
                      <span>First time meeting</span>
                    </li>,
                  ]}
                </ul>
              </div>

              {/* Recommended Conversation */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Recommended Conversation Tracks
                  </h3>
                </div>
                <ul className="space-y-3 ml-11">
                  {briefingResult.participants[0]?.talking_points.slice(0, 3).map((point, idx) => (
                    <li key={idx} className="flex gap-3 text-slate-300">
                      <span className="text-teal-400 mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Agenda */}
              {briefingResult.agenda.key_topics.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Agenda</h3>
                  <div className="space-y-3 ml-0 pl-4 border-l-2 border-purple-500/30">
                    {briefingResult.agenda.key_topics.map((topic, idx) => (
                      <div key={idx}>
                        <p className="text-sm text-purple-300 font-medium">Topic {idx + 1}</p>
                        <p className="text-slate-300">{topic}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-6 bg-slate-900/50 border-t border-white/5 flex justify-end gap-3">
              <button
                onClick={copyToNotes}
                className="px-4 py-2 border border-white/20 hover:border-white/40 rounded-lg text-slate-300 hover:text-white transition-all inline-flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy to Notes
              </button>
              <button className="px-4 py-2 border border-white/20 hover:border-white/40 rounded-lg text-slate-300 hover:text-white transition-all inline-flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save to Meeting
              </button>
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="mt-8 space-y-6">
          {/* Success Metrics */}
          {briefingResult.success_metrics.length > 0 && (
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 border border-white/10 rounded-2xl p-8">
              <h3 className="text-lg font-semibold text-white mb-4">Success Metrics</h3>
              <ul className="space-y-3">
                {briefingResult.success_metrics.map((metric, idx) => (
                  <li key={idx} className="flex gap-3 text-slate-300">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>{metric}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk Mitigation */}
          {briefingResult.risk_mitigation.length > 0 && (
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 border border-white/10 rounded-2xl p-8">
              <h3 className="text-lg font-semibold text-white mb-4">Risk Mitigation</h3>
              <ul className="space-y-3">
                {briefingResult.risk_mitigation.map((risk, idx) => (
                  <li key={idx} className="flex gap-3 text-slate-300">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Fade in animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
