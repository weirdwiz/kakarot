import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, User, Building2, ChevronRight } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import type { Person, Meeting } from '@shared/types';

interface SearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

interface TranscriptResult {
  term: string;
  matchCount: number;
  meetings: Meeting[];
}

interface CompanyResult {
  name: string;
  domain: string;
  contactCount: number;
}

export default function SearchPopup({ isOpen, onClose, initialQuery = '' }: SearchPopupProps) {
  const { setView, setSearchQuery, setSelectedMeeting } = useAppStore();
  const [query, setQuery] = useState(initialQuery);
  const [contacts, setContacts] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when popup opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when popup closes
  useEffect(() => {
    if (!isOpen) {
      setQuery(initialQuery);
      setContacts([]);
      setCompanies([]);
      setTranscriptResult(null);
    }
  }, [isOpen, initialQuery]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setContacts([]);
      setCompanies([]);
      setTranscriptResult(null);
      return;
    }

    setIsLoading(true);
    try {
      // Search in parallel
      const [peopleResults, meetingsResults, companiesResults] = await Promise.all([
        window.kakarot.people.search(searchQuery),
        window.kakarot.meetings.search(searchQuery),
        window.kakarot.people.getCompanies(),
      ]);

      // Filter contacts (limit to 5)
      setContacts(peopleResults.slice(0, 5));

      // Count transcript matches across all meetings
      if (meetingsResults.length > 0) {
        let totalMatches = 0;
        const lowerQuery = searchQuery.toLowerCase();

        for (const meeting of meetingsResults) {
          for (const segment of meeting.transcript) {
            const matches = (segment.text.toLowerCase().match(new RegExp(lowerQuery, 'g')) || []).length;
            totalMatches += matches;
          }
          // Also check title matches
          if (meeting.title.toLowerCase().includes(lowerQuery)) {
            totalMatches += 1;
          }
        }

        setTranscriptResult({
          term: searchQuery,
          matchCount: totalMatches,
          meetings: meetingsResults,
        });
      } else {
        setTranscriptResult(null);
      }

      // Filter companies by search query (limit to 5)
      const filteredCompanies = companiesResults
        .filter(c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.domain.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5);
      setCompanies(filteredCompanies);

    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce input changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  const handleTranscriptClick = () => {
    if (transcriptResult) {
      setSearchQuery(transcriptResult.term);
      setView('history');
      onClose();
    }
  };

  const handleContactClick = async (person: Person) => {
    // Navigate to people view - could enhance to select the person
    setView('people');
    onClose();
  };

  const handleCompanyClick = (company: CompanyResult) => {
    // Search for contacts from this company domain
    setSearchQuery(`@${company.domain}`);
    setView('people');
    onClose();
  };

  if (!isOpen) return null;

  const hasResults = contacts.length > 0 || companies.length > 0 || transcriptResult;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#121212] rounded-xl border border-[#1A1A1A] w-full max-w-lg mx-4 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-[#1A1A1A]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search meetings, contacts, or companies..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-[#0F0F10] border border-[#1A1A1A] text-slate-100 rounded-lg pl-11 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 placeholder:text-slate-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">
              <div className="animate-pulse">Searching...</div>
            </div>
          ) : !query.trim() ? (
            <div className="p-8 text-center text-slate-500">
              <p className="text-sm">Start typing to search across meetings, contacts, and companies</p>
            </div>
          ) : !hasResults ? (
            <div className="p-8 text-center text-slate-500">
              <p className="text-sm">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="p-2">
              {/* Transcript Results */}
              {transcriptResult && (
                <div className="mb-4">
                  <h3 className="text-xs uppercase tracking-wider text-slate-500 px-3 py-2">
                    Transcripts
                  </h3>
                  <button
                    onClick={handleTranscriptClick}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1A1A1A] transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[#7C3AED]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">
                        "{transcriptResult.term}": {transcriptResult.matchCount} matches
                      </p>
                      <p className="text-xs text-slate-500">
                        in {transcriptResult.meetings.length} meeting{transcriptResult.meetings.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  </button>
                </div>
              )}

              {/* Contact Results */}
              {contacts.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs uppercase tracking-wider text-slate-500 px-3 py-2">
                    Contacts
                  </h3>
                  {contacts.map((person) => (
                    <button
                      key={person.email}
                      onClick={() => handleContactClick(person)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1A1A1A] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">
                          {person.name || person.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{person.email}</p>
                      </div>
                      {person.organization && (
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                          {person.organization}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Company Results */}
              {companies.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-slate-500 px-3 py-2">
                    Companies
                  </h3>
                  {companies.map((company) => (
                    <button
                      key={company.domain}
                      onClick={() => handleCompanyClick(company)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1A1A1A] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{company.name}</p>
                        <p className="text-xs text-slate-500">{company.domain}</p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {company.contactCount} contact{company.contactCount !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-[#1A1A1A] text-center">
          <p className="text-xs text-slate-500">
            Press <kbd className="px-1.5 py-0.5 bg-[#1A1A1A] rounded text-slate-400">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
