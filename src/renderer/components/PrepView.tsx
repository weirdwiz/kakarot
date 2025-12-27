import React, { useState, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { ChevronDown, Plus, X } from 'lucide-react';
import type { Meeting } from '@shared/types';

interface MeetingTypeOption {
  id: string;
  name: string;
}

const PREDEFINED_TYPES: MeetingTypeOption[] = [
  { id: 'qbr', name: 'QBR' },
  { id: 'weekly-sync', name: 'Weekly Sync' },
  { id: 'discovery', name: 'Discovery Call' },
];

export default function PrepView() {
  const { meetings } = useAppStore();
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [customTypes, setCustomTypes] = useState<MeetingTypeOption[]>([]);
  const [showNewTypeModal, setShowNewTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeContext, setNewTypeContext] = useState('');

  // Extract unique person/company names from meetings
  const personOptions = useMemo(() => {
    const people = new Set<string>();
    meetings.forEach((meeting) => {
      if (meeting.title) {
        people.add(meeting.title);
      }
    });
    return Array.from(people).sort();
  }, [meetings]);

  const allTypes = [...PREDEFINED_TYPES, ...customTypes];

  const handleAddNewType = () => {
    if (newTypeName.trim()) {
      const newType: MeetingTypeOption = {
        id: `custom-${Date.now()}`,
        name: newTypeName.trim(),
      };
      setCustomTypes([...customTypes, newType]);
      setSelectedType(newType.id);
      setNewTypeName('');
      setNewTypeContext('');
      setShowNewTypeModal(false);
    }
  };

  const isComplete = selectedPerson && selectedType;

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-12">
      {/* Main Content Container */}
      <div className="max-w-2xl w-full space-y-8">
        {/* Primary Heading */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Let's prepare.
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Tell me who you're meeting with and what kind of call it is.
          </p>
        </div>

        {/* Guided Flow Section */}
        <div className="space-y-6 bg-white/50 dark:bg-slate-800/30 rounded-2xl border border-white/60 dark:border-slate-700/50 p-8 backdrop-blur-sm">
          {/* Person/Company Dropdown */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-900 dark:text-white">
              I'm meeting with
            </label>
            <div className="relative">
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="w-full px-4 py-3 pl-4 appearance-none bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50 text-base"
              >
                <option value="">Select a person or company</option>
                {personOptions.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Type of Call Dropdown */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-900 dark:text-white">
              for a
            </label>
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-3 pl-4 appearance-none bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50 text-base"
              >
                <option value="">Select a meeting type</option>
                {allTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
                <option value="__add_new__" disabled className="text-slate-400">
                  ─────────────
                </option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            {/* Add New Type Button */}
            <button
              onClick={() => setShowNewTypeModal(true)}
              className="w-full py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-medium text-sm flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              Add New Meeting Type
            </button>
          </div>

          {/* Ready State */}
          {isComplete && (
            <div className="pt-4 space-y-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                ✓ Ready to help you prepare for this meeting.
              </p>
              <button
                className="w-full py-3 px-4 bg-[#8B5CF6] text-white font-semibold rounded-lg shadow-soft-card transition hover:opacity-95 flex items-center justify-center gap-2"
                disabled
              >
                Prep Suggestions Coming Soon
              </button>
            </div>
          )}
        </div>

        {/* Info Text */}
        <p className="text-xs text-slate-500 dark:text-slate-500 text-center">
          Your meeting history helps us provide better prep suggestions.
        </p>
      </div>

      {/* Add New Meeting Type Modal */}
      {showNewTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full mx-4 border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Add New Meeting Type
              </h2>
              <button
                onClick={() => setShowNewTypeModal(false)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-900 dark:text-white">
                  Meeting Type Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Technical Debrief"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNewType();
                    if (e.key === 'Escape') setShowNewTypeModal(false);
                  }}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-900 dark:text-white">
                  Context / Description
                </label>
                <textarea
                  placeholder="What usually happens in this meeting? What outcomes matter? What do you want help preparing for?"
                  value={newTypeContext}
                  onChange={(e) => setNewTypeContext(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50 resize-none"
                  rows={4}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowNewTypeModal(false);
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              <button
                onClick={() => setShowNewTypeModal(false)}
                className="flex-1 py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewType}
                disabled={!newTypeName.trim()}
                className="flex-1 py-2 px-4 bg-[#8B5CF6] text-white rounded-lg font-medium shadow-soft-card transition hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Add Type
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
